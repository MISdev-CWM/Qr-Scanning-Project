import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { LogOut, User } from 'lucide-react'
import { getProcessesByUser } from '../../services/process.service'
import { Button } from '../ui/Button'

export const Header = ({ withSidebar = false }) => {
  const { user, logout } = useAuth()
  const [processName, setProcessName] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!user?.id || user?.role !== 'process') {
        setProcessName(null)
        return
      }

      try {
        const processes = await getProcessesByUser(user.id)
        const name = processes?.[0]?.processName || null
        if (!cancelled) setProcessName(name)
      } catch {
        if (!cancelled) setProcessName(null)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.role])

  const headerTitle = useMemo(() => {
    if (processName) return processName

    const role = user?.role
    if (!role) return 'Portal'
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)
    return `${roleLabel} Portal`
  }, [processName, user?.role])

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-white border-b border-slate-200 shadow-sm z-10 px-4 sm:px-6 flex items-center justify-between gap-4 ${
        withSidebar ? 'left-64' : 'left-0'
      }`}
    >
      <div className="flex flex-col truncate flex-1 min-w-0">
        <div className="text-[10px] sm:text-xs font-semibold tracking-widest text-slate-500 uppercase truncate">
          SCAN
        </div>
        <h2 className="text-base sm:text-lg font-semibold text-slate-800 truncate">
          {headerTitle}
        </h2>
        <div className="hidden sm:block text-xs text-slate-500 truncate">
          Employee Efficiency Monitoring System
        </div>
      </div>

      <div className="flex items-center space-x-4 shrink-0">
        <Button
          variant="secondary"
          onClick={logout}
          className="flex items-center gap-2"
          aria-label="Logout"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>

        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">
              {user?.name}
            </p>
            <p className="text-xs text-slate-500 capitalize">
              {user?.role}
            </p>
          </div>

          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
            <User className="w-5 h-5 text-slate-600" />
          </div>
        </div>
      </div>
    </header>
  )
}
