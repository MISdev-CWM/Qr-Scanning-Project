import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../hooks/useToast'
import { getShiftTimes, upsertShiftTimes } from '../../services/shiftTime.service'

const defaultShiftForm = {
  permanentNormalStart: '08:00',
  permanentNormalEnd: '17:00',
  permanentSpecialStart: '17:00',
  permanentSpecialEnd: '01:00',
  permanentSaturdayStart: '08:00',
  permanentSaturdayEnd: '13:00',
  permanentSundayStart: '08:00',
  permanentSundayEnd: '13:00',
  manpowerDayStart: '08:00',
  manpowerDayEnd: '17:00',
  manpowerNightStart: '20:00',
  manpowerNightEnd: '05:00',
  manpowerSaturdayStart: '08:00',
  manpowerSaturdayEnd: '13:00',
  manpowerSaturdayNightStart: '20:00',
  manpowerSaturdayNightEnd: '05:00',
  manpowerSundayStart: '08:00',
  manpowerSundayEnd: '13:00',
}

const toMinutes = (value) => {
  const [hh, mm] = value.split(':').map(Number)
  return hh * 60 + mm
}

const getDurationHours = (start, end) => {
  if (!start || !end) return 0
  const startMinutes = toMinutes(start)
  const endMinutes = toMinutes(end)
  const durationMinutes =
    endMinutes > startMinutes
      ? endMinutes - startMinutes
      : endMinutes + 24 * 60 - startMinutes

  return durationMinutes / 60
}

