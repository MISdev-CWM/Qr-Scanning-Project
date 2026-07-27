import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Button } from '../../components/ui/Button'

export const EditOTRatesPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnPath = searchParams.get('from') || '/ot-hours'

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">OT Ranges</h1>
            <p className="text-slate-600">OT range configuration has been removed.</p>
          </div>
          <Button
            variant="secondary"
            type="button"
            onClick={() => navigate(returnPath)}
          >
            Back to Total Hours
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <p className="text-slate-600">
            Total hours are now calculated directly from the check-in and check-out times.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
