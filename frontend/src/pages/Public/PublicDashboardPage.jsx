import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, CalendarDays, ChevronLeft, ChevronRight, Users, Workflow } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import {
  getPublicDailyCheckInCount,
  getPublicDashboardSummary,
  getPublicEmployeeDailyIdleTime,
} from '../../services/public.service'
import {
  getManpowerDailyAverageHoursByCompany,
  getManpowerDailyHoursByCompany,
  getManpowerMonthlyHoursByCompany,
} from '../../services/analytics.service'

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

const normalizeEmployeeType = (value) => value?.toLowerCase().replace(/\s+/g, '') || ''

const isYyyyMmDd = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)

const parseYyyyMmDd = (value) => {
  if (!isYyyyMmDd(value)) return new Date()

  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const formatYyyyMmDd = (dateValue) => (
  `${dateValue.getFullYear()}-${pad2(dateValue.getMonth() + 1)}-${pad2(dateValue.getDate())}`
)

const formatDisplayDate = (value) => {
  const dateValue = parseYyyyMmDd(value)
  return dateValue.toLocaleDateString('en-GB')
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
    return <div className="text-slate-500 text-sm">No data for selected month.</div>
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
    rose: { accent: 'border-l-rose-500', gradient: 'from-rose-50' },
  }

  const styles = toneStyles[tone] ?? toneStyles.slate

  return (
    <Card className={`p-5 border border-slate-200 border-l-4 ${styles.accent} bg-linear-to-br ${styles.gradient} to-white`}>
      <p className="text-xs font-semibold tracking-wide text-slate-600 uppercase">{title}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </Card>
  )
}

