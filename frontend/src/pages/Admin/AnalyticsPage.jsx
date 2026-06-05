import React, { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import {
  getEmployeeDailyIdleTime,
  getManpowerDailyAverageHoursByCompany,
  getManpowerDailyHoursByCompany,
  getManpowerMonthlyHoursByCompany,
} from '../../services/analytics.service'
import { getPublicDashboardSummary } from '../../services/public.service'

const pad2 = (n) => String(n).padStart(2, '0')

const todayYyyyMmDd = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

const currentYyyyMm = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}

const formatMinutes = (value) => {
  const n = Number(value)
  if (Number.isNaN(n)) return '0'
  return String(Math.round(n * 60))
}

const formatTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const MonthlyBarChart = ({ rows }) => {
  const safeRows = Array.isArray(rows) ? rows : []

  const maxMinutes = useMemo(() => {
    const minutes = safeRows.map((r) => Number(r.totalHours) || 0)
    return Math.max(0, ...minutes)
  }, [safeRows])

  if (safeRows.length === 0) {
    return (
      <div className="text-slate-500 text-sm">No data for selected month.</div>
    )
  }

  const palette = [
    'bg-blue-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-purple-600',
    'bg-rose-600',
    'bg-cyan-600',
  ]

  return (
    <div className="w-full">
      <div className="border border-slate-200 rounded-md p-4 bg-slate-50 overflow-x-auto">
        <div className="min-w-130 flex flex-col gap-3">
          {safeRows.map((row, idx) => {
            const minutes = Number(row.totalHours) || 0
            const widthPct = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0
            const color = palette[idx % palette.length]
            const key = row.companyId || row.companyName || idx

            return (
              <div key={key} className="grid grid-cols-12 items-center gap-3">
                <div className="col-span-4 sm:col-span-3 min-w-0">
                  <div
                    className="text-xs font-medium text-slate-700 truncate"
                    title={row.companyName}
                  >
                    {row.companyName}
                  </div>
                </div>

                <div className="col-span-6 sm:col-span-7">
                  <div className="h-3 w-full bg-white border border-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color}`}
                      style={{ width: `${widthPct}%` }}
                      title={`${row.companyName}: ${formatMinutes(minutes)} minutes`}
                    />
                  </div>
                </div>

                <div className="col-span-2 text-right">
                  <span className="text-xs text-slate-700 tabular-nums">
                    {formatMinutes(minutes)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Bars show monthly manpower work time in minutes by company.
      </div>
    </div>
  )
}

export const AnalyticsPage = () => {
  const [date, setDate] = useState(todayYyyyMmDd())
  const [month, setMonth] = useState(currentYyyyMm())

  const [dailyRows, setDailyRows] = useState([])
  const [dailyAvgRows, setDailyAvgRows] = useState([])
  const [idleRows, setIdleRows] = useState([])
  const [monthlyRows, setMonthlyRows] = useState([])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)

  

  const load = async () => {
    setIsLoading(true)
    setError('')

    try {
      const [daily, dailyAvg, idle, monthly, summaryData] = await Promise.all([
        getManpowerDailyHoursByCompany(date),
        getManpowerDailyAverageHoursByCompany(date),
        getEmployeeDailyIdleTime(date),
        getManpowerMonthlyHoursByCompany(month),
        getPublicDashboardSummary(),
      ])

      setDailyRows(Array.isArray(daily) ? daily : [])
      setDailyAvgRows(Array.isArray(dailyAvg) ? dailyAvg : [])
      setIdleRows(Array.isArray(idle) ? idle : [])
      setMonthlyRows(Array.isArray(monthly) ? monthly : [])
      setSummary(summaryData)
    } catch (e) {
      setDailyRows([])
      setDailyAvgRows([])
      setIdleRows([])
      setMonthlyRows([])
      setSummary(null)
      setError(e?.response?.data?.message || e?.message || 'Failed to load analytics')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, month])

  const dailyColumns = [
    { header: 'Company', accessor: 'companyName' },
    {
      header: 'Total Minutes',
      accessor: (row) => formatMinutes(row.totalHours),
      className: 'text-right',
    },
    {
      header: 'Sessions',
      accessor: (row) => row.sessionCount ?? 0,
      className: 'text-right',
    },
  ]

  const dailyAvgColumns = [
    { header: 'Company', accessor: 'companyName' },
    {
      header: 'Avg Minutes / Session',
      accessor: (row) => formatMinutes(row.averageHoursPerSession),
      className: 'text-right',
    },
    {
      header: 'Total Minutes',
      accessor: (row) => formatMinutes(row.totalHours),
      className: 'text-right',
    },
  ]

  const monthlyColumns = [
    { header: 'Company', accessor: 'companyName' },
    {
      header: 'Monthly Minutes',
      accessor: (row) => formatMinutes(row.totalHours),
      className: 'text-right',
    },
    {
      header: 'Sessions',
      accessor: (row) => row.sessionCount ?? 0,
      className: 'text-right',
    },
  ]

  const idleColumns = [
    {
      header: 'Employee',
      accessor: (row) => row.employeeName || '—',
    },
    {
      header: 'Company',
      accessor: (row) => row.companyName || '—',
    },
    {
      header: 'Check In',
      accessor: (row) => formatTime(row.checkInTime),
      className: 'text-right',
    },
    {
      header: 'Check Out',
      accessor: (row) => (row.isCheckedOut ? formatTime(row.checkOutTime) : '—'),
      className: 'text-right',
    },
    {
      header: 'Presence (min)',
      accessor: (row) => formatMinutes(row.presenceHours),
      className: 'text-right',
    },
    {
      header: 'Work (min)',
      accessor: (row) => formatMinutes(row.workHours),
      className: 'text-right',
    },
    {
      header: 'Break (min)',
      accessor: (row) => formatMinutes(row.breakHours),
      className: 'text-right',
    },
    {
      header: 'Idle (min)',
      accessor: (row) => formatMinutes(row.idleHours),
      className: 'text-right',
    },
  ]

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
            <p className="text-slate-600">Manpower work time in minutes (company-wise)</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <Input
              label="Daily Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-auto"
            />
            <Input
              label="Monthly"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-auto"
            />
            <Button variant="outline" onClick={load} disabled={isLoading}>
              Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <Card title="Loading">
            <Spinner />
          </Card>
        ) : (
          <>
            <Card title={`Daily manpower work time in minutes (Company-wise) — ${date}`}>
              <Table
                data={dailyRows}
                columns={dailyColumns}
                keyExtractor={(row) => row.companyId || row.companyName}
                emptyMessage="No manpower sessions for this date"
              />
            </Card>

            <Card title={`Daily average manpower work time in minutes (Company-wise) — ${date}`}>
              <Table
                data={dailyAvgRows}
                columns={dailyAvgColumns}
                keyExtractor={(row) => row.companyId || row.companyName}
                emptyMessage="No manpower sessions for this date"
              />
            </Card>

            <Card title={`Daily employee idle time in minutes — ${date}`}>
              <Table
                data={idleRows}
                columns={idleColumns}
                keyExtractor={(row) => row.employeeId || row.employeeName}
                emptyMessage="No attendance records for this date"
              />
            </Card>

            <Card title={`Monthly manpower work time in minutes (Company-wise) — ${month}`}>
              <div className="mb-6">
                <MonthlyBarChart rows={monthlyRows} />
              </div>
              <Table
                data={monthlyRows}
                columns={monthlyColumns}
                keyExtractor={(row) => row.companyId || row.companyName}
                emptyMessage="No manpower sessions for this month"
              />
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
