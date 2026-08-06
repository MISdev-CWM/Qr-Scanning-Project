import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Table } from '../../components/ui/Table'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ReportModal } from '../../components/features/ReportModal'
import { useToast } from '../../hooks/useToast'
import { getDailySummary, getNonCheckoutEmployees, updateAttendanceLogScanTime, createManualAttendanceLog, previewAttendanceRecordDelete, deleteAttendanceRecord } from '../../services/attendance.service'
import { getCompanies } from '../../services/company.service'

const toIdString = (value) => {
  const id = value?._id || value?.id || value
  return id ? String(id) : ''
}

const toTimeValue = (scanTime) => {
  if (!scanTime) return ''
  const d = new Date(scanTime)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const toIsoFromDateAndTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null
  const [yyyy, mm, dd] = dateStr.split('-').map((v) => Number(v))
  const [hh, min] = timeStr.split(':').map((v) => Number(v))
  if (!yyyy || !mm || !dd) return null
  if (Number.isNaN(hh) || Number.isNaN(min)) return null
  const local = new Date(yyyy, mm - 1, dd, hh, min, 0, 0)
  if (Number.isNaN(local.getTime())) return null
  return local.toISOString()
}

const toLocalDateString = (dateValue) => {
  const yyyy = dateValue.getFullYear()
  const mm = String(dateValue.getMonth() + 1).padStart(2, '0')
  const dd = String(dateValue.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

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

const getDeletePayload = (row) => ({
  attendanceLogIds: [toIdString(row?.checkInLogId), toIdString(row?.checkOutLogId)].filter(Boolean),
  employeeId: toIdString(row?.employeeObjectId),
  workDate: row?.workDate,
  checkInTime: row?.checkIn || null,
  checkOutTime: row?.checkOut || null,
  expectedScanTypes: {
    in: Boolean(row?.checkIn),
    out: Boolean(row?.checkOut),
  },
})

const AttendanceDateTimeCell = ({ value }) => {
  if (!value) return '-'

  const dateValue = new Date(value)
  if (Number.isNaN(dateValue.getTime())) return '-'

  return (
    <div className="leading-tight">
      <div className="text-slate-900">{dateValue.toLocaleTimeString()}</div>
      <div className="mt-1 text-xs text-slate-500">
        {dateValue.toLocaleDateString('en-GB')}
      </div>
    </div>
  )
}

const CheckoutDateTimeCell = ({ value, isAutoCheckout }) => {
  if (!value) return '-'

  return (
    <div>
      <AttendanceDateTimeCell value={value} />
      {isAutoCheckout ? (
        <div className="mt-1 text-xs font-medium text-blue-600">
          Auto checkout
        </div>
      ) : null}
    </div>
  )
}

export const AttendancePage = () => {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(
    initialDate
  )
  const [summary, setSummary] = useState([])
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [nonCheckoutCount, setNonCheckoutCount] = useState(0)
  const [isNonCheckoutLoading, setIsNonCheckoutLoading] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [editCheckInDate, setEditCheckInDate] = useState('')
  const [editCheckIn, setEditCheckIn] = useState('')
  const [editCheckOutDate, setEditCheckOutDate] = useState('')
  const [editCheckOut, setEditCheckOut] = useState('')
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isReportGenerating, setIsReportGenerating] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteRow, setDeleteRow] = useState(null)
  const [deletePreview, setDeletePreview] = useState(null)
  const [isDeletePreviewLoading, setIsDeletePreviewLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchSummary = async () => {
    setIsLoading(true)
    try {
      const data = await getDailySummary(date, { autoCheckout: true })
      console.log('Daily summary data:', data)
      
      // Handle empty or invalid response
      if (!data || !Array.isArray(data)) {
        console.warn('Invalid data format received:', data)
        setSummary([])
        return
      }
      
      // Transform the API response to match the table structure
      const transformedData = data.map((item) => {
        const workDateFromLog = item.firstIn?.workDate || item.lastOut?.workDate || date
        return {
          id:
            item.employee?._id ||
            item.employee?.employeeId ||
            item.firstIn?._id ||
            item.lastOut?._id ||
            `${item.employee?.name || 'employee'}-${date}`,
          employeeId: item.employee?.employeeId || 'N/A',
          employeeObjectId: item.employee?._id,
          companyObjectId: toIdString(item.company?._id || item.firstIn?.companyId || item.lastOut?.companyId),
          name: item.employee?.name || 'Unknown',
          checkIn: item.firstIn?.scanTime,
          checkOut: item.lastOut?.scanTime,
          checkInLogId: toIdString(item.firstIn?._id),
          checkOutLogId: toIdString(item.lastOut?._id),
          isAutoCheckout: item.lastOut?.shift === 'AUTO_CHECKOUT',
          workDate: workDateFromLog,
          status: item.firstIn && item.lastOut ? 'Present' : item.firstIn ? 'Partial' : 'Absent',
          company: item.company?.companyName || 'N/A'
        }
      })
      setSummary(transformedData)
    } catch (error) {
      console.error('Failed to fetch attendance summary', error)
      setSummary([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchNonCheckoutCount = async () => {
    setIsNonCheckoutLoading(true)
    try {
      const data = await getNonCheckoutEmployees(date)
      const count =
        typeof data?.count === 'number'
          ? data.count
          : Array.isArray(data?.rows)
            ? data.rows.length
            : 0
      setNonCheckoutCount(count)
    } catch (error) {
      setNonCheckoutCount(0)
    } finally {
      setIsNonCheckoutLoading(false)
    }
  }

  const refreshAttendance = async () => {
    await fetchSummary()
    await fetchNonCheckoutCount()
  }

  const filteredSummary = useMemo(() => {
    if (!selectedCompany) return summary
    return summary.filter((item) => item.companyObjectId === selectedCompany)
  }, [selectedCompany, summary])

  const companyOptions = useMemo(() => (
    (Array.isArray(companies) ? companies : [])
      .filter((company) => company?.companyName || company?.name)
      .map((company) => ({
        value: toIdString(company._id || company.id),
        label: company.companyName || company.name,
      }))
      .filter((option) => option.value)
  ), [companies])

  const openReportModal = () => {
    setIsReportOpen(true)
  }

  const closeReportModal = () => {
    if (isReportGenerating) return
    setIsReportOpen(false)
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
      const responses = await Promise.all(reportDates.map((reportDate) => getDailySummary(reportDate, { autoCheckout: true })))
      const rows = responses.flatMap((data, index) => {
        if (!Array.isArray(data)) return []

        return data.map((item) => {
          const workDateFromLog = item.firstIn?.workDate || item.lastOut?.workDate || reportDates[index]
          return {
            employeeId: item.employee?.employeeId || 'N/A',
            name: item.employee?.name || 'Unknown',
            checkIn: item.firstIn?.scanTime,
            checkOut: item.lastOut?.scanTime,
            workDate: workDateFromLog,
            status: item.firstIn && item.lastOut ? 'Present' : item.firstIn ? 'Partial' : 'Absent',
            company: item.company?.companyName || 'N/A',
          }
        })
      })

      if (rows.length === 0) {
        showToast('No attendance records found for this date range', 'warning')
        return
      }

      showToast('Attendance report downloaded', 'success')
      return {
        headers: [
          'Date',
          'Employee ID',
          'Employee Name',
          'Company',
          'Check In',
          'Check Out',
          'Status',
        ],
        rows: rows.map((row) => [
          row.workDate,
          row.employeeId,
          row.name,
          row.company,
          formatReportDateTime(row.checkIn),
          formatReportDateTime(row.checkOut),
          row.status,
        ]),
        fileName: `attendance-report-${startDate}-to-${endDate}.xlsx`,
        sheetName: 'Attendance Report',
        columnWidths: [14, 18, 24, 24, 24, 24, 12, 14],
      }
    } catch (error) {
      console.error('Failed to generate attendance report', error)
      const msg = error?.response?.data?.message || error?.message || 'Failed to generate attendance report'
      showToast(msg, 'error')
    } finally {
      setIsReportGenerating(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    const fetchCompanies = async () => {
      try {
        const data = await getCompanies()
        if (isMounted) {
          setCompanies(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        if (isMounted) {
          setCompanies([])
        }
      }
    }

    fetchCompanies()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    refreshAttendance()
  }, [date])

  const openEdit = (row) => {
    const fallbackDate = row?.workDate || date
    setEditRow(row)
    setEditCheckInDate(row?.checkIn ? toLocalDateString(new Date(row.checkIn)) : fallbackDate)
    setEditCheckIn(toTimeValue(row?.checkIn))
    setEditCheckOutDate(row?.checkOut ? toLocalDateString(new Date(row.checkOut)) : fallbackDate)
    setEditCheckOut(toTimeValue(row?.checkOut))
    setIsEditOpen(true)
  }

  const closeEdit = () => {
    if (isSaving) return
    setIsEditOpen(false)
    setEditRow(null)
    setEditCheckInDate('')
    setEditCheckIn('')
    setEditCheckOutDate('')
    setEditCheckOut('')
  }

  const openDelete = async (row) => {
    const payload = getDeletePayload(row)
    if (payload.attendanceLogIds.length === 0 && !payload.checkInTime && !payload.checkOutTime) {
      showToast('No attendance logs found for this row', 'warning')
      return
    }

    setDeleteRow(row)
    setDeletePreview(null)
    setIsDeleteOpen(true)
    setIsDeletePreviewLoading(true)

    try {
      const preview = await previewAttendanceRecordDelete(payload)
      setDeletePreview(preview)
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to load delete preview'
      showToast(msg, 'error')
      setIsDeleteOpen(false)
      setDeleteRow(null)
    } finally {
      setIsDeletePreviewLoading(false)
    }
  }

  const closeDelete = () => {
    if (isDeleting) return
    setIsDeleteOpen(false)
    setDeleteRow(null)
    setDeletePreview(null)
  }

  const confirmDelete = async () => {
    if (!deleteRow) return
    setIsDeleting(true)
    try {
      const result = await deleteAttendanceRecord(getDeletePayload(deleteRow))
      showToast(
        `Deleted attendance record Successfully`,
        'success'
      )
      setIsDeleteOpen(false)
      setDeleteRow(null)
      setDeletePreview(null)
      await refreshAttendance()
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to delete attendance record'
      showToast(msg, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const saveEdits = async () => {
    if (!editRow) return
    setIsSaving(true)
    try {
      const baseDate = editRow.workDate || date
      let updatesCount = 0

      if (editRow.checkInLogId && (!editCheckInDate || !editCheckIn)) {
        showToast('Please select both check-in date and time', 'warning')
        return
      }

      if (!editRow.checkInLogId && editCheckIn && !editCheckInDate) {
        showToast('Please select check-in date', 'warning')
        return
      }

      if (editRow.checkOutLogId && (!editCheckOutDate || !editCheckOut)) {
        showToast('Please select both check-out date and time', 'warning')
        return
      }

      if (!editRow.checkOutLogId && editCheckOut && !editCheckOutDate) {
        showToast('Please select check-out date', 'warning')
        return
      }

      if (editRow.checkInLogId) {
        const originalTime = toTimeValue(editRow.checkIn)
        const originalDate = editRow.checkIn ? toLocalDateString(new Date(editRow.checkIn)) : baseDate
        const hasChanged = editCheckIn !== originalTime || editCheckInDate !== originalDate

        if (hasChanged) {
          const iso = toIsoFromDateAndTime(editCheckInDate, editCheckIn)
          if (iso) {
            await updateAttendanceLogScanTime(editRow.checkInLogId, iso, editCheckInDate)
            updatesCount += 1
          }
        }
      } else if (editCheckIn) {
        const iso = toIsoFromDateAndTime(editCheckInDate, editCheckIn)
        if (iso) {
          await createManualAttendanceLog({
            employeeId: editRow.employeeObjectId,
            companyId: editRow.companyObjectId,
            scanType: 'IN',
            scanTime: iso,
            workDate: editCheckInDate,
          })
          updatesCount += 1
        }
      }

      const targetCheckoutWorkDate = editCheckInDate || baseDate
      if (editRow.checkOutLogId) {
        const originalTime = toTimeValue(editRow.checkOut)
        const originalDate = editRow.checkOut ? toLocalDateString(new Date(editRow.checkOut)) : baseDate
        const hasChanged =
          editCheckOut !== originalTime ||
          editCheckOutDate !== originalDate ||
          targetCheckoutWorkDate !== baseDate

        if (hasChanged) {
          const iso = toIsoFromDateAndTime(editCheckOutDate, editCheckOut)
          if (iso) {
            await updateAttendanceLogScanTime(editRow.checkOutLogId, iso, targetCheckoutWorkDate)
            updatesCount += 1
          }
        }
      } else if (editCheckOut) {
        const iso = toIsoFromDateAndTime(editCheckOutDate, editCheckOut)
        if (iso) {
          await createManualAttendanceLog({
            employeeId: editRow.employeeObjectId,
            companyId: editRow.companyObjectId,
            scanType: 'OUT',
            scanTime: iso,
            workDate: targetCheckoutWorkDate,
          })
          updatesCount += 1
        }
      }

      if (updatesCount === 0) {
        showToast('Nothing to update', 'warning')
        return
      }

      showToast('Attendance date and time updated', 'success')
      closeEdit()
      await refreshAttendance()
    } catch (error) {
      console.error('Failed to update attendance times', error)
      const msg = error?.response?.data?.message || error?.message || 'Failed to update attendance times'
      showToast(msg, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const columns = [
    {
      header: 'Employee ID',
      accessor: 'employeeId',
    },
    {
      header: 'Employee',
      accessor: 'name',
    },
    {
      header: 'Company',
      accessor: 'company',
    },
    {
      header: 'Check In',
      accessor: (item) => <AttendanceDateTimeCell value={item.checkIn} />,
    },
    {
      header: 'Check Out',
      accessor: (item) => (
        <CheckoutDateTimeCell
          value={item.checkOut}
          isAutoCheckout={item.isAutoCheckout}
        />
      ),
    },
    {
      header: 'Status',
      accessor: (item) => (
        <Badge
          variant={
            item.status === 'Present'
              ? 'success'
              : item.status === 'Partial'
              ? 'warning'
              : 'error'
          }
        >
          {item.status}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      accessor: (item) => (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEdit(item)}
            disabled={!item.checkInLogId && !item.checkOutLogId}
          >
            Edit Times
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => openDelete(item)}
            disabled={!item.checkInLogId && !item.checkOutLogId}
          >
            Delete
          </Button>
        </div>
      ),
      className: 'whitespace-nowrap',
    },
  ]

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Attendance Management
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* <div className="lg:col-span-1">
          <AttendanceScanner onScanSuccess={refreshAttendance} />
        </div> */}

        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 h-full">
            <div className="mb-6 space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Attendance Records
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">
                    Daily Summary
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={openReportModal}
                    disabled={isEditOpen}
                    className="border-green-200! bg-green-100! text-green-800! hover:bg-green-200! focus:ring-green-500!"
                  >
                    Generate Report
                  </Button>

                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => navigate(`/attendance/non-checkout?date=${date}`)}
                    disabled={isNonCheckoutLoading}
                  >
                    Non Checkout: {isNonCheckoutLoading ? '...' : nonCheckoutCount}
                  </Button>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(180px,240px)_minmax(240px,1fr)_auto_minmax(120px,150px)] lg:items-end">
                  <Input
                    label="Filter by date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-white"
                    disabled={isEditOpen}
                  />

                  <Select
                    label="Filter by company"
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    placeholder="All companies"
                    options={companyOptions}
                    className="bg-white"
                    disabled={isEditOpen}
                  />

                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setSelectedCompany('')}
                    disabled={!selectedCompany || isEditOpen}
                    className="h-10 px-5"
                  >
                    Clear
                  </Button>

                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Employees
                    </p>
                    <p className="text-xl font-semibold text-slate-900">
                      {filteredSummary.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Table
              data={filteredSummary}
              columns={columns}
              keyExtractor={(item) => item.id}
              isLoading={isLoading}
              emptyMessage="No attendance records for this date"
            />
          </div>
        </div>
      </div>

      <ReportModal
        isOpen={isReportOpen}
        onClose={closeReportModal}
        onGenerate={generateReport}
        isGenerating={isReportGenerating}
        initialDate={date}
      />

      <Modal
        isOpen={isDeleteOpen}
        onClose={closeDelete}
        title={deleteRow ? `Delete Attendance - ${deleteRow.name}` : 'Delete Attendance'}
      >
        <div className="space-y-5">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            This will delete the selected attendance row and the work sessions found inside the same attendance period.
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Employee</p>
              <p className="mt-1 font-semibold text-slate-900">{deleteRow?.name || '-'}</p>
              <p className="text-sm text-slate-500">{deleteRow?.employeeId || '-'}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Company</p>
              <p className="mt-1 font-semibold text-slate-900">{deleteRow?.company || '-'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Check In</p>
              <div className="mt-1"><AttendanceDateTimeCell value={deleteRow?.checkIn} /></div>
            </div>
            <div className="rounded-md border border-slate-200 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Check Out</p>
              <div className="mt-1">
                <CheckoutDateTimeCell
                  value={deleteRow?.checkOut}
                  isAutoCheckout={deleteRow?.isAutoCheckout}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">
                Work sessions in this attendance period
              </h4>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {isDeletePreviewLoading ? '...' : `${deletePreview?.workSessions?.length || 0} session(s)`}
              </span>
            </div>

            {isDeletePreviewLoading ? (
              <div className="rounded-md border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                Loading work sessions...
              </div>
            ) : deletePreview?.workSessions?.length > 0 ? (
              <div className="max-h-64 overflow-auto rounded-md border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Process</th>
                      <th className="px-3 py-2">Start</th>
                      <th className="px-3 py-2">End</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {deletePreview.workSessions.map((session) => (
                      <tr key={session._id}>
                        <td className="px-3 py-2 text-slate-900">{session.processName || '-'}</td>
                        <td className="px-3 py-2"><AttendanceDateTimeCell value={session.startTime} /></td>
                        <td className="px-3 py-2">
                          {session.endTime ? <AttendanceDateTimeCell value={session.endTime} /> : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={session.endTime ? 'success' : 'warning'}>
                            {session.endTime ? 'Ended' : 'Active'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No work sessions found for this attendance period.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeDelete} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              isLoading={isDeleting}
              disabled={isDeletePreviewLoading}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isEditOpen}
        onClose={closeEdit}
        title={editRow ? `Edit Attendance - ${editRow.name}` : 'Edit Attendance'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Check In</p>
              <Input
                label="Date"
                type="date"
                value={editCheckInDate}
                onChange={(e) => setEditCheckInDate(e.target.value)}
              />
              <Input
                label="Time"
                type="time"
                value={editCheckIn}
                onChange={(e) => setEditCheckIn(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Check Out</p>
              <Input
                label="Date"
                type="date"
                value={editCheckOutDate}
                onChange={(e) => setEditCheckOutDate(e.target.value)}
              />
              <Input
                label="Time"
                type="time"
                value={editCheckOut}
                onChange={(e) => setEditCheckOut(e.target.value)}
              />
            </div>
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