const EmployeeBreakdownItem = ({ label, value, total, tone = 'slate' }) => {
  const toneStyles = {
    amber: { dot: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-700' },
    emerald: { dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-700' },
    rose: { dot: 'bg-rose-500', bar: 'bg-rose-500', text: 'text-rose-700' },
    slate: { dot: 'bg-slate-500', bar: 'bg-slate-500', text: 'text-slate-700' },
  }
  const styles = toneStyles[tone] ?? toneStyles.slate
  const percent = total > 0 ? Math.round((Number(value) / total) * 100) : 0

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`} />
          <span className="truncate text-sm font-medium text-slate-700">{label}</span>
        </div>
        <span className={`shrink-0 text-lg font-semibold tabular-nums ${styles.text}`}>
          {value}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

const SummaryTile = ({ title, value, caption, icon: Icon, tone = 'blue' }) => {
  const toneStyles = {
    blue: { shell: 'bg-blue-50 text-blue-700 ring-blue-100', border: 'border-t-blue-500' },
    purple: { shell: 'bg-purple-50 text-purple-700 ring-purple-100', border: 'border-t-purple-500' },
  }
  const styles = toneStyles[tone] ?? toneStyles.blue

  return (
    <div className={`rounded-lg border border-slate-200 border-t-4 ${styles.border} bg-white p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums text-slate-950">{value}</p>
        </div>
        <div className={`rounded-md p-2.5 ring-1 ${styles.shell}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-500">{caption}</p>
    </div>
  )
}

const DashboardSummary = ({ summary }) => {
  const employees = summary?.employees ?? {}
  const totalEmployees = employees.total ?? 0
  const manpowerEmployees = employees.manpower ?? 0
  const permanentEmployees = employees.permanent ?? 0
  const casualEmployees = employees.casual ?? 0

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm xl:col-span-7">
        <div className="flex flex-col gap-5 border-b border-slate-200 bg-white p-5 text-slate-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-slate-50 p-3 text-slate-700 ring-1 ring-slate-200">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Employee Summary</p>
              <p className="mt-1 text-2xl font-semibold">Registered Employees</p>
            </div>
          </div>

          <div className="sm:text-right">
            <p className="text-sm text-slate-600">Total Employees</p>
            <p className="mt-1 text-5xl font-semibold tabular-nums">{totalEmployees}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-3">
          <EmployeeBreakdownItem
            label="Manpower"
            value={manpowerEmployees}
            total={totalEmployees}
            tone="amber"
          />
          <EmployeeBreakdownItem
            label="Permanent"
            value={permanentEmployees}
            total={totalEmployees}
            tone="emerald"
          />
          <EmployeeBreakdownItem
            label="Casual"
            value={casualEmployees}
            total={totalEmployees}
            tone="rose"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:col-span-5">
        <SummaryTile
          title="Processes"
          value={summary?.processes ?? 0}
          caption="Active production process records"
          icon={Workflow}
          tone="blue"
        />
        <SummaryTile
          title="Manpower Companies"
          value={summary?.manpowerCompanies ?? 0}
          caption="Companies registered for manpower"
          icon={Building2}
          tone="purple"
        />
      </div>
    </section>
  )
}

const DailyDatePicker = ({ value, onChange, onOpenChange }) => {
  const selectedDate = parseYyyyMmDd(value)
  const [isOpen, setIsOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  )
  const pickerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
    }
  }, [isOpen, value])

  useEffect(() => {
    onOpenChange?.(isOpen)
  }, [isOpen, onOpenChange])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const monthLabel = visibleMonth.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - monthStart.getDay())

  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + index)
    return day
  })

  const goToPreviousMonth = () => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
  }

  const selectDate = (day) => {
    onChange(formatYyyyMmDd(day))
    setIsOpen(false)
  }

  return (
    <div ref={pickerRef} className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-1">Daily Date</label>
      <button
        type="button"
        className="flex h-10 w-52 items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm transition hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{formatDisplayDate(value)}</span>
        <CalendarDays className="h-4 w-4 text-slate-500" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-md border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              onClick={goToPreviousMonth}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold text-slate-900">{monthLabel}</div>
            <button
              type="button"
              className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              onClick={goToNextMonth}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((dayLabel) => (
              <div key={dayLabel}>{dayLabel}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const dayValue = formatYyyyMmDd(day)
              const isSelected = dayValue === value
              const isVisibleMonth = day.getMonth() === visibleMonth.getMonth()

              return (
                <button
                  key={dayValue}
                  type="button"
                  className={`h-8 rounded-md text-sm transition ${
                    isSelected
                      ? 'bg-blue-600 font-semibold text-white'
                      : isVisibleMonth
                        ? 'text-slate-900 hover:bg-blue-50'
                        : 'text-slate-400 hover:bg-slate-50'
                  }`}
                  onClick={() => selectDate(day)}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export const PublicDashboardPage = () => {
  const [summary, setSummary] = useState(null)
  const [date, setDate] = useState(todayYyyyMmDd())
  const [month, setMonth] = useState(currentYyyyMm())
  const [checkInCount, setCheckInCount] = useState(0)
  const isDailyDatePickerActive = useRef(false)

  const [dailyRows, setDailyRows] = useState([])
  const [dailyAvgRows, setDailyAvgRows] = useState([])
  const [idleRows, setIdleRows] = useState([])
  const [monthlyRows, setMonthlyRows] = useState([])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const idleCounts = useMemo(() => {
    const manpower = idleRows.filter((row) => normalizeEmployeeType(row.employeeType) === 'manpower').length
    const permanent = idleRows.filter((row) => normalizeEmployeeType(row.employeeType) === 'permanent').length
    const casual = idleRows.filter((row) => normalizeEmployeeType(row.employeeType) === 'casual').length
    return { manpower, permanent, casual, total: idleRows.length }
  }, [idleRows])

  const load = async (shouldUpdate = () => true, showLoader = true) => {
    if (showLoader) setIsLoading(true)
    setError('')
    try {
      const [summaryData, daily, dailyAvg, idle, monthly, checkInData] = await Promise.all([
        getPublicDashboardSummary(),
        getManpowerDailyHoursByCompany(date),
        getManpowerDailyAverageHoursByCompany(date),
        getPublicEmployeeDailyIdleTime(date),
        getManpowerMonthlyHoursByCompany(month),
        getPublicDailyCheckInCount(date),
      ])

      if (!shouldUpdate()) return

      setSummary(summaryData)
      setDailyRows(Array.isArray(daily) ? daily : [])
      setDailyAvgRows(Array.isArray(dailyAvg) ? dailyAvg : [])
      setIdleRows(Array.isArray(idle) ? idle : [])
      setMonthlyRows(Array.isArray(monthly) ? monthly : [])
      setCheckInCount(Number(checkInData?.count) || 0)
    } catch (e) {
      if (!shouldUpdate()) return
      setSummary(null)
      setDailyRows([])
      setDailyAvgRows([])
      setIdleRows([])
      setMonthlyRows([])
      setCheckInCount(0)
      setError(e?.response?.data?.message || e?.message || 'Failed to load dashboard')
    } finally {
      if (showLoader && shouldUpdate()) setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const shouldUpdate = () => isMounted

    load(shouldUpdate)
    const refreshInterval = window.setInterval(() => {
      if (isDailyDatePickerActive.current) return
      load(shouldUpdate, false)
    }, 60000)

    return () => {
      isMounted = false
      window.clearInterval(refreshInterval)
    }
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
      accessor: (row) => formatHours(row.presenceHours),
      className: 'text-right',
    },
    {
      header: 'Work (hrs)',
      accessor: (row) => formatHours(row.workHours),
      className: 'text-right',
    },
    {
      header: 'Break (hrs)',
      accessor: (row) => formatHours(row.breakHours),
      className: 'text-right',
    },
    {
      header: 'Idle (hrs)',
      accessor: (row) => formatHours(row.idleHours),
      className: 'text-right',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div className="text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase">
              SCAN
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
              Employee Efficiency System
            </h1>
            <p className="mt-1 text-slate-600">Public dashboard and analytics</p>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-md px-4 py-3 text-sm mb-6">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <Card title="Loading">
            <Spinner />
          </Card>
        ) : (
          <>
            <DashboardSummary summary={summary} />

            <Card className="mt-8 p-5" title={null}>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">Analytics</h2>
                  <p className="text-slate-600">Employee Efficiency System • Manpower work hours (company-wise)</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <DailyDatePicker
                    value={date}
                    onChange={setDate}
                    onOpenChange={(isOpen) => {
                      isDailyDatePickerActive.current = isOpen
                    }}
                  />
                  <Input
                    label="Monthly"
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-auto"
                  />
                  <Button variant="outline" onClick={() => load()} disabled={isLoading}>
                    Refresh
                  </Button>
                </div>
              </div>
            </Card>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title={`Check-in Persons — ${date}`} value={checkInCount} tone="indigo" />
              <StatCard title={`Idle Manpower — ${date}`} value={idleCounts.manpower} tone="amber" />
              <StatCard title={`Idle Permanent — ${date}`} value={idleCounts.permanent} tone="emerald" />
              <StatCard title={`Idle Casual — ${date}`} value={idleCounts.casual} tone="rose" />
            </div>

            <div className="mt-6 flex flex-col gap-6">
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

              <Card title={`Daily employee idle time — ${date}`}>
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}
