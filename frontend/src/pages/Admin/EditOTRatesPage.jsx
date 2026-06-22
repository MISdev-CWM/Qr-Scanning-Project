import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../hooks/useToast'
import { getShiftTimes, upsertShiftTimes } from '../../services/shiftTime.service'

const defaultOtForm = {
  // Permanent OT time windows (no Night OT for permanent)
  permanentDayOtStart:      '17:00',
  permanentDayOtEnd:        '20:00',
  permanentSaturdayOtStart: '13:00',
  permanentSaturdayOtEnd:   '17:00',
  permanentSundayOtStart:   '13:00',
  permanentSundayOtEnd:     '17:00',
  // Manpower OT time windows
  manpowerDayOtStart:       '17:00',
  manpowerDayOtEnd:         '20:00',
  manpowerNightOtStart:     '05:00',
  manpowerNightOtEnd:       '08:00',
  manpowerSaturdayOtStart:  '13:00',
  manpowerSaturdayOtEnd:    '17:00',
  manpowerSundayOtStart:    '13:00',
  manpowerSundayOtEnd:      '17:00',
}

export const EditOTRatesPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const returnPath = searchParams.get('from') || '/ot-hours'

  const [otForm, setOtForm] = useState(defaultOtForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const data = await getShiftTimes()
        if (data) {
          setOtForm({
            permanentDayOtStart:      data.permanentDayOtStart      || defaultOtForm.permanentDayOtStart,
            permanentDayOtEnd:        data.permanentDayOtEnd        || defaultOtForm.permanentDayOtEnd,
            permanentSaturdayOtStart: data.permanentSaturdayOtStart || defaultOtForm.permanentSaturdayOtStart,
            permanentSaturdayOtEnd:   data.permanentSaturdayOtEnd   || defaultOtForm.permanentSaturdayOtEnd,
            permanentSundayOtStart:   data.permanentSundayOtStart   || defaultOtForm.permanentSundayOtStart,
            permanentSundayOtEnd:     data.permanentSundayOtEnd     || defaultOtForm.permanentSundayOtEnd,
            manpowerDayOtStart:       data.manpowerDayOtStart       || defaultOtForm.manpowerDayOtStart,
            manpowerDayOtEnd:         data.manpowerDayOtEnd         || defaultOtForm.manpowerDayOtEnd,
            manpowerNightOtStart:     data.manpowerNightOtStart     || defaultOtForm.manpowerNightOtStart,
            manpowerNightOtEnd:       data.manpowerNightOtEnd       || defaultOtForm.manpowerNightOtEnd,
            manpowerSaturdayOtStart:  data.manpowerSaturdayOtStart  || defaultOtForm.manpowerSaturdayOtStart,
            manpowerSaturdayOtEnd:    data.manpowerSaturdayOtEnd    || defaultOtForm.manpowerSaturdayOtEnd,
            manpowerSundayOtStart:    data.manpowerSundayOtStart    || defaultOtForm.manpowerSundayOtStart,
            manpowerSundayOtEnd:      data.manpowerSundayOtEnd      || defaultOtForm.manpowerSundayOtEnd,
          })
        }
      } catch (error) {
        console.error('Failed to load OT settings', error)
        const msg = error?.response?.data?.message || error?.message || 'Failed to load OT settings'
        showToast(msg, 'error')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [showToast])

  const handleChange = (field) => (e) => {
    setOtForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await upsertShiftTimes(otForm)
      showToast('OT settings updated successfully', 'success')
      navigate(returnPath)
    } catch (error) {
      console.error('Failed to save OT settings', error)
      const msg = error?.response?.data?.message || error?.message || 'Failed to save OT settings'
      showToast(msg, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Reusable row: two time inputs (start + end) side by side
  const OtRow = ({ label, startField, endField }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 border-b border-slate-100 last:border-0">
      <Input
        label={`${label} — OT Start`}
        type="time"
        value={otForm[startField]}
        onChange={handleChange(startField)}
        disabled={isLoading || isSaving}
      />
      <Input
        label={`${label} — OT End`}
        type="time"
        value={otForm[endField]}
        onChange={handleChange(endField)}
        disabled={isLoading || isSaving}
      />
    </div>
  )

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Edit OT Hours</h1>
            <p className="text-slate-600">Configure overtime time windows per shift type</p>
          </div>
          <Button
            variant="secondary"
            type="button"
            onClick={() => navigate(returnPath)}
            disabled={isSaving}
          >
            Back to OT Hours
          </Button>
        </div>

        {/* Permanent Employee OT — 3 categories */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Permanent Employee OT</h2>
          <p className="text-sm text-slate-500 mb-5">
            Note: Permanent employees on the{' '}
            <span className="font-medium text-amber-700">SPECIAL shift</span> do not earn OT
            regardless of checkout time.
          </p>

          <OtRow
            label="Day OT"
            startField="permanentDayOtStart"
            endField="permanentDayOtEnd"
          />
          <OtRow
            label="Saturday OT"
            startField="permanentSaturdayOtStart"
            endField="permanentSaturdayOtEnd"
          />
          <OtRow
            label="Sunday OT"
            startField="permanentSundayOtStart"
            endField="permanentSundayOtEnd"
          />
        </div>

        {/* Manpower Employee OT — 4 categories */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-5">Manpower Employee OT</h2>

          <OtRow
            label="Day OT"
            startField="manpowerDayOtStart"
            endField="manpowerDayOtEnd"
          />
          <OtRow
            label="Night OT"
            startField="manpowerNightOtStart"
            endField="manpowerNightOtEnd"
          />
          <OtRow
            label="Saturday OT"
            startField="manpowerSaturdayOtStart"
            endField="manpowerSaturdayOtEnd"
          />
          <OtRow
            label="Sunday OT"
            startField="manpowerSundayOtStart"
            endField="manpowerSundayOtEnd"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
          <Button
            variant="secondary"
            type="button"
            onClick={() => navigate(returnPath)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={isLoading}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
