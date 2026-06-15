import React, { useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Table } from '../../components/ui/Table'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ReportModal } from '../../components/features/ReportModal'
import { useToast } from '../../hooks/useToast'
import { getOTSummary } from '../../services/attendance.service'
import { getShiftTimes, upsertShiftTimes } from '../../services/shiftTime.service'

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

export const OTHoursPage = () => {
  const { showToast } = useToast()
  const [date, setDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [summary, setSummary] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [shiftTimes, setShiftTimes] = useState(null)
  const [isShiftLoading, setIsShiftLoading] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isReportGenerating, setIsReportGenerating] = useState(false)
  
  const [otForm, setOtForm] = useState({
    manpowerDayOtStart: '17:00',
    manpowerDayOtEnd: '20:00',
    manpowerNightOtStart: '05:00',
    manpowerNightOtEnd: '08:00',
    permanentDayOtStart: '17:00',
    permanentDayOtEnd: '20:00',
    permanentNightOtStart: '05:00',
    permanentNightOtEnd: '08:00',
  })

  const fetchShiftData = async () => {
    setIsShiftLoading(true)
    try {
      const data = await getShiftTimes()
      if (data) {
        setShiftTimes(data)
        setOtForm({
          manpowerDayOtStart: data.manpowerDayOtStart || '17:00',
          manpowerDayOtEnd: data.manpowerDayOtEnd || '20:00',
          manpowerNightOtStart: data.manpowerNightOtStart || '05:00',
          manpowerNightOtEnd: data.manpowerNightOtEnd || '08:00',
          permanentDayOtStart: data.permanentDayOtStart || '17:00',
          permanentDayOtEnd: data.permanentDayOtEnd || '20:00',
          permanentNightOtStart: data.permanentNightOtStart || '05:00',
          permanentNightOtEnd: data.permanentNightOtEnd || '08:00',
        })
      }
    } catch (error) {
      console.error('Failed to fetch shift times', error)
    } finally {
      setIsShiftLoading(false)
    }
  }

  const fetchSummary = async () => {
    setIsLoading(true)
    try {
      const data = await getOTSummary(date)
      if (!data || !Array.isArray(data)) {
        setSummary([])
        return
      }
      
      setSummary(data)
    } catch (error) {
      console.error('Failed to fetch OT summary', error)
      showToast('Failed to fetch OT summary', 'error')
      setSummary([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchShiftData()
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [date])

  const openEditModal = () => {
    setOtForm({
      manpowerDayOtStart: shiftTimes?.manpowerDayOtStart || '17:00',
      manpowerDayOtEnd: shiftTimes?.manpowerDayOtEnd || '20:00',
      manpowerNightOtStart: shiftTimes?.manpowerNightOtStart || '05:00',
      manpowerNightOtEnd: shiftTimes?.manpowerNightEnd || '08:00',
      permanentDayOtStart: shiftTimes?.permanentDayOtStart || '17:00',
      permanentDayOtEnd: shiftTimes?.permanentDayOtEnd || '20:00',
      permanentNightOtStart: shiftTimes?.permanentNightOtStart || '05:00',
      permanentNightOtEnd: shiftTimes?.permanentNightOtEnd || '08:00',
    })
    setIsEditModalOpen(true)
  }

  const openReportModal = () => {
    setIsReportOpen(true)
  }

  const closeReportModal = () => {
    if (isReportGenerating) return
    setIsReportOpen(false)
  }

  const handleOtChange = (field) => (e) => {
    setOtForm((prev) => ({
      ...prev,
      [field]: e.target.value,
    }))
  }

  const handleSaveRanges = async () => {
    setIsSaving(true)
    try {
      const payload = {
        manpowerDayStart: shiftTimes?.manpowerDayStart || '08:00',
        manpowerDayEnd: shiftTimes?.manpowerDayEnd || '17:00',
        manpowerNightStart: shiftTimes?.manpowerNightStart || '20:00',
        manpowerNightEnd: shiftTimes?.manpowerNightEnd || '05:00',
        permanentDayStart: shiftTimes?.permanentDayStart || '08:00',
        permanentDayEnd: shiftTimes?.permanentDayEnd || '17:00',
        permanentNightStart: shiftTimes?.permanentNightStart || '20:00',
        permanentNightEnd: shiftTimes?.permanentNightEnd || '05:00',
        ...otForm
      }
      const updated = await upsertShiftTimes(payload)
      setShiftTimes(updated)
      showToast('OT Ranges updated successfully', 'success')
      setIsEditModalOpen(false)
      // Refresh summary to recalculate OT hours
      fetchSummary()
    } catch (error) {
      console.error('Failed to save OT threshold', error)
      showToast('Failed to save OT threshold', 'error')
    } finally {
      setIsSaving(false)
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
      const responses = await Promise.all(reportDates.map((reportDate) => getOTSummary(reportDate)))
      const rows = responses.flatMap((data, index) => {
        if (!Array.isArray(data)) return []

        return data.map((item) => ({
          ...item,
          reportDate: item.firstIn?.workDate || item.lastOut?.workDate || reportDates[index],
        }))
      })

      if (rows.length === 0) {
        showToast('No OT records found for this date range', 'warning')
        return
      }

      showToast('OT hours report downloaded', 'success')
      return {
        headers: [
          'Date',
          'Employee ID',
          'Employee Name',
          'Company',
          'Employee Type',
          'Shift',
          'Check In',
          'Check Out',
          'Total Hours',
          'Shift End',
          'OT Hours',
        ],
        rows: rows.map((item) => [
          item.reportDate || '-',
          item.employee?.employeeId || 'N/A',
          item.employee?.name || 'Unknown',
          item.company?.companyName || 'N/A',
          item.employee?.employeeType || 'permanent',
          item.shift || '-',
          formatReportDateTime(item.firstIn?.scanTime),
          formatReportDateTime(item.lastOut?.scanTime),
          item.totalHours ?? '0.00',
          item.shiftEnd || 'Not Defined',
          item.otHours ?? '0.00',
        ]),
        fileName: `ot-hours-report-${startDate}-to-${endDate}.xlsx`,
        sheetName: 'OT Hours',
        columnWidths: [14, 18, 24, 24, 18, 12, 24, 24, 14, 14, 12],
      }
    } catch (error) {
      console.error('Failed to generate OT hours report', error)
      const msg = error?.response?.data?.message || error?.message || 'Failed to generate OT hours report'
      showToast(msg, 'error')
    } finally {
      setIsReportGenerating(false)
    }
  }

  const columns = [
    {
      header: 'Employee ID',
      accessor: (item) => item.employee?.employeeId || 'N/A',
    },
    {
      header: 'Employee',
      accessor: (item) => item.employee?.name || 'Unknown',
    },
    {
      header: 'Company / Type',
      accessor: (item) => (
        <div className="flex flex-col">
          <span>{item.company?.companyName || 'N/A'}</span>
          <span className="text-xs text-slate-500 capitalize">{item.employee?.employeeType || 'permanent'}</span>
        </div>
      ),
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
      header: 'Check In',
      accessor: (item) =>
        item.firstIn?.scanTime
          ? new Date(item.firstIn.scanTime).toLocaleTimeString()
          : '-',
    },
    {
      header: 'Check Out',
      accessor: (item) =>
        item.lastOut?.scanTime
          ? new Date(item.lastOut.scanTime).toLocaleTimeString()
          : '-',
    },
    {
      header: 'OT Hours',
      accessor: (item) => {
        const otHours = parseFloat(item.otHours || 0);
        return (
          <Badge
            variant={otHours > 0 ? 'warning' : 'outline'}
          >
            {otHours > 0 ? `${otHours} hrs` : '0 hrs'}
          </Badge>
        )
      },
    },
  ]

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            OT Hours Report
          </h1>
          <p className="text-slate-600">
            View employee overtime hours by shift and day
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={openReportModal}
              disabled={isEditModalOpen}
              className="!border-green-200 !bg-green-100 !text-green-800 hover:!bg-green-200 focus:!ring-green-500"
            >
              Generate Report
            </Button>

            <Button variant="outline" onClick={openEditModal}>
              Edit OT Ranges
            </Button>
          </div>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <Table
          data={summary}
          columns={columns}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyMessage="No attendance records for this date to calculate OT"
        />
      </div>

      <ReportModal
        isOpen={isReportOpen}
        onClose={closeReportModal}
        onGenerate={generateReport}
        isGenerating={isReportGenerating}
        initialDate={date}
      />

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit OT Time Ranges"
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
          <p className="text-sm text-slate-600">
            Define the specific time windows during which overtime is calculated.
          </p>
          
          <div>
            <h4 className="font-semibold text-slate-700 mb-3">Permanent Employee OT</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Day OT Start"
                type="time"
                value={otForm.permanentDayOtStart}
                onChange={handleOtChange('permanentDayOtStart')}
              />
              <Input
                label="Day OT End"
                type="time"
                value={otForm.permanentDayOtEnd}
                onChange={handleOtChange('permanentDayOtEnd')}
              />
              <Input
                label="Night OT Start"
                type="time"
                value={otForm.permanentNightOtStart}
                onChange={handleOtChange('permanentNightOtStart')}
              />
              <Input
                label="Night OT End"
                type="time"
                value={otForm.permanentNightOtEnd}
                onChange={handleOtChange('permanentNightOtEnd')}
              />
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-slate-700 mb-3">Manpower Employee OT</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Day OT Start"
                type="time"
                value={otForm.manpowerDayOtStart}
                onChange={handleOtChange('manpowerDayOtStart')}
              />
              <Input
                label="Day OT End"
                type="time"
                value={otForm.manpowerDayOtEnd}
                onChange={handleOtChange('manpowerDayOtEnd')}
              />
              <Input
                label="Night OT Start"
                type="time"
                value={otForm.manpowerNightOtStart}
                onChange={handleOtChange('manpowerNightOtStart')}
              />
              <Input
                label="Night OT End"
                type="time"
                value={otForm.manpowerNightOtEnd}
                onChange={handleOtChange('manpowerNightOtEnd')}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveRanges} isLoading={isSaving}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
