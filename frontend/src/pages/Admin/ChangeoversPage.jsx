import React, { useEffect, useMemo, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../hooks/useToast'
import { createChangeover, deleteChangeover, getChangeovers } from '../../services/changeover.service'

const pad2 = (n) => String(n).padStart(2, '0')
const todayYyyyMmDd = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export const ChangeoversPage = () => {
  const { showToast } = useToast()

  const [date, setDate] = useState(todayYyyyMmDd())
  const [rows, setRows] = useState([])
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const load = async (day) => {
    setIsLoading(true)
    try {
      const data = await getChangeovers(day)
      setRows(Array.isArray(data?.rows) ? data.rows : [])
    } catch (error) {
      setRows([])
      const msg = error?.response?.data?.message || error?.message || 'Failed to load changeovers'
      showToast(msg, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const submit = async () => {
    const n = Number(minutes)
    if (Number.isNaN(n) || n < 0) {
      showToast('Minutes must be a non-negative number', 'error')
      return
    }

    if (!minutes) {
      showToast('Changeover minutes is required', 'error')
      return
    }

    if (!note.trim()) {
      showToast('Changeover note is required', 'error')
      return
    }

    try {
      await createChangeover({
        date,
        durationMinutes: n,
        note: note?.trim() || undefined,
      })
      showToast('Changeover created successfully', 'success')
      setMinutes('')
      setNote('')
      await load(date)
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to create changeover'
      showToast(msg, 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await deleteChangeover(deleteId)
      showToast('Changeover deleted successfully', 'success')
      await load(date)
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to delete changeover'
      showToast(msg, 'error')
    } finally {
      setDeleteId(null)
    }
  }

  const tableRows = useMemo(() => (Array.isArray(rows) ? rows : []), [rows])

  const columns = [
    {
      header: 'Minutes',
      accessor: (item) => `${Number(item?.durationMinutes) || 0} min`,
      className: 'whitespace-nowrap',
    },
    {
      header: 'Note',
      accessor: (item) => item?.note || '—',
    },
    {
      header: 'Actions',
      accessor: (item) => (
        <div className="flex space-x-2">
          <Button size="sm" variant="danger" onClick={() => setDeleteId(item._id)}>
            Delete
          </Button>
        </div>
      ),
      className: 'whitespace-nowrap',
    },
  ]

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Temporary Changeovers</h1>
          <p className="text-slate-600">Temporary breaks that only affect the selected date</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Input
                label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required={true}
              />
            </div>

            <div>
              <Input
                label="Minutes"
                type="number"
                min="0"
                required={true}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="e.g. 15"
              />
            </div>

            <div className="md:col-span-2">
              <Input
                label="Note"
                value={note}
                required={true}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. machine changeover"
              />
            </div>

            <div className="md:col-span-4 flex justify-end">
              <Button onClick={submit} disabled={isLoading}>
                Add Changeover
              </Button>
            </div>
          </div>
        </div>

        <Table
          data={tableRows}
          columns={columns}
          keyExtractor={(item) => item._id}
          isLoading={isLoading}
          emptyMessage={date ? `No changeovers recorded for ${date}` : 'No changeovers recorded'}
        />
      </div>

      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Confirm Delete"
      >
        <div className="p-4 text-center">
          <p className="mb-6 text-lg text-slate-700">Are you sure you want to delete this changeover?</p>
          <div className="flex justify-center space-x-4">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
