import React, { useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Button } from '../ui/Button'
import { Download } from 'lucide-react'

export const QRCodeDisplay = ({
  value,
  size = 256,
  label,
  employeeId,
  name,
  employeeType,
  companyName
}) => {
  const qrRef = useRef(null)

  const downloadQRCode = () => {
    if (!qrRef.current) return

    const qrCanvas = qrRef.current.querySelector('canvas')
    if (!qrCanvas) return

    const normalizedEmployeeType = employeeType?.toLowerCase().replace(/\s+/g, '')
    const lines = []

    if (employeeId) lines.push(`Employee ID: ${employeeId}`)
    if (normalizedEmployeeType === 'permanent' && name) {
      lines.push(`Employee Name: ${name}`)
    }
    if (companyName) lines.push(`Company Name: ${companyName}`)

    let pngUrl = ''
    if (lines.length === 0) {
      pngUrl = qrCanvas.toDataURL('image/png')
    } else {
      const textPaddingY = 12
      const fontSize = 16
      const lineHeight = 20
      const textAreaHeight = textPaddingY * 2 + lineHeight * lines.length

      const combinedCanvas = document.createElement('canvas')
      combinedCanvas.width = qrCanvas.width
      combinedCanvas.height = qrCanvas.height + textAreaHeight

      const ctx = combinedCanvas.getContext('2d')
      if (!ctx) return

      // White background so the saved PNG doesn't end up transparent.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height)

      // Draw QR code
      ctx.drawImage(qrCanvas, 0, 0)

      // Draw text below
      ctx.fillStyle = '#000000'
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      let y = qrCanvas.height + textPaddingY
      for (const line of lines) {
        ctx.fillText(line, combinedCanvas.width / 2, y)
        y += lineHeight
      }

      pngUrl = combinedCanvas.toDataURL('image/png')
    }
    const downloadLink = document.createElement('a')

    downloadLink.href = pngUrl
    // Simple filename: employeeId_name.png, spaces replaced with _
    const safeName = (name || 'name').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_')
    const safeEmployeeId = (employeeId || 'employee').replace(/[^a-zA-Z0-9_-]/g, '_')
    downloadLink.download = `${safeEmployeeId}_${safeName}.png`

    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div
        ref={qrRef}
        className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm"
      >
        <QRCodeCanvas
          value={value}
          size={size}
          level="H"
          includeMargin={true}
        />
      </div>

      {label && (
        <p className="text-sm font-medium text-slate-600">
          {label}
        </p>
      )}

      <Button
        variant="secondary"
        onClick={downloadQRCode}
        className="flex items-center"
      >
        <Download className="w-4 h-4 mr-2" />
        Download QR Code
      </Button>
    </div>
  )
}
