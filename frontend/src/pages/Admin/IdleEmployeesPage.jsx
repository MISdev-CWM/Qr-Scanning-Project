import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Table } from '../../components/ui/Table'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useToast } from '../../hooks/useToast'
import { getCurrentIdleEmployees } from '../../services/analytics.service'

const pad2 = (n) => String(n).padStart(2, '0')

const todayYyyyMmDd = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

const formatHours = (value) => {
  const n = Number(value)
  if (Number.isNaN(n)) return '0.00'
  return n.toFixed(2)
}

const formatTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const IdleEmployeesPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()

  const initialDate = searchParams.get('date') || todayYyyyMmDd()
  const [date, setDate] = useState(initialDate)
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const load = async () => {
    setIsLoading(true)
    try {
      const data = await getCurrentIdleEmployees(date)
      setRows(Array.isArray(data) ? data : [])
    } catch (error) {
      setRows([])
      const msg = error?.response?.data?.message || error?.message || 'Failed to load In-Transition employees'
      showToast(msg, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const idleOnlyRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows])

  const columns = [
    {
      header: 'Employee',
      accessor: (row) => row.employeeName || '—',
    },
    {
      header: 'Employee Code',
      accessor: (row) => row.employeeCode || '—',
    },
    {
      header: 'Company',
      accessor: (row) => row.companyName || '—',
    },
    {
      header: 'Status',
      accessor: () => <Badge variant="warning">In-Transition</Badge>,
      className: 'whitespace-nowrap',
    },
    {
      header: 'In-Transition Since',
      accessor: (row) => formatTime(row.idleSince),
      className: 'text-right whitespace-nowrap',
    },
    {
      header: 'Last Process',
      accessor: (row) => row.lastProcessName || '—',
    },
    {
      header: 'In-Transition (min)',
      accessor: (row) => (Number.isFinite(Number(row.idleMinutes)) ? Math.round(Number(row.idleMinutes)) : 0),
      className: 'text-right whitespace-nowrap',
    },
    {
      header: 'In-Transition (hrs)',
      accessor: (row) => formatHours(row.idleHours),
      className: 'text-right whitespace-nowrap',
    },
  ]

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">In-Transition Employees</h1>
            <p className="text-slate-600">In-Transition time calculated from attendance + work sessions</p>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/work-sessions')}>
              Back to Work Sessions
            </Button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="w-full sm:max-w-xs">
              <Input
                label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={load} disabled={isLoading}>
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <Table
          data={idleOnlyRows}
          columns={columns}
          keyExtractor={(row) => row.employeeId}
          isLoading={isLoading}
          emptyMessage={date ? `No In-Transition employees found for ${date}` : 'No In-Transition employees found'}
        />
      </div>
    </DashboardLayout>
  )
}
