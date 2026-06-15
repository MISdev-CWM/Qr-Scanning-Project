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

export const WorkSessionsPage = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState('')
  const [processes, setProcesses] = useState([])
  const [selectedProcess, setSelectedProcess] = useState('')

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isReportGenerating, setIsReportGenerating] = useState(false)
  const [editSession, setEditSession] = useState(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')

  const fetchSessions = async (date) => {
    setIsLoading(true)
    try {
      const data = date ? await getWorkSessions({ date }) : await getWorkSessions()
      setSessions(data)
    } catch (error) {
      console.error('Failed to fetch work sessions', error)
    } finally {
      setIsLoading(false)
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

  useEffect(() => {
    fetchProcesses()
    fetchSessions(selectedDate)
  }, [])

  useEffect(() => {
    fetchSessions(selectedDate)
  }, [selectedDate])

  const normalizedSelectedProcess = String(selectedProcess || '').trim().toLowerCase()
  const filteredSessions = normalizedSelectedProcess
    ? sessions.filter((s) => String(s?.processName || '').trim().toLowerCase() === normalizedSelectedProcess)
    : sessions

  const emptyMessage = (() => {
    const datePart = selectedDate ? ` for ${selectedDate}` : ''
    const processPart = selectedProcess ? ` (${selectedProcess})` : ''
    return `No work sessions found${datePart}${processPart}`
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
      const rows = responses
        .flat()
        .filter((session) =>
          normalizedReportProcess
            ? String(session?.processName || '').trim().toLowerCase() === normalizedReportProcess
            : true
        )

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
      accessor: (item) => (typeof item.durationMinutes === 'number' ? item.durationMinutes : '—'),
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
            View Idle Employees
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="w-full md:max-w-xs">
            <Input
              label="Filter by date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="w-full md:max-w-xs">
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
