import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Table } from '../../components/ui/Table'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { ReportModal } from '../../components/features/ReportModal'
import { useToast } from '../../hooks/useToast'
import { getWorkSessions, updateWorkSessionTimes } from '../../services/workSession.service'
import { getProcesses } from '../../services/process.service'
import { getCompanies } from '../../services/company.service'

const toDateTimeLocalValue = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

const toIsoOrNull = (dateTimeLocal) => {
  if (dateTimeLocal === null) return null
  if (typeof dateTimeLocal !== 'string' || !dateTimeLocal.trim()) return null
  const d = new Date(dateTimeLocal)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

const toLocalDateString = (dateValue) => {
  const yyyy = dateValue.getFullYear()
  const mm = String(dateValue.getMonth() + 1).padStart(2, '0')
  const dd = String(dateValue.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const todayYyyyMmDd = () => toLocalDateString(new Date())

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

const getDurationMinutes = (session, now) => {
  if (session?.endTime && typeof session.durationMinutes === 'number') {
    return session.durationMinutes
  }

  const start = new Date(session?.startTime)
  if (Number.isNaN(start.getTime())) return null

  const end = session?.endTime ? new Date(session.endTime) : now
  if (Number.isNaN(end.getTime())) return null

  const minutes = Math.round((end.getTime() - start.getTime()) / 60000)
  return minutes > 0 ? minutes : 0
}

const getEmployeeCountKey = (session) => {
  const employee = session?.employeeId
  return String(employee?._id || employee?.employeeId || employee || session?._id || '').trim()
}

export const WorkSessionsPage = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(() => todayYyyyMmDd())
  const [processes, setProcesses] = useState([])
  const [companies, setCompanies] = useState([])
  const [selectedProcess, setSelectedProcess] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('')

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isReportGenerating, setIsReportGenerating] = useState(false)
  const [editSession, setEditSession] = useState(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')

  const fetchSessions = async (date, { showLoader = true } = {}) => {
    if (showLoader) setIsLoading(true)
    try {
      const data = date ? await getWorkSessions({ date }) : await getWorkSessions()
      setSessions(data)
      setCurrentTime(new Date())
    } catch (error) {
      console.error('Failed to fetch work sessions', error)
    } finally {
      if (showLoader) setIsLoading(false)
    }
  }

  const fetchProcesses = async () => {
    try {
      const data = await getProcesses()
      setProcesses(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch processes', error)
      showToast('Failed to load processes', 'error')
    }
  }

  const fetchCompanies = async () => {
    try {
      const data = await getCompanies()
      setCompanies(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch companies', error)
      showToast('Failed to load companies', 'error')
    }
  }

  useEffect(() => {
    fetchProcesses()
    fetchCompanies()
  }, [])

  useEffect(() => {
    fetchSessions(selectedDate)

    const refreshInterval = window.setInterval(() => {
      setCurrentTime(new Date())
      fetchSessions(selectedDate, { showLoader: false })
    }, 60000)

    return () => {
      window.clearInterval(refreshInterval)
    }
  }, [selectedDate])

  const normalizedSelectedProcess = String(selectedProcess || '').trim().toLowerCase()
  const normalizedSelectedCompany = String(selectedCompany || '').trim()
  const selectedCompanyName = companies.find((company) =>
    String(company?._id || company?.id || '') === normalizedSelectedCompany
  )?.companyName
  const filteredSessions = sessions.filter((session) => {
    const matchesProcess = normalizedSelectedProcess
      ? String(session?.processName || '').trim().toLowerCase() === normalizedSelectedProcess
      : true
    const sessionCompanyId = String(session?.companyId?._id || session?.companyId || '').trim()
    const matchesCompany = normalizedSelectedCompany
      ? sessionCompanyId === normalizedSelectedCompany
      : true

    return matchesProcess && matchesCompany
  })
  const filteredEmployeeCount = new Set(
    filteredSessions
      .map(getEmployeeCountKey)
      .filter(Boolean)
  ).size

  const emptyMessage = (() => {
    const datePart = selectedDate ? ` for ${selectedDate}` : ''
    const filters = [selectedProcess, selectedCompanyName].filter(Boolean).join(', ')
    const filterPart = filters ? ` (${filters})` : ''
    return `No work sessions found${datePart}${filterPart}`
  })()

  const openReportModal = () => {
    setIsReportOpen(true)
  }

  const closeReportModal = () => {
    if (isReportGenerating) return
    setIsReportOpen(false)
  }

  const openEdit = (session) => {
    setEditSession(session)
    setEditStart(toDateTimeLocalValue(session?.startTime))
    setEditEnd(toDateTimeLocalValue(session?.endTime))
    setIsEditOpen(true)
  }

  const closeEdit = () => {
    if (isSaving) return
    setIsEditOpen(false)
    setEditSession(null)
    setEditStart('')
    setEditEnd('')
  }

  const saveEdits = async () => {
    if (!editSession?._id) return
    setIsSaving(true)
    try {
      const originalStart = toDateTimeLocalValue(editSession.startTime)
      const originalEnd = toDateTimeLocalValue(editSession.endTime)

      const payload = {}
      if (editStart && editStart !== originalStart) {
        payload.startTime = toIsoOrNull(editStart)
      }

      if (editEnd !== originalEnd) {
        // allow clearing end time by emptying the field
        payload.endTime = editEnd ? toIsoOrNull(editEnd) : null
      }

      if (Object.keys(payload).length === 0) {
        showToast('Nothing to update', 'warning')
        return
      }

      await updateWorkSessionTimes(editSession._id, payload)
      showToast('Work session updated', 'success')
      closeEdit()
      await fetchSessions(selectedDate)
    } catch (error) {
      console.error('Failed to update work session times', error)
      const msg = error?.response?.data?.message || error?.message || 'Failed to update work session'
      showToast(msg, 'error')
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
      const responses = await Promise.all(reportDates.map((reportDate) => getWorkSessions({ date: reportDate })))
      const normalizedReportProcess = String(selectedProcess || '').trim().toLowerCase()
      const normalizedReportCompany = String(selectedCompany || '').trim()
      const rows = responses
        .flat()
        .filter((session) => {
          const matchesProcess = normalizedReportProcess
            ? String(session?.processName || '').trim().toLowerCase() === normalizedReportProcess
            : true
          const sessionCompanyId = String(session?.companyId?._id || session?.companyId || '').trim()
          const matchesCompany = normalizedReportCompany
            ? sessionCompanyId === normalizedReportCompany
            : true

          return matchesProcess && matchesCompany
        })

      if (rows.length === 0) {
        showToast('No work sessions found for this date range', 'warning')
        return
      }

      showToast('Work sessions report downloaded', 'success')
      return {
        headers: [
          'Date',
          'Employee ID',
          'Employee Name',
          'Company',
          'Process',
          'Start Time',
          'End Time',
          'Status',
          'Duration (min)',
        ],
        rows: rows.map((session) => [
          session.startTime ? toLocalDateString(new Date(session.startTime)) : '-',
          session.employeeId?.employeeId || session.employeeId?._id || 'Unknown',
          session.employeeId?.name || 'Unknown',
          session.companyId?.companyName || '-',
          session.processName || '-',
          formatReportDateTime(session.startTime),
          formatReportDateTime(session.endTime),
          session.endTime ? 'COMPLETED' : 'ACTIVE',
          typeof session.durationMinutes === 'number' ? session.durationMinutes : '-',
        ]),
        fileName: `work-sessions-report-${startDate}-to-${endDate}.xlsx`,
        sheetName: 'Work Sessions',
        columnWidths: [14, 18, 24, 24, 24, 24, 24, 14, 16],
      }
    } catch (error) {
      console.error('Failed to generate work sessions report', error)
      const msg = error?.response?.data?.message || error?.message || 'Failed to generate work sessions report'
      showToast(msg, 'error')
    } finally {
      setIsReportGenerating(false)
    }
  }

  const columns = [
    {
      header: 'Employee',
      accessor: (item) =>
        item.employeeId
          ? (item.employeeId.employeeId || item.employeeId.name || item.employeeId._id || 'Unknown')
          : 'Unknown',
    },
    {
      header: 'Company',
      accessor: (item) => item.companyId?.companyName || '—',
    },
    {
      header: 'Process',
      accessor: (item) => item.processName || '—',
    },
    {
      header: 'Start Time',
      accessor: (item) =>
        item.startTime ? new Date(item.startTime).toLocaleString() : '—',
    },
    {
      header: 'End Time',
      accessor: (item) =>
        item.endTime ? new Date(item.endTime).toLocaleString() : '—',
    },
    {
      header: 'Status',
      accessor: (item) => (
        <Badge
          variant={item.endTime ? 'neutral' : 'success'}
        >
          {(item.endTime ? 'COMPLETED' : 'ACTIVE')}
        </Badge>
      ),
    },
    {
      header: 'Duration (min)',
      accessor: (item) => {
        const duration = getDurationMinutes(item, currentTime)
        return duration === null ? '—' : duration
      },
    },
    {
      header: 'Actions',
      accessor: (item) => (
        <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
          Edit Times
        </Button>
      ),
      className: 'whitespace-nowrap',
    },
  ]

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Work Sessions
        </h1>

        <div className="flex items-center gap-3">
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
            onClick={() =>
              navigate(
                selectedDate ? `/work-sessions/idle?date=${selectedDate}` : '/work-sessions/idle'
              )
            }
          >
            View In-Transition Employees
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(180px,240px)_minmax(200px,280px)_minmax(240px,1fr)_auto_auto] lg:items-end gap-3">
          <div className="w-full">
            <Input
              label="Filter by date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="w-full">
            <Select
              label="Filter by process"
              value={selectedProcess}
              onChange={(e) => setSelectedProcess(e.target.value)}
              placeholder="All processes"
              options={(Array.isArray(processes) ? processes : [])
                .filter((p) => p?.processName)
                .map((p) => ({
                  value: p.processName,
                  label: p.processName,
                }))}
            />
          </div>

          <div className="w-full">
            <Select
              label="Filter by company"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              placeholder="All companies"
              options={(Array.isArray(companies) ? companies : [])
                .filter((company) => company?.companyName || company?.name)
                .map((company) => ({
                  value: company._id || company.id,
                  label: company.companyName || company.name,
                }))}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setSelectedDate('')}
              disabled={!selectedDate}
            >
              Clear
            </Button>
          </div>

          <div className="w-full lg:w-36 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Employee Count
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {filteredEmployeeCount}
            </p>
          </div>
        </div>
      </div>

      <Table
        data={filteredSessions}
        columns={columns}
        keyExtractor={(item) => item._id}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
      />

      <ReportModal
        isOpen={isReportOpen}
        onClose={closeReportModal}
        onGenerate={generateReport}
        isGenerating={isReportGenerating}
        initialDate={selectedDate || todayYyyyMmDd()}
      />

      <Modal
        isOpen={isEditOpen}
        onClose={closeEdit}
        title={editSession ? `Edit Session Times - ${editSession.processName || 'Session'}` : 'Edit Session Times'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Start"
              type="datetime-local"
              value={editStart}
              onChange={(e) => setEditStart(e.target.value)}
            />
            <Input
              label="End"
              type="datetime-local"
              value={editEnd}
              onChange={(e) => setEditEnd(e.target.value)}
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
