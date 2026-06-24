import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Button } from '../../components/ui/Button'

export const EditShiftTimesPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnDate = searchParams.get('date')
  const returnPath = returnDate ? `/attendance?date=${returnDate}` : '/attendance'

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Shift Settings</h1>
            <p className="text-slate-600">Shift-based configuration is no longer used for attendance or OT.</p>
          </div>

          <Button
            variant="secondary"
            type="button"
            onClick={() => navigate(returnPath)}
          >
            Back to Attendance
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <p className="text-slate-600">
            Attendance and OT are now calculated directly from check-in and check-out times using the fixed 9-hour rule and the applicable OT cap.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
