import React, { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const createCrcTable = () => {
  const table = []

  for (let i = 0; i < 256; i += 1) {
    let value = i
    for (let j = 0; j < 8; j += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[i] = value >>> 0
  }

  return table
}

const CRC_TABLE = createCrcTable()

const crc32 = (bytes) => {
  let crc = 0xffffffff

  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

const writeUint16 = (target, value) => {
  target.push(value & 0xff, (value >>> 8) & 0xff)
}

const writeUint32 = (target, value) => {
  target.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  )
}

const concatBytes = (parts) => {
  const size = parts.reduce((total, part) => total + part.length, 0)
  const output = new Uint8Array(size)
  let offset = 0

  parts.forEach((part) => {
    output.set(part, offset)
    offset += part.length
  })

  return output
}

const createZipBlob = (files) => {
  const encoder = new TextEncoder()
  const localParts = []
  const centralParts = []
  let offset = 0

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.path)
    const contentBytes = encoder.encode(file.content)
    const checksum = crc32(contentBytes)
    const localHeader = []

    writeUint32(localHeader, 0x04034b50)
    writeUint16(localHeader, 20)
    writeUint16(localHeader, 0x0800)
    writeUint16(localHeader, 0)
    writeUint16(localHeader, 0)
    writeUint16(localHeader, 0)
    writeUint32(localHeader, checksum)
    writeUint32(localHeader, contentBytes.length)
    writeUint32(localHeader, contentBytes.length)
    writeUint16(localHeader, nameBytes.length)
    writeUint16(localHeader, 0)

    localParts.push(new Uint8Array(localHeader), nameBytes, contentBytes)

    const centralHeader = []
    writeUint32(centralHeader, 0x02014b50)
    writeUint16(centralHeader, 20)
    writeUint16(centralHeader, 20)
    writeUint16(centralHeader, 0x0800)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint32(centralHeader, checksum)
    writeUint32(centralHeader, contentBytes.length)
    writeUint32(centralHeader, contentBytes.length)
    writeUint16(centralHeader, nameBytes.length)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint16(centralHeader, 0)
    writeUint32(centralHeader, 0)
    writeUint32(centralHeader, offset)

    centralParts.push(new Uint8Array(centralHeader), nameBytes)
    offset += localHeader.length + nameBytes.length + contentBytes.length
  })

  const centralDirectory = concatBytes(centralParts)
  const endRecord = []

  writeUint32(endRecord, 0x06054b50)
  writeUint16(endRecord, 0)
  writeUint16(endRecord, 0)
  writeUint16(endRecord, files.length)
  writeUint16(endRecord, files.length)
  writeUint32(endRecord, centralDirectory.length)
  writeUint32(endRecord, offset)
  writeUint16(endRecord, 0)

  return new Blob(
    [concatBytes([...localParts, centralDirectory, new Uint8Array(endRecord)])],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  )
}

const toColumnName = (index) => {
  let value = index + 1
  let name = ''

  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }

  return name
}

const createXlsxBlob = ({ headers, rows, sheetName = 'Report', columnWidths }) => {
  const allRows = [headers, ...rows]
  const widths = columnWidths || headers.map(() => 18)
  const rowsXml = allRows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1
    const cells = row.map((value, columnIndex) => {
      const column = toColumnName(columnIndex)
      const styleId = rowIndex === 0 ? 1 : 2
      return `<c r="${column}${rowNumber}" t="inlineStr" s="${styleId}"><is><t>${escapeXml(value)}</t></is></c>`
    })

    return `<row r="${rowNumber}">${cells.join('')}</row>`
  })

  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>
  <sheetData>${rowsXml.join('')}</sheetData>
  <pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
</worksheet>`

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FF94A3B8"/></left>
      <right style="thin"><color rgb="FF94A3B8"/></right>
      <top style="thin"><color rgb="FF94A3B8"/></top>
      <bottom style="thin"><color rgb="FF94A3B8"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`

  return createZipBlob([
    {
      path: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      path: 'xl/workbook.xml',
      content: workbookXml,
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      path: 'xl/worksheets/sheet1.xml',
      content: worksheetXml,
    },
    {
      path: 'xl/styles.xml',
      content: stylesXml,
    },
  ])
}

const downloadXlsxReport = ({ headers, rows, fileName, sheetName, columnWidths }) => {
  const blob = createXlsxBlob({ headers, rows, sheetName, columnWidths })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName?.endsWith('.xlsx') ? fileName : `${fileName || 'report'}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const ReportModal = ({
  isOpen,
  onClose,
  onGenerate,
  isGenerating,
  initialDate,
}) => {
  const [startDate, setStartDate] = useState(initialDate || '')
  const [endDate, setEndDate] = useState(initialDate || '')

  useEffect(() => {
    if (isOpen) {
      setStartDate(initialDate || '')
      setEndDate(initialDate || '')
    }
  }, [isOpen, initialDate])

  const handleGenerate = async () => {
    const report = await onGenerate(startDate, endDate)

    if (!report) return

    downloadXlsxReport(report)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Report"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isGenerating}
          />

          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isGenerating}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} isLoading={isGenerating}>
            Generate Report
          </Button>
        </div>
      </div>
    </Modal>
  )
}
