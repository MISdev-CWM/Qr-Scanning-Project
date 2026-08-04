import React, { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { WorkSessionScanner } from '../../components/features/WorkSessionScanner'
import { Modal } from '../../components/ui/Modal'
import { getActiveSessionsByProcess } from '../../services/workSession.service'
import { useNavigate } from 'react-router-dom'
import { Users, User, Clock, Workflow, RefreshCw } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const formatTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const ProcessScanPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Active sessions grouped by process
  const [activeByProcess, setActiveByProcess] = useState({})
  const [isLoadingActive, setIsLoadingActive] = useState(true)

  // Modal state
  const [checkedInModal, setCheckedInModal] = useState({ open: false, processName: '', employees: [] })

  const fetchActive = useCallback(async () => {
    try {
      const data = await getActiveSessionsByProcess()
      setActiveByProcess(data || {})
    } catch (err) {
      console.error('Failed to fetch active sessions:', err)
    } finally {
      setIsLoadingActive(false)
    }
  }, [])

  useEffect(() => {
    fetchActive()
  }, [fetchActive])

  const handleScanSuccess = () => {
    // Refresh the active counts after a successful scan
    fetchActive()
  }

  const handleCheckedInClick = (processName) => {
    const employees = activeByProcess[processName] || []
    setCheckedInModal({ open: true, processName, employees })
  }

  const processEntries = Object.entries(activeByProcess)
  const totalCheckedIn = processEntries.reduce((sum, [, emps]) => sum + emps.length, 0)
  const isProcessUser = user?.role === 'process'

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Header */}
          <div className="mb-2 sm:mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Process Scanner
            </h1>
            <p className="text-slate-600 mt-1">
              Scan employee QR codes to start/stop work sessions
            </p>
          </div>

          {/* Scanner */}
          <WorkSessionScanner onScanSuccess={handleScanSuccess} />

          {/* Checked-In Count Panel */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-500" />
                <h2 className="text-base font-semibold text-slate-900">
                  {isProcessUser ? 'Active Checked-In Employees' : 'Employees Checked In by Process'}
                </h2>
                {totalCheckedIn > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                    {totalCheckedIn}
                  </span>
                )}
              </div>
              <button
                onClick={fetchActive}
                disabled={isLoadingActive}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingActive ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {isLoadingActive ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm animate-pulse">
                Loading active sessions...
              </div>
            ) : processEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Workflow className="w-8 h-8 mb-2 text-slate-300" />
                <p className="text-sm">No employees currently checked in to any process.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {processEntries.map(([processName, employees]) => (
                  <div
                    key={processName}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Workflow className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="font-medium text-slate-800">{processName}</span>
                    </div>

                    <button
                      onClick={() => handleCheckedInClick(processName)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1"
                      title={`Click to see ${employees.length} checked-in employee(s)`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      {employees.length}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Checked-In Employees Modal */}
      <Modal
        isOpen={checkedInModal.open}
        onClose={() => setCheckedInModal({ open: false, processName: '', employees: [] })}
        title={`Checked-In — ${checkedInModal.processName}`}
      >
        {checkedInModal.employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500">
            <Users className="w-10 h-10 mb-3 text-slate-300" />
            <p className="text-sm font-medium">No employees currently checked in for this process.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              {checkedInModal.employees.length} employee{checkedInModal.employees.length !== 1 ? 's' : ''} currently working on this process.
            </p>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
              {checkedInModal.employees.map((emp, idx) => (
                <div
                  key={emp.sessionId || idx}
                  className="flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{emp.employeeName}</p>
                      <p className="text-xs text-slate-500">{emp.employeeCode} · {emp.companyName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Since {formatTime(emp.startTime)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}

export default ProcessScanPage
