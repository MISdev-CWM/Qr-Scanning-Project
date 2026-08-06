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
import { getWorkSessions } from '../../services/workSession.service'

const pad2 = (n) => String(n).padStart(2, '0')

const todayYyyyMmDd = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

const currentYyyyMm = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}

const formatHours = (value) => {
  const n = Number(value)
  if (Number.isNaN(n)) return '0.00'
  return n.toFixed(2)
}

const formatHoursMinutes = (minutesValue, hoursValue) => {
  const hasMinutes = minutesValue !== undefined && minutesValue !== null && minutesValue !== ''
  const rawMinutes = hasMinutes ? Number(minutesValue) : Number(hoursValue) * 60
  const totalMinutes = Number.isFinite(rawMinutes) ? Math.max(0, Math.round(rawMinutes)) : 0
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${hours}.${pad2(minutes)}`
}

const getSessionEmployeeKeys = (session) => {
  const employee = session?.employeeId
  return [
    employee?._id,
    employee?.employeeId,
    typeof employee === 'string' ? employee : null,
  ]
    .filter(Boolean)
    .map(String)
}

const minutesBetween = (startValue, endValue) => {
  const start = new Date(startValue)
  const end = new Date(endValue)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0

  const minutes = (end.getTime() - start.getTime()) / 60000
  return minutes > 0 ? minutes : 0
}

const applyActiveWorkSessionsToIdleRows = (idleRows, workSessions) => {
  const safeIdleRows = Array.isArray(idleRows) ? idleRows : []
  const safeWorkSessions = Array.isArray(workSessions) ? workSessions : []
  const now = new Date()
  const activeSessionsByEmployee = new Map()

  safeWorkSessions
    .filter((session) => session?.startTime && !session?.endTime)
    .forEach((session) => {
      getSessionEmployeeKeys(session).forEach((key) => {
        const list = activeSessionsByEmployee.get(key) || []
        list.push(session)
        activeSessionsByEmployee.set(key, list)
      })
    })

  if (activeSessionsByEmployee.size === 0) return safeIdleRows

  return safeIdleRows.map((row) => {
    const rowKeys = [row.employeeId, row.employeeCode].filter(Boolean).map(String)
    const activeSessionMap = new Map()

    rowKeys
      .flatMap((key) => activeSessionsByEmployee.get(key) || [])
      .forEach((session, index) => {
        activeSessionMap.set(String(session?._id || session?.id || index), session)
      })

    const activeSessions = Array.from(activeSessionMap.values())

    if (activeSessions.length === 0) return row

    const activeWorkMinutes = activeSessions.reduce(
      (total, session) => total + minutesBetween(session.startTime, now),
      0
    )
    const workMinutes = (Number(row.workMinutes) || 0) + activeWorkMinutes
    const idleMinutes = Math.max((Number(row.idleMinutes) || 0) - activeWorkMinutes, 0)

    return {
      ...row,
      workMinutes,
      idleMinutes,
      workHours: workMinutes / 60,
      idleHours: idleMinutes / 60,
    }
  })
}

const AttendanceDateTimeCell = ({ value }) => {
  if (!value) return '—'

  const dateValue = new Date(value)
  if (Number.isNaN(dateValue.getTime())) return '—'

  return (
    <div className="leading-tight">
      <div className="text-slate-900">{dateValue.toLocaleTimeString()}</div>
      <div className="mt-1 text-xs text-slate-500">
        {dateValue.toLocaleDateString('en-GB')}
      </div>
    </div>
  )
}

const MonthlyBarChart = ({ rows }) => {
  const safeRows = Array.isArray(rows) ? rows : []

  const maxHours = useMemo(() => {
    const hours = safeRows.map((r) => Number(r.totalHours) || 0)
    return Math.max(0, ...hours)
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
            const hours = Number(row.totalHours) || 0
            const widthPct = maxHours > 0 ? (hours / maxHours) * 100 : 0
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
                      title={`${row.companyName}: ${formatHours(hours)} hours`}
                    />
                  </div>
                </div>

                <div className="col-span-2 text-right">
                  <span className="text-xs text-slate-700 tabular-nums">
                    {formatHours(hours)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Bars show monthly manpower work hours by company.
      </div>
    </div>
  )
}

const StatCard = ({ title, value, tone = 'slate' }) => {
  const toneStyles = {
    slate: { accent: 'border-l-slate-300', gradient: 'from-slate-50' },
    indigo: { accent: 'border-l-indigo-500', gradient: 'from-indigo-50' },
    amber: { accent: 'border-l-amber-500', gradient: 'from-amber-50' },
    emerald: { accent: 'border-l-emerald-500', gradient: 'from-emerald-50' },
    blue: { accent: 'border-l-blue-500', gradient: 'from-blue-50' },
    purple: { accent: 'border-l-purple-500', gradient: 'from-purple-50' },
  }

  const styles = toneStyles[tone] ?? toneStyles.slate

  return (
    <Card className={`p-5 border border-slate-200 border-l-4 ${styles.accent} bg-linear-to-br ${styles.gradient} to-white`}>
      <p className="text-xs font-semibold tracking-wide text-slate-600 uppercase">{title}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
    </Card>
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
      const [daily, dailyAvg, idle, monthly, summaryData, workSessions] = await Promise.all([
        getManpowerDailyHoursByCompany(date),
        getManpowerDailyAverageHoursByCompany(date),
        getEmployeeDailyIdleTime(date),
        getManpowerMonthlyHoursByCompany(month),
        getPublicDashboardSummary(),
        getWorkSessions({ date }),
      ])

      setDailyRows(Array.isArray(daily) ? daily : [])
      setDailyAvgRows(Array.isArray(dailyAvg) ? dailyAvg : [])
      setIdleRows(applyActiveWorkSessionsToIdleRows(idle, workSessions))
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
      header: 'Total Hours',
      accessor: (row) => formatHours(row.totalHours),
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
      header: 'Avg Hours / Session',
      accessor: (row) => formatHours(row.averageHoursPerSession),
      className: 'text-right',
    },
    {
      header: 'Total Hours',
      accessor: (row) => formatHours(row.totalHours),
      className: 'text-right',
    },
  ]

  const monthlyColumns = [
    { header: 'Company', accessor: 'companyName' },
    {
      header: 'Monthly Hours',
      accessor: (row) => formatHours(row.totalHours),
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
      header: 'Employee Code',
      accessor: (row) => row.employeeCode || '—',
    },
    {
      header: 'Type',
      accessor: (row) => row.employeeType || '—',
    },
    {
      header: 'Company',
      accessor: (row) => row.companyName || '—',
    },
    {
      header: 'Check In',
      accessor: (row) => <AttendanceDateTimeCell value={row.checkInTime} />,
      className: 'text-right',
    },
    {
      header: 'Check Out',
      accessor: (row) => (row.isCheckedOut ? <AttendanceDateTimeCell value={row.checkOutTime} /> : '—'),
      className: 'text-right',
    },
    {
      header: 'Presence (hrs)',
      accessor: (row) => formatHoursMinutes(row.presenceMinutes, row.presenceHours),
      className: 'text-right',
    },
    {
      header: 'Work (hrs)',
      accessor: (row) => formatHoursMinutes(row.workMinutes, row.workHours),
      className: 'text-right',
    },
    {
      header: 'Break (hrs)',
      accessor: (row) => formatHoursMinutes(row.breakMinutes, row.breakHours),
      className: 'text-right',
    },
    {
      header: 'In-Transition (hrs)',
      accessor: (row) => formatHoursMinutes(row.idleMinutes, row.idleHours),
      className: 'text-right',
    },
  ]

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
            <p className="text-slate-600">Manpower work hours and In-Transition analytics (company-wise)</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <StatCard title="Employees (Total)" value={summary?.employees?.total ?? 0} tone="indigo" />
              <StatCard title="Employees (Manpower)" value={summary?.employees?.manpower ?? 0} tone="amber" />
              <StatCard title="Employees (Permanent)" value={summary?.employees?.permanent ?? 0} tone="emerald" />
              <StatCard title="Processes" value={summary?.processes ?? 0} tone="blue" />
              <StatCard title="Manpower Companies" value={summary?.manpowerCompanies ?? 0} tone="purple" />
            </div>

            <Card title={`Daily manpower work hours (Company-wise) — ${date}`}>
              <Table
                data={dailyRows}
                columns={dailyColumns}
                keyExtractor={(row) => row.companyId || row.companyName}
                emptyMessage="No manpower sessions for this date"
              />
            </Card>

            <Card title={`Daily average manpower work hours (Company-wise) — ${date}`}>
              <Table
                data={dailyAvgRows}
                columns={dailyAvgColumns}
                keyExtractor={(row) => row.companyId || row.companyName}
                emptyMessage="No manpower sessions for this date"
              />
            </Card>

            <Card title={`Daily employee In-Transition time — ${date}`}>
              <Table
                data={idleRows}
                columns={idleColumns}
                keyExtractor={(row) => row.employeeId || row.employeeName}
                emptyMessage="No attendance records for this date"
              />
            </Card>

            <Card title={`Monthly manpower work hours (Company-wise) — ${month}`}>
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
