import React, { useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import {
  Users,
  Building2,
  Cpu,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getCompanies } from '../../services/company.service'
import { getProcesses } from '../../services/process.service'
import { getEmployees } from '../../services/employee.service'
import { getRecentAttendanceLogs } from '../../services/attendance.service'

const StatCard = ({ title, value, icon: Icon, tone = 'slate' }) => {
  const toneStyles = {
    slate: {
      border: 'border-slate-200',
      accentBorder: 'border-l-slate-300',
      iconBg: 'bg-slate-100',
      iconFg: 'text-slate-700',
      gradient: 'from-slate-50 to-white',
    },
    amber: {
      border: 'border-amber-200',
      accentBorder: 'border-l-amber-500',
      iconBg: 'bg-amber-100',
      iconFg: 'text-amber-700',
      gradient: 'from-amber-50 to-white',
    },
    indigo: {
      border: 'border-indigo-200',
      accentBorder: 'border-l-indigo-500',
      iconBg: 'bg-indigo-100',
      iconFg: 'text-indigo-700',
      gradient: 'from-indigo-50 to-white',
    },
    emerald: {
      border: 'border-emerald-200',
      accentBorder: 'border-l-emerald-500',
      iconBg: 'bg-emerald-100',
      iconFg: 'text-emerald-700',
      gradient: 'from-emerald-50 to-white',
    },
  }

  const styles = toneStyles[tone] ?? toneStyles.slate

  return (
    <Card
      className={`p-5 border ${styles.border} border-l-4 ${styles.accentBorder} bg-linear-to-br ${styles.gradient} transition-shadow hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        {Icon ? (
          <div
            className={`h-11 w-11 rounded-xl ${styles.iconBg} flex items-center justify-center ring-1 ring-black/5`}
          >
            <Icon className={`h-5 w-5 ${styles.iconFg}`} />
          </div>
        ) : null}
      </div>
    </Card>
  )
}

export const DashboardPage = () => {
  const [counts, setCounts] = useState({
    manpowerCompanies: 0,
    processes: 0,
    employees: 0,
  })
  const [recentAttendance, setRecentAttendance] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true

    const fetchCounts = async () => {
      setIsLoading(true)
      try {
        const [companiesRaw, processesRaw, employeesRaw, recentLogsRaw] =
          await Promise.all([
            getCompanies(),
            getProcesses(),
            getEmployees('all'),
            getRecentAttendanceLogs(10),
          ])

        const companies = Array.isArray(companiesRaw)
          ? companiesRaw
          : []
        const processes = Array.isArray(processesRaw)
          ? processesRaw
          : []
        const employees = Array.isArray(employeesRaw)
          ? employeesRaw
          : []

        const manpowerCompanies = companies.filter(
          (c) => c?.employeeTypeAllowed === 'manpower'
        ).length

        if (!isMounted) return
        setCounts({
          manpowerCompanies,
          processes: processes.length,
          employees: employees.length,
        })

        setRecentAttendance(Array.isArray(recentLogsRaw) ? recentLogsRaw : [])
      } catch (error) {
        console.error('Failed to fetch dashboard counts', error)
        if (isMounted) setRecentAttendance([])
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchCounts()
    return () => {
      isMounted = false
    }
  }, [])

  const columns = [
    {
      header: 'Employee',
      accessor: (item) => item?.employeeId?.name || item?.employeeId?.employeeId || '-',
    },
    {
      header: 'Company',
      accessor: (item) => item?.companyId?.companyName || '-',
    },
    {
      header: 'Type',
      accessor: (item) => (
        <Badge variant={item?.scanType === 'IN' ? 'success' : 'error'}>
          {item?.scanType || '-'}
        </Badge>
      ),
    },
    {
      header: 'Time',
      accessor: (item) => (item?.scanTime ? new Date(item.scanTime).toLocaleString() : '-'),
    },
  ]

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Dashboard
          </h1>
          <p className="text-slate-600">
            Overview of your workforce today
          </p>
        </div>

        {/* <div className="flex space-x-3">
          <Button
            variant="secondary"
            onClick={() => navigate('/attendance')}
          >
            <QrCode className="w-4 h-4 mr-2" />
            Scan Attendance
          </Button>

          <Button onClick={() => navigate('/employees')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div> */}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-32 bg-slate-200 rounded-lg"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Manpower Companies"
            value={counts.manpowerCompanies}
            icon={Building2}
            tone="amber"
          />
          <StatCard
            title="Processes"
            value={counts.processes}
            icon={Cpu}
            tone="indigo"
          />
          <StatCard
            title="Employees"
            value={counts.employees}
            icon={Users}
            tone="emerald"
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Recent Attendance
          </h3>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/attendance')}
          >
            View All
          </Button>
        </div>

        <Table
          data={recentAttendance}
          columns={columns}
          keyExtractor={(item) => item?._id}
          isLoading={isLoading}
          emptyMessage="No attendance records for today"
        />
      </div>
    </DashboardLayout>
  )
}
