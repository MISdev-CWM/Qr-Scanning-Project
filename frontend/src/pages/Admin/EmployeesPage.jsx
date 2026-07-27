import React, { useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { EmployeeForm } from '../../components/forms/EmployeeForm'
import { getEmployees, deleteEmployee } from '../../services/employee.service'
import { Plus, Search, Edit, Trash2, QrCode } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../hooks/useToast'

export const EmployeesPage = () => {
  const [employees, setEmployees] = useState([])
  const [filteredEmployees, setFilteredEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(undefined)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const navigate = useNavigate()
  const { showToast } = useToast()

  const fetchEmployees = async () => {
    setIsLoading(true)
    try {
      const data = await getEmployees()
      setEmployees(data)
    } catch (error) {
      console.error('Failed to fetch employees', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    let result = [...employees];
    
    // Sort by company name
    result.sort((a, b) => {
      const companyA = a.companyId?.companyName || a.companyId?.name || '';
      const companyB = b.companyId?.companyName || b.companyId?.name || '';
      return companyA.localeCompare(companyB);
    });

    if (filterType !== 'all') {
      result = result.filter((e) => e.employeeType === filterType);
    }
    
    if (companyFilter !== 'all') {
      result = result.filter((e) => (e.companyId?._id || e.companyId?.id) === companyFilter);
    }

    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(
        (e) =>
          (e.name && e.name.toLowerCase().includes(lowerSearch)) ||
          (e.employeeId && e.employeeId.toLowerCase().includes(lowerSearch))
      );
    }
    setFilteredEmployees(result);
  }, [search, filterType, companyFilter, employees]);

  const handleEdit = (employee) => {
    setEditingEmployee(employee)
    setIsModalOpen(true)
  }

  const handleDeleteClick = (id) => {
    setDeleteTarget(id)
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      setIsDeleting(true)
      const res = await deleteEmployee(deleteTarget)
      showToast(res.message || 'Employee deactivated successfully', 'success')
      fetchEmployees()
    } catch (error) {
      showToast('Failed to delete employee', 'error')
    } finally {
      setIsDeleting(false)
      setIsDeleteModalOpen(false)
      setDeleteTarget(null)
    }
  }

  const handleAdd = () => {
    setEditingEmployee(undefined)
    setIsModalOpen(true)
  }

  const handleSuccess = () => {
    setIsModalOpen(false)
    fetchEmployees()
  }

  const columns = [
    {
      header: 'Employee ID',
      accessor: 'employeeId',
    },
    {
      header: 'Name',
      accessor: 'name',
    },
    {
      header: 'Type',
      accessor: (item) => (
        <Badge variant={item.employeeType === 'permanent' ? 'success' : item.employeeType === 'casual' ? 'outline' : 'warning'}>
          {item.employeeType?.toUpperCase()}
        </Badge>
      ),
    },
    {
      header: 'Company',
      accessor: (item) => item.companyId?.companyName || item.companyId?.name || '-',
    },
    {
      header: 'Created At',
      accessor: (item) => item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-',
    },
    {
      header: 'Actions',
      accessor: (item) => (
        <div className="flex space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/employees/${item._id || item.id}`)}
          >
            <QrCode className="w-4 h-4" />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleEdit(item)}
          >
            <Edit className="w-4 h-4" />
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDeleteClick(item._id || item.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ]

  const uniqueCompanies = Array.from(
    new Map(
      employees
        .filter((e) => e.companyId)
        .map((e) => [
          e.companyId._id || e.companyId.id,
          e.companyId.companyName || e.companyId.name,
        ])
    ).entries()
  ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Employees
        </h1>

        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Employee
        </Button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex space-x-2">
            {['all', 'permanent', 'manpower', 'casual'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filterType === type
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-4 py-2 rounded-md text-sm font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Companies</option>
            {uniqueCompanies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Table
        data={filteredEmployees}
        columns={columns}
        keyExtractor={(item) => item._id || item.id}
        isLoading={isLoading}
        emptyMessage="No employees found"
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}
      >
        <EmployeeForm
          initialData={editingEmployee}
          onSuccess={handleSuccess}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Delete"
      >
        <div className="p-4">
          <p className="mb-6 text-slate-700">Are you sure you want to delete this employee?</p>
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} isLoading={isDeleting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
