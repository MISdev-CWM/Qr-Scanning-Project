import React, { useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { BreakForm } from '../../components/forms/BreakForm'
import { getBreakSessions, createBreakSession, updateBreakSession, deleteBreakSession } from '../../services/break.service'
import { Plus } from 'lucide-react'
import { useToast } from '../../hooks/useToast'

export const BreaksPage = () => {
  const [breaks, setBreaks] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBreak, setEditingBreak] = useState(null)
  const [deleteId, setDeleteId] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    const loadBreaks = async () => {
      setIsLoading(true)
      try {
        const data = await getBreakSessions()
        setBreaks(data)
      } catch (error) {
        console.error('Failed to load breaks', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadBreaks()
  }, [])

  const handleSuccess = async (formData) => {
    setIsModalOpen(false)
    if (editingBreak) {
      await updateBreakSession(editingBreak._id, formData)
      showToast('Break updated successfully', 'success');
    } else {
      await createBreakSession(formData)
      showToast('Break created successfully', 'success');
    }
    const data = await getBreakSessions()
    setBreaks(data)
    setEditingBreak(null)
  }

  const handleEdit = (breakSession) => {
    setEditingBreak(breakSession)
    setIsModalOpen(true)
  }

  const handleDelete = (id) => {
    setDeleteId(id);
  }

  const confirmDelete = async () => {
    if (!deleteId) return;
    await deleteBreakSession(deleteId);
    showToast('Break deleted successfully', 'success');
    const data = await getBreakSessions();
    setBreaks(data);
    setDeleteId(null);
  };

  const cancelDelete = () => {
    setDeleteId(null);
  };

  const formatDurationMinutes = (item) => {
    if (item?.durationMinutes !== undefined && item?.durationMinutes !== null) {
      const n = Number(item.durationMinutes);
      if (!Number.isNaN(n) && n >= 0) return `${n} min`;
    }

    // Backward compatibility for old records.
    const start = item?.startTime ? new Date(item.startTime) : null;
    const end = item?.endTime ? new Date(item.endTime) : null;
    if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) return '';
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    return minutes > 0 ? `${minutes} min` : '';
  };

  const columns = [
    {
      header: 'Break Type',
      accessor: (item) => item.breakType,
    },
    {
      header: 'Duration',
      accessor: (item) => formatDurationMinutes(item),
    },
    {
      header: 'Actions',
      accessor: (item) => (
        <div className="flex space-x-2">
          <Button size="sm" variant="secondary" onClick={() => handleEdit(item)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(item._id)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Break Management
        </h1>

        <Button
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Record Break
        </Button>
      </div>

      <Table
        data={breaks}
        columns={columns}
        keyExtractor={(item) => item._id}
        isLoading={isLoading}
        emptyMessage="No break sessions recorded"
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingBreak(null); }}
        title={editingBreak ? 'Edit Break Session' : 'Record Break Session'}
      >
        <BreakForm
          initialData={editingBreak}
          onSuccess={handleSuccess}
          onCancel={() => { setIsModalOpen(false); setEditingBreak(null); }}
        />
      </Modal>

      {/* Custom Delete Confirmation Modal */}
            {/* Custom Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={cancelDelete}
        title="Confirm Delete"
      >
        <div className="p-4 text-center">
          <p className="mb-6 text-lg text-slate-700">Are you sure you want to delete this break session?</p>
          <div className="flex justify-center space-x-4">
            <Button variant="secondary" onClick={cancelDelete}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}