export const EditShiftTimesPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const returnDate = searchParams.get('date')
  const returnPath = returnDate ? `/attendance?date=${returnDate}` : '/attendance'

  const [shiftForm, setShiftForm] = useState(defaultShiftForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const loadShiftTimes = async () => {
      setIsLoading(true)
      try {
        const data = await getShiftTimes()
        setShiftForm({
          permanentNormalStart: data?.permanentNormalStart || defaultShiftForm.permanentNormalStart,
          permanentNormalEnd: data?.permanentNormalEnd || defaultShiftForm.permanentNormalEnd,
          permanentSpecialStart: data?.permanentSpecialStart || defaultShiftForm.permanentSpecialStart,
          permanentSpecialEnd: data?.permanentSpecialEnd || defaultShiftForm.permanentSpecialEnd,
          permanentSaturdayStart: data?.permanentSaturdayStart || defaultShiftForm.permanentSaturdayStart,
          permanentSaturdayEnd: data?.permanentSaturdayEnd || defaultShiftForm.permanentSaturdayEnd,
          permanentSundayStart: data?.permanentSundayStart || defaultShiftForm.permanentSundayStart,
          permanentSundayEnd: data?.permanentSundayEnd || defaultShiftForm.permanentSundayEnd,
          manpowerDayStart: data?.manpowerDayStart || defaultShiftForm.manpowerDayStart,
          manpowerDayEnd: data?.manpowerDayEnd || defaultShiftForm.manpowerDayEnd,
          manpowerNightStart: data?.manpowerNightStart || defaultShiftForm.manpowerNightStart,
          manpowerNightEnd: data?.manpowerNightEnd || defaultShiftForm.manpowerNightEnd,
          manpowerSaturdayStart: data?.manpowerSaturdayStart || defaultShiftForm.manpowerSaturdayStart,
          manpowerSaturdayEnd: data?.manpowerSaturdayEnd || defaultShiftForm.manpowerSaturdayEnd,
          manpowerSaturdayNightStart: data?.manpowerSaturdayNightStart || defaultShiftForm.manpowerSaturdayNightStart,
          manpowerSaturdayNightEnd: data?.manpowerSaturdayNightEnd || defaultShiftForm.manpowerSaturdayNightEnd,
          manpowerSundayStart: data?.manpowerSundayStart || defaultShiftForm.manpowerSundayStart,
          manpowerSundayEnd: data?.manpowerSundayEnd || defaultShiftForm.manpowerSundayEnd,
        })
      } catch (error) {
        console.error('Failed to fetch shift times', error)
        const msg = error?.response?.data?.message || error?.message || 'Failed to load shift times'
        showToast(msg, 'error')
      } finally {
        setIsLoading(false)
      }
    }

    loadShiftTimes()
  }, [showToast])

  const handleShiftChange = (field) => (e) => {
    const value = e.target.value
    setShiftForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const saveShiftTimes = async () => {
    if (getDurationHours(shiftForm.permanentNormalStart, shiftForm.permanentNormalEnd) > 24) {
      showToast('Permanent normal shift must be maximum 24 hours', 'warning')
      return
    }

    if (getDurationHours(shiftForm.permanentSpecialStart, shiftForm.permanentSpecialEnd) > 8) {
      showToast('Permanent special shift must be maximum 8 hours', 'warning')
      return
    }

    setIsSaving(true)
    try {
      await upsertShiftTimes(shiftForm)
      showToast('Shift times updated', 'success')
      navigate(returnPath)
    } catch (error) {
      console.error('Failed to update shift times', error)
      const msg = error?.response?.data?.message || error?.message || 'Failed to update shift times'
      showToast(msg, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Edit Shift Times</h1>
            <p className="text-slate-600">Update permanent and manpower shift schedules</p>
          </div>

          <Button
            variant="secondary"
            type="button"
            onClick={() => navigate(returnPath)}
            disabled={isSaving}
          >
            Back to Attendance
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Permanent Shifts</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Normal Shift Start"
                  type="time"
                  value={shiftForm.permanentNormalStart}
                  onChange={handleShiftChange('permanentNormalStart')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Normal Shift End"
                  type="time"
                  value={shiftForm.permanentNormalEnd}
                  onChange={handleShiftChange('permanentNormalEnd')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Special Shift Start"
                  type="time"
                  value={shiftForm.permanentSpecialStart}
                  onChange={handleShiftChange('permanentSpecialStart')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Special Shift End"
                  type="time"
                  value={shiftForm.permanentSpecialEnd}
                  onChange={handleShiftChange('permanentSpecialEnd')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Saturday Start"
                  type="time"
                  value={shiftForm.permanentSaturdayStart}
                  onChange={handleShiftChange('permanentSaturdayStart')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Saturday End"
                  type="time"
                  value={shiftForm.permanentSaturdayEnd}
                  onChange={handleShiftChange('permanentSaturdayEnd')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Sunday Start"
                  type="time"
                  value={shiftForm.permanentSundayStart}
                  onChange={handleShiftChange('permanentSundayStart')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Sunday End"
                  type="time"
                  value={shiftForm.permanentSundayEnd}
                  onChange={handleShiftChange('permanentSundayEnd')}
                  disabled={isLoading || isSaving}
                />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Manpower Shifts</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Day Start"
                  type="time"
                  value={shiftForm.manpowerDayStart}
                  onChange={handleShiftChange('manpowerDayStart')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Day End"
                  type="time"
                  value={shiftForm.manpowerDayEnd}
                  onChange={handleShiftChange('manpowerDayEnd')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Night Start"
                  type="time"
                  value={shiftForm.manpowerNightStart}
                  onChange={handleShiftChange('manpowerNightStart')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Night End"
                  type="time"
                  value={shiftForm.manpowerNightEnd}
                  onChange={handleShiftChange('manpowerNightEnd')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Saturday Day Start"
                  type="time"
                  value={shiftForm.manpowerSaturdayStart}
                  onChange={handleShiftChange('manpowerSaturdayStart')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Saturday Day End"
                  type="time"
                  value={shiftForm.manpowerSaturdayEnd}
                  onChange={handleShiftChange('manpowerSaturdayEnd')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Saturday Night Start"
                  type="time"
                  value={shiftForm.manpowerSaturdayNightStart}
                  onChange={handleShiftChange('manpowerSaturdayNightStart')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Saturday Night End"
                  type="time"
                  value={shiftForm.manpowerSaturdayNightEnd}
                  onChange={handleShiftChange('manpowerSaturdayNightEnd')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Sunday Start"
                  type="time"
                  value={shiftForm.manpowerSundayStart}
                  onChange={handleShiftChange('manpowerSundayStart')}
                  disabled={isLoading || isSaving}
                />
                <Input
                  label="Sunday End"
                  type="time"
                  value={shiftForm.manpowerSundayEnd}
                  onChange={handleShiftChange('manpowerSundayEnd')}
                  disabled={isLoading || isSaving}
                />
              </div>
            </section>

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
                onClick={saveShiftTimes}
                isLoading={isSaving}
                disabled={isLoading}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
