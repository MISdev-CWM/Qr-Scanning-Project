import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Table } from '../../components/ui/Table'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ReportModal } from '../../components/features/ReportModal'
import { useToast } from '../../hooks/useToast'
import { getOTSummary } from '../../services/attendance.service'

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

const formatOtDuration = (decimalHours) => {
  const hoursValue = Number(decimalHours)
  if (!Number.isFinite(hoursValue) || hoursValue <= 0) return '0 hrs'

  const totalMinutes = Math.round(hoursValue * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes} mins`
  if (minutes === 0) return `${hours} hrs`
  return `${hours} hrs ${minutes} mins`
}

const formatShiftLabel = (shift) => {
  if (shift === 'NORMAL') return 'DAY'
  if (shift === 'SATURDAY_DAY') return 'SATURDAY DAY'
  if (shift === 'SATURDAY_NIGHT') return 'SATURDAY NIGHT'
  return shift || '—'
}

export const OTHoursPage = () => {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [date, setDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [summary, setSummary] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isReportGenerating, setIsReportGenerating] = useState(false)

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
    fetchSummary()
  }, [date])

  const openReportModal = () => setIsReportOpen(true)

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
          formatShiftLabel(item.shift),
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
              : item.shift === 'NORMAL'
                ? 'success'
                : item.shift === 'SPECIAL'
                  ? 'danger'
                  : item.shift === 'NIGHT'
                    ? 'warning'
                    : 'outline'
          }
        >
          {formatShiftLabel(item.shift)}
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
            {formatOtDuration(otHours)}
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
          <p className="text-sm text-slate-500 mb-5">
            Note: Permanent employees on the <span className="font-medium text-amber-700">SPECIAL shift</span> do
            not earn OT regardless of checkout time.
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={openReportModal}
              className="!border-green-200 !bg-green-100 !text-green-800 hover:!bg-green-200 focus:!ring-green-500"
            >
              Generate Report
            </Button>

            <Button
              variant="outline"
              type="button"
              onClick={() => navigate('/ot-hours/edit-rates')}
            >
              Edit OT Rates
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
    </DashboardLayout>
  )
}
