import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Table } from '../../components/ui/Table'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ReportModal } from '../../components/features/ReportModal'
import { useToast } from '../../hooks/useToast'
import { getDailySummary, getNonCheckoutEmployees, updateAttendanceLogScanTime, createManualAttendanceLog } from '../../services/attendance.service'

const toTimeValue = (scanTime) => {
  if (!scanTime) return ''
  const d = new Date(scanTime)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const toIsoFromDateAndTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null
  const [yyyy, mm, dd] = dateStr.split('-').map((v) => Number(v))
  const [hh, min] = timeStr.split(':').map((v) => Number(v))
  if (!yyyy || !mm || !dd) return null
  if (Number.isNaN(hh) || Number.isNaN(min)) return null
  const local = new Date(yyyy, mm - 1, dd, hh, min, 0, 0)
  if (Number.isNaN(local.getTime())) return null
  return local.toISOString()
}

const toLocalDateString = (dateValue) => {
  const yyyy = dateValue.getFullYear()
  const mm = String(dateValue.getMonth() + 1).padStart(2, '0')
  const dd = String(dateValue.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const getDateRange = (startDate, endDate) => {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)
  const start = new Date(startYear, startMonth - 1, startDay)
  const end = new Date(endYear, endMonth - 1, endDay)
  const dates = []

  for (let current = start; current <= end; current.setDate(current.getDate() + 1)) {
    dates.push(toLocalDateString(current))
  }

  return dates
}

const formatReportDateTime = (value) => {
  if (!value) return '-'
  const dateValue = new Date(value)
  if (Number.isNaN(dateValue.getTime())) return '-'
  return dateValue.toLocaleString()
}

const AttendanceDateTimeCell = ({ value }) => {
  if (!value) return '-'

  const dateValue = new Date(value)
  if (Number.isNaN(dateValue.getTime())) return '-'

  return (
    <div className="leading-tight">
      <div className="text-slate-900">{dateValue.toLocaleTimeString()}</div>
      <div className="mt-1 text-xs text-slate-500">
        {dateValue.toLocaleDateString('en-GB')}
      </div>
    </div>
  )
}

export const AttendancePage = () => {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(
    initialDate
  )
  const [summary, setSummary] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [nonCheckoutCount, setNonCheckoutCount] = useState(0)
  const [isNonCheckoutLoading, setIsNonCheckoutLoading] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [editCheckInDate, setEditCheckInDate] = useState('')
  const [editCheckIn, setEditCheckIn] = useState('')
  const [editCheckOutDate, setEditCheckOutDate] = useState('')
  const [editCheckOut, setEditCheckOut] = useState('')
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isReportGenerating, setIsReportGenerating] = useState(false)

  const fetchSummary = async () => {
    setIsLoading(true)
    try {
      const data = await getDailySummary(date)
      console.log('Daily summary data:', data)
      
      // Handle empty or invalid response
      if (!data || !Array.isArray(data)) {
        console.warn('Invalid data format received:', data)
        setSummary([])
        return
      }
      
      // Transform the API response to match the table structure
      const transformedData = data.map((item) => {
        const workDateFromLog = item.firstIn?.workDate || item.lastOut?.workDate || date
        return {
          id:
            item.employee?._id ||
            item.employee?.employeeId ||
            item.firstIn?._id ||
            item.lastOut?._id ||
            `${item.employee?.name || 'employee'}-${date}`,
          employeeId: item.employee?.employeeId || 'N/A',
          employeeObjectId: item.employee?._id,
          companyObjectId: item.company?._id || item.firstIn?.companyId || item.lastOut?.companyId,
          name: item.employee?.name || 'Unknown',
          checkIn: item.firstIn?.scanTime,
          checkOut: item.lastOut?.scanTime,
          checkInLogId: item.firstIn?._id,
          checkOutLogId: item.lastOut?._id,
          workDate: workDateFromLog,
          status: item.firstIn && item.lastOut ? 'Present' : item.firstIn ? 'Partial' : 'Absent',
          company: item.company?.companyName || 'N/A'
        }
      })
      setSummary(transformedData)
    } catch (error) {
      console.error('Failed to fetch attendance summary', error)
      setSummary([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchNonCheckoutCount = async () => {
    setIsNonCheckoutLoading(true)
    try {
      const data = await getNonCheckoutEmployees(date)
      const count =
        typeof data?.count === 'number'
          ? data.count
          : Array.isArray(data?.rows)
            ? data.rows.length
            : 0
      setNonCheckoutCount(count)
    } catch (error) {
      setNonCheckoutCount(0)
    } finally {
      setIsNonCheckoutLoading(false)
    }
  }

  const openReportModal = () => {
    setIsReportOpen(true)
  }

  const closeReportModal = () => {
    if (isReportGenerating) return
    setIsReportOpen(false)
  }

  const generateReport = async (startDate, endDate) => {
    if (!startDate || !endDate) {
      showToast('Please select a date range', 'warning')
      return
    }

    if (startDate > endDate) {
      showToast('Start date cannot be after end date', 'warning')
      return
    }

    setIsReportGenerating(true)
    try {
      const reportDates = getDateRange(startDate, endDate)
      const responses = await Promise.all(reportDates.map((reportDate) => getDailySummary(reportDate)))
      const rows = responses.flatMap((data, index) => {
        if (!Array.isArray(data)) return []

        return data.map((item) => {
          const workDateFromLog = item.firstIn?.workDate || item.lastOut?.workDate || reportDates[index]
          return {
            employeeId: item.employee?.employeeId || 'N/A',
            name: item.employee?.name || 'Unknown',
            checkIn: item.firstIn?.scanTime,
            checkOut: item.lastOut?.scanTime,
            workDate: workDateFromLog,
            status: item.firstIn && item.lastOut ? 'Present' : item.firstIn ? 'Partial' : 'Absent',
            company: item.company?.companyName || 'N/A',
          }
        })
      })

      if (rows.length === 0) {
        showToast('No attendance records found for this date range', 'warning')
        return
      }

      showToast('Attendance report downloaded', 'success')
      return {
        headers: [
          'Date',
          'Employee ID',
          'Employee Name',
          'Company',
          'Check In',
          'Check Out',
          'Status',
        ],
        rows: rows.map((row) => [
          row.workDate,
          row.employeeId,
          row.name,
          row.company,
          formatReportDateTime(row.checkIn),
          formatReportDateTime(row.checkOut),
          row.status,
        ]),
        fileName: `attendance-report-${startDate}-to-${endDate}.xlsx`,
        sheetName: 'Attendance Report',
        columnWidths: [14, 18, 24, 24, 24, 24, 12, 14],
      }
    } catch (error) {
      console.error('Failed to generate attendance report', error)
      const msg = error?.response?.data?.message || error?.message || 'Failed to generate attendance report'
      showToast(msg, 'error')
    } finally {
      setIsReportGenerating(false)
    }
  }

  useEffect(() => {
    fetchSummary()
    fetchNonCheckoutCount()
  }, [date])

  const openEdit = (row) => {
    const fallbackDate = row?.workDate || date
    setEditRow(row)
    setEditCheckInDate(row?.checkIn ? toLocalDateString(new Date(row.checkIn)) : fallbackDate)
    setEditCheckIn(toTimeValue(row?.checkIn))
    setEditCheckOutDate(row?.checkOut ? toLocalDateString(new Date(row.checkOut)) : fallbackDate)
    setEditCheckOut(toTimeValue(row?.checkOut))
    setIsEditOpen(true)
  }

  const closeEdit = () => {
    if (isSaving) return
    setIsEditOpen(false)
    setEditRow(null)
    setEditCheckInDate('')
    setEditCheckIn('')
    setEditCheckOutDate('')
    setEditCheckOut('')
  }

  const saveEdits = async () => {
    if (!editRow) return
    setIsSaving(true)
    try {
      const baseDate = editRow.workDate || date
      let updatesCount = 0

      if (editRow.checkInLogId && (!editCheckInDate || !editCheckIn)) {
        showToast('Please select both check-in date and time', 'warning')
        return
      }

      if (!editRow.checkInLogId && editCheckIn && !editCheckInDate) {
        showToast('Please select check-in date', 'warning')
        return
      }

      if (editRow.checkOutLogId && (!editCheckOutDate || !editCheckOut)) {
        showToast('Please select both check-out date and time', 'warning')
        return
      }

      if (!editRow.checkOutLogId && editCheckOut && !editCheckOutDate) {
        showToast('Please select check-out date', 'warning')
        return
      }

      if (editRow.checkInLogId) {
        const originalTime = toTimeValue(editRow.checkIn)
        const originalDate = editRow.checkIn ? toLocalDateString(new Date(editRow.checkIn)) : baseDate
        const hasChanged = editCheckIn !== originalTime || editCheckInDate !== originalDate

        if (hasChanged) {
          const iso = toIsoFromDateAndTime(editCheckInDate, editCheckIn)
          if (iso) {
            await updateAttendanceLogScanTime(editRow.checkInLogId, iso, editCheckInDate)
            updatesCount += 1
          }
        }
      } else if (editCheckIn) {
        const iso = toIsoFromDateAndTime(editCheckInDate, editCheckIn)
        if (iso) {
          await createManualAttendanceLog({
            employeeId: editRow.employeeObjectId,
            companyId: editRow.companyObjectId,
            scanType: 'IN',
            scanTime: iso,
            workDate: editCheckInDate,
          })
          updatesCount += 1
        }
      }

      const targetCheckoutWorkDate = editCheckInDate || baseDate
      if (editRow.checkOutLogId) {
        const originalTime = toTimeValue(editRow.checkOut)
        const originalDate = editRow.checkOut ? toLocalDateString(new Date(editRow.checkOut)) : baseDate
        const hasChanged =
          editCheckOut !== originalTime ||
          editCheckOutDate !== originalDate ||
          targetCheckoutWorkDate !== baseDate

        if (hasChanged) {
          const iso = toIsoFromDateAndTime(editCheckOutDate, editCheckOut)
          if (iso) {
            await updateAttendanceLogScanTime(editRow.checkOutLogId, iso, targetCheckoutWorkDate)
            updatesCount += 1
          }
        }
      } else if (editCheckOut) {
        const iso = toIsoFromDateAndTime(editCheckOutDate, editCheckOut)
        if (iso) {
          await createManualAttendanceLog({
            employeeId: editRow.employeeObjectId,
            companyId: editRow.companyObjectId,
            scanType: 'OUT',
            scanTime: iso,
            workDate: targetCheckoutWorkDate,
          })
          updatesCount += 1
        }
      }

      if (updatesCount === 0) {
        showToast('Nothing to update', 'warning')
        return
      }

      showToast('Attendance date and time updated', 'success')
      closeEdit()
      await fetchSummary()
    } catch (error) {
      console.error('Failed to update attendance times', error)
      const msg = error?.response?.data?.message || error?.message || 'Failed to update attendance times'
      showToast(msg, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const columns = [
    {
      header: 'Employee ID',
      accessor: 'employeeId',
    },
    {
      header: 'Employee',
      accessor: 'name',
    },
    {
      header: 'Check In',
      accessor: (item) => <AttendanceDateTimeCell value={item.checkIn} />,
    },
    {
      header: 'Check Out',
      accessor: (item) => <AttendanceDateTimeCell value={item.checkOut} />,
    },
    {
      header: 'Status',
      accessor: (item) => (
        <Badge
          variant={
            item.status === 'Present'
              ? 'success'
              : item.status === 'Partial'
              ? 'warning'
              : 'error'
          }
        >
          {item.status}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      accessor: (item) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openEdit(item)}
          disabled={!item.checkInLogId && !item.checkOutLogId}
        >
          Edit Times
        </Button>
      ),
      className: 'whitespace-nowrap',
    },
  ]

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Attendance Management
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* <div className="lg:col-span-1">
          <AttendanceScanner onScanSuccess={fetchSummary} />
        </div> */}

        <div className="lg:col-span-10">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 h-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Daily Summary
              </h3>

              <div className="flex items-end gap-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={openReportModal}
                  disabled={isEditOpen}
                  className="border-green-200! bg-green-100! text-green-800! hover:bg-green-200! focus:ring-green-500!"
                >
                  Generate Report
                </Button>

                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => navigate(`/attendance/non-checkout?date=${date}`)}
                  disabled={isNonCheckoutLoading}
                >
                  Non Checkout: {isNonCheckoutLoading ? '…' : nonCheckoutCount}
                </Button>

                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-auto"
                  disabled={isEditOpen}
                />
              </div>
            </div>

            <Table
              data={summary}
              columns={columns}
              keyExtractor={(item) => item.id}
              isLoading={isLoading}
              emptyMessage="No attendance records for this date"
            />
          </div>
        </div>
      </div>

      <ReportModal
        isOpen={isReportOpen}
        onClose={closeReportModal}
        onGenerate={generateReport}
        isGenerating={isReportGenerating}
        initialDate={date}
      />

      <Modal
        isOpen={isEditOpen}
        onClose={closeEdit}
        title={editRow ? `Edit Attendance - ${editRow.name}` : 'Edit Attendance'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Check In</p>
              <Input
                label="Date"
                type="date"
                value={editCheckInDate}
                onChange={(e) => setEditCheckInDate(e.target.value)}
              />
              <Input
                label="Time"
                type="time"
                value={editCheckIn}
                onChange={(e) => setEditCheckIn(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Check Out</p>
              <Input
                label="Date"
                type="date"
                value={editCheckOutDate}
                onChange={(e) => setEditCheckOutDate(e.target.value)}
              />
              <Input
                label="Time"
                type="time"
                value={editCheckOut}
                onChange={(e) => setEditCheckOut(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeEdit} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={saveEdits} isLoading={isSaving}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
