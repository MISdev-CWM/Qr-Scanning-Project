import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Table } from '../../components/ui/Table'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ReportModal } from '../../components/features/ReportModal'
import { useToast } from '../../hooks/useToast'
import { getDailySummary, getNonCheckoutEmployees, updateAttendanceLogScanTime, createManualAttendanceLog } from '../../services/attendance.service'
import { getShiftTimes, upsertShiftTimes } from '../../services/shiftTime.service'

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

const formatShiftWindow = (start, end, fallback = 'Not set') => {
  if (!start || !end) return fallback
  return `${start} - ${end}`
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

export const AttendancePage = () => {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [date, setDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [summary, setSummary] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [nonCheckoutCount, setNonCheckoutCount] = useState(0)
  const [isNonCheckoutLoading, setIsNonCheckoutLoading] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [editCheckIn, setEditCheckIn] = useState('')
  const [editCheckOut, setEditCheckOut] = useState('')
  const [shiftTimes, setShiftTimes] = useState(null)
  const [isShiftLoading, setIsShiftLoading] = useState(false)
  const [isShiftOpen, setIsShiftOpen] = useState(false)
  const [isShiftSaving, setIsShiftSaving] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isReportGenerating, setIsReportGenerating] = useState(false)
  const [shiftForm, setShiftForm] = useState({
    manpowerDayStart: '',
    manpowerDayEnd: '',
    manpowerNightStart: '',
    manpowerNightEnd: '',
    permanentDayStart: '',
    permanentDayEnd: '',
    permanentNightStart: '',
    permanentNightEnd: '',
  })

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
          shift: item.firstIn?.shift || item.lastOut?.shift || null,
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

  const fetchShiftTimes = async () => {
    setIsShiftLoading(true)
    try {
      const data = await getShiftTimes()
      setShiftTimes(data)
    } catch (error) {
      console.error('Failed to fetch shift times', error)
      showToast('Failed to load shift times', 'error')
    } finally {
      setIsShiftLoading(false)
    }
  }

  const openShiftModal = () => {
    setShiftForm({
      manpowerDayStart: shiftTimes?.manpowerDayStart || '',
      manpowerDayEnd: shiftTimes?.manpowerDayEnd || '',
      manpowerNightStart: shiftTimes?.manpowerNightStart || '',
      manpowerNightEnd: shiftTimes?.manpowerNightEnd || '',
      permanentDayStart: shiftTimes?.permanentDayStart || '',
      permanentDayEnd: shiftTimes?.permanentDayEnd || '',
      permanentNightStart: shiftTimes?.permanentNightStart || '',
      permanentNightEnd: shiftTimes?.permanentNightEnd || '',
    })
    setIsShiftOpen(true)
  }

  const closeShiftModal = () => {
    if (isShiftSaving) return
    setIsShiftOpen(false)
  }

  const openReportModal = () => {
    setIsReportOpen(true)
  }

  const closeReportModal = () => {
    if (isReportGenerating) return
    setIsReportOpen(false)
  }

  const handleShiftChange = (field) => (e) => {
    const value = e.target.value
    setShiftForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const saveShiftTimes = async () => {
    const base = {
      manpowerDayStart: shiftTimes?.manpowerDayStart || '',
      manpowerDayEnd: shiftTimes?.manpowerDayEnd || '',
      manpowerNightStart: shiftTimes?.manpowerNightStart || '',
      manpowerNightEnd: shiftTimes?.manpowerNightEnd || '',
      permanentDayStart: shiftTimes?.permanentDayStart || '',
      permanentDayEnd: shiftTimes?.permanentDayEnd || '',
      permanentNightStart: shiftTimes?.permanentNightStart || '',
      permanentNightEnd: shiftTimes?.permanentNightEnd || '',
    }

    const payload = Object.entries(shiftForm).reduce((acc, [key, value]) => {
      if (value && value !== base[key]) acc[key] = value
      return acc
    }, {})

    if (Object.keys(payload).length === 0) {
      showToast('Nothing to update', 'warning')
      return
    }

    setIsShiftSaving(true)
    try {
      const updated = await upsertShiftTimes(payload)
      setShiftTimes(updated)
      showToast('Shift times updated', 'success')
      setIsShiftOpen(false)
    } catch (error) {
      console.error('Failed to update shift times', error)
      const msg = error?.response?.data?.message || error?.message || 'Failed to update shift times'
      showToast(msg, 'error')
    } finally {
      setIsShiftSaving(false)
    }
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
            shift: item.firstIn?.shift || item.lastOut?.shift || null,
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
          'Shift',
          'Status',
        ],
        rows: rows.map((row) => [
          row.workDate,
          row.employeeId,
          row.name,
          row.company,
          formatReportDateTime(row.checkIn),
          formatReportDateTime(row.checkOut),
          row.shift || '-',
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

  useEffect(() => {
    fetchShiftTimes()
  }, [])

  const openEdit = (row) => {
    setEditRow(row)
    setEditCheckIn(toTimeValue(row?.checkIn))
    setEditCheckOut(toTimeValue(row?.checkOut))
    setIsEditOpen(true)
  }

  const closeEdit = () => {
    if (isSaving) return
    setIsEditOpen(false)
    setEditRow(null)
    setEditCheckIn('')
    setEditCheckOut('')
  }

  const saveEdits = async () => {
    if (!editRow) return
    setIsSaving(true)
    try {
      const updates = []
      const baseDate = editRow.workDate || date

      if (editRow.checkInLogId) {
        const original = toTimeValue(editRow.checkIn)
        const iso = editCheckIn && editCheckIn !== original ? toIsoFromDateAndTime(baseDate, editCheckIn) : null
        if (iso) {
          updates.push(updateAttendanceLogScanTime(editRow.checkInLogId, iso))
        }
      } else if (editCheckIn) {
        const iso = toIsoFromDateAndTime(baseDate, editCheckIn)
        if (iso) {
          updates.push(
            createManualAttendanceLog({
              employeeId: editRow.employeeObjectId,
              companyId: editRow.companyObjectId,
              scanType: 'IN',
              scanTime: iso,
              workDate: baseDate,
            })
          )
        }
      }

      if (editRow.checkOutLogId) {
        const original = toTimeValue(editRow.checkOut)
        const iso = editCheckOut && editCheckOut !== original ? toIsoFromDateAndTime(baseDate, editCheckOut) : null
        if (iso) {
          updates.push(updateAttendanceLogScanTime(editRow.checkOutLogId, iso))
        }
      } else if (editCheckOut) {
        const iso = toIsoFromDateAndTime(baseDate, editCheckOut)
        if (iso) {
          updates.push(
            createManualAttendanceLog({
              employeeId: editRow.employeeObjectId,
              companyId: editRow.companyObjectId,
              scanType: 'OUT',
              scanTime: iso,
              workDate: baseDate,
            })
          )
        }
      }

      if (updates.length === 0) {
        showToast('Nothing to update', 'warning')
        return
      }

      await Promise.all(updates)
      showToast('Attendance times updated', 'success')
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
      accessor: (item) =>
        item.checkIn
          ? new Date(item.checkIn).toLocaleTimeString()
          : '-',
    },
    {
      header: 'Check Out',
      accessor: (item) =>
        item.checkOut
          ? new Date(item.checkOut).toLocaleTimeString()
          : '-',
    },
    {
      header: 'Shift',
      accessor: (item) => (
        <Badge
          variant={
            item.shift === 'DAY'
              ? 'success'
              : item.shift === 'NIGHT'
              ? 'warning'
              : 'outline'
          }
        >
          {item.shift || '—'}
        </Badge>
      ),
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

  const permDay = isShiftLoading ? '...' : formatShiftWindow(shiftTimes?.permanentDayStart, shiftTimes?.permanentDayEnd)
  const permNight = isShiftLoading ? '...' : formatShiftWindow(shiftTimes?.permanentNightStart, shiftTimes?.permanentNightEnd)
  const manDay = isShiftLoading ? '...' : formatShiftWindow(shiftTimes?.manpowerDayStart, shiftTimes?.manpowerDayEnd)
  const manNight = isShiftLoading ? '...' : formatShiftWindow(shiftTimes?.manpowerNightStart, shiftTimes?.manpowerNightEnd)

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
                  className="!border-green-200 !bg-green-100 !text-green-800 hover:!bg-green-200 focus:!ring-green-500"
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

            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="flex flex-col gap-2 text-sm text-slate-700">
                <div className="flex items-center gap-3">
                  <span className="font-medium w-24">Permanent:</span>
                  <Badge variant="outline">Day: {permDay}</Badge>
                  <Badge variant="outline">Night: {permNight}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium w-24">Manpower:</span>
                  <Badge variant="outline">Day: {manDay}</Badge>
                  <Badge variant="outline">Night: {manNight}</Badge>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={openShiftModal}
                disabled={isShiftLoading}
              >
                {shiftTimes ? 'Edit Shift Times' : 'Set Shift Times'}
              </Button>
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

      <Modal
        isOpen={isShiftOpen}
        onClose={closeShiftModal}
        title="Shift Times"
      >
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-slate-700 mb-3">Permanent Shifts</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Day Start"
                type="time"
                value={shiftForm.permanentDayStart}
                onChange={handleShiftChange('permanentDayStart')}
              />
              <Input
                label="Day End"
                type="time"
                value={shiftForm.permanentDayEnd}
                onChange={handleShiftChange('permanentDayEnd')}
              />
              <Input
                label="Night Start"
                type="time"
                value={shiftForm.permanentNightStart}
                onChange={handleShiftChange('permanentNightStart')}
              />
              <Input
                label="Night End"
                type="time"
                value={shiftForm.permanentNightEnd}
                onChange={handleShiftChange('permanentNightEnd')}
              />
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-slate-700 mb-3">Manpower Shifts</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Day Start"
                type="time"
                value={shiftForm.manpowerDayStart}
                onChange={handleShiftChange('manpowerDayStart')}
              />
              <Input
                label="Day End"
                type="time"
                value={shiftForm.manpowerDayEnd}
                onChange={handleShiftChange('manpowerDayEnd')}
              />
              <Input
                label="Night Start"
                type="time"
                value={shiftForm.manpowerNightStart}
                onChange={handleShiftChange('manpowerNightStart')}
              />
              <Input
                label="Night End"
                type="time"
                value={shiftForm.manpowerNightEnd}
                onChange={handleShiftChange('manpowerNightEnd')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeShiftModal} disabled={isShiftSaving}>
              Cancel
            </Button>
            <Button onClick={saveShiftTimes} isLoading={isShiftSaving}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

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
        title={editRow ? `Edit Times - ${editRow.name}` : 'Edit Times'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Check In Time"
              type="time"
              value={editCheckIn}
              onChange={(e) => setEditCheckIn(e.target.value)}
            />

            <Input
              label="Check Out Time"
              type="time"
              value={editCheckOut}
              onChange={(e) => setEditCheckOut(e.target.value)}
            />
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
