import React from 'react'
import { AttendanceScanner } from '../../components/features/AttendanceScanner'
import { useAuth } from '../../hooks/useAuth'
import { LogOut } from 'lucide-react'
import { Button } from '../../components/ui/Button'

export const AttendanceScanPage = () => {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200" data-focus-exempt="true">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Security Portal</h1>
            <p className="text-sm text-slate-600 mt-1">
              Welcome, {user?.username}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={logout}
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-8 [&>div]:p-4 [&>div]:sm:p-4 [&>div_h3]:mb-3 [&_.space-y-4]:space-y-3 [&_#qr-reader]:h-[clamp(220px,38vh,340px)] [&_#qr-reader]:min-h-0 [&_#qr-reader]:max-h-none [&_input]:block [&_input]:max-w-md [&_input]:mx-auto [&_input]:h-9 [&_input]:py-1 [&_input]:text-sm">
        <AttendanceScanner />
      </div>
    </div>
  )
}
