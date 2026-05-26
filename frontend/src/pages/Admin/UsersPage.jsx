import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Table } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../hooks/useToast';
import userService from '../../services/user.service';
import { getProcesses } from '../../services/process.service';
import { ROLES, ROLE_OPTIONS, ROLE_COLORS, ROLE_DESCRIPTIONS } from '../../utils/constants';
import { Users, Edit, Trash2, Plus, UserCog, Link } from 'lucide-react';

export const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [processes, setProcesses] = useState([]);
  const [linkFormData, setLinkFormData] = useState({
    userId: '',
    processId: ''
  });
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: ROLES.SECURITY,
    email: '',
    assignedProcesses: []
  });
  const { showToast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchProcesses();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await userService.getAllUsers();
      setUsers(data);
    } catch (error) {
      showToast('Failed to fetch users', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProcesses = async () => {
    try {
      const data = await getProcesses();
      setProcesses(data);
    } catch (error) {
      console.error('Failed to fetch processes', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };

      if (selectedUser && !payload.password) {
        delete payload.password;
      }

      if (selectedUser) {
        await userService.updateUser(selectedUser._id, payload);
        showToast('User updated successfully', 'success');
      } else {
        await userService.createUser(payload);
        showToast('User created successfully', 'success');
      }
      setIsModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to save user', 'error');
    }
  };

  const handleRoleChange = async (newRole) => {
    try {
      await userService.updateUserRole(selectedUser._id, newRole);
      showToast('User role updated successfully', 'success');
      setIsRoleModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to update role', 'error');
    }
  };

  const handleDeleteClick = (userId) => {
    setDeleteTarget(userId);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await userService.deleteUser(deleteTarget);
      showToast('User deleted successfully', 'success');
      fetchUsers();
    } catch (error) {
      showToast('Failed to delete user', 'error');
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
    }
  };

  const openCreateModal = () => {
    setSelectedUser(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: '',
      name: user.name,
      role: user.role,
      email: user.email || '',
      assignedProcesses: user.assignedProcesses || []
    });
    setIsModalOpen(true);
  };

  const openRoleModal = (user) => {
    setSelectedUser(user);
    setIsRoleModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      name: '',
      role: ROLES.SECURITY,
      email: '',
      assignedProcesses: []
    });
  };

  const openLinkModal = () => {
    setLinkFormData({ userId: '', processId: '' });
    setIsLinkModalOpen(true);
  };

  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    try {
      await userService.linkUserToProcess(linkFormData.userId, linkFormData.processId);
      showToast('User linked to process successfully', 'success');
      setIsLinkModalOpen(false);
      fetchUsers();
      fetchProcesses();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to link user to process', 'error');
    }
  };

  const processUsers = users.filter(u => u.role === ROLES.PROCESS);
  const processOptions = processes.map(p => ({
    value: p.processId,
    label: `${p.processName} (${p.processId})`
  }));
  const processUserOptions = processUsers.map(u => ({
    value: u._id,
    label: `${u.name} (${u.username})`
  }));

  const columns = [
    {
      header: 'Username',
      accessor: (row) => (
        <div className="font-medium text-slate-900">{row.username}</div>
      )
    },
    {
      header: 'Name',
      accessor: 'name'
    },
    {
      header: 'Role',
      accessor: (row) => (
        <Badge className={ROLE_COLORS[row.role] || 'bg-gray-100 text-gray-800'}>
          {row.role.charAt(0).toUpperCase() + row.role.slice(1)}
        </Badge>
      )
    },
    {
      header: 'Email',
      accessor: (row) => row.email || '-'
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openRoleModal(row)}
            title="Change Role"
          >
            <UserCog className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(row)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteClick(row._id)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Users Management</h1>
              <p className="text-slate-600">Manage users and their roles</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={openLinkModal} variant="outline">
              <Link className="w-4 h-4 mr-2" />
              Link User to Process
            </Button>
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <Table 
            columns={columns} 
            data={users} 
            keyExtractor={(row) => row._id}
          />
        </div>
      </div>

      {/* Create/Edit User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedUser ? 'Edit User' : 'Create New User'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            required
            disabled={!!selectedUser}
          />

          <Input
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
          />

          <Select
            label="Role"
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            options={ROLE_OPTIONS}
            required
          />

          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
          />

          <Input
            label={selectedUser ? 'New Password' : 'Password'}
            name="password"
            type="password"
            value={formData.password}
            onChange={handleInputChange}
            required={!selectedUser}
            placeholder={selectedUser ? 'Leave blank to keep current password' : ''}
          />

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {selectedUser ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="Change User Role"
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            Select a new role for <strong>{selectedUser?.name}</strong>:
          </p>
          
          <div className="space-y-2">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleRoleChange(option.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  selectedUser?.role === option.value
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{option.label}</div>
                    <div className="text-sm text-slate-600">
                      {ROLE_DESCRIPTIONS[option.value]}
                    </div>
                  </div>
                  {selectedUser?.role === option.value && (
                    <Badge className="bg-indigo-100 text-indigo-800">Current</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="secondary"
              onClick={() => setIsRoleModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Link User to Process Modal */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Link User to Process"
      >
        <form onSubmit={handleLinkSubmit} className="space-y-4">
          <p className="text-slate-600 mb-4">
            Assign a user with process role to a specific process.
          </p>

          <Select
            label="Select User (Process Role)"
            value={linkFormData.userId}
            onChange={(e) => setLinkFormData({ ...linkFormData, userId: e.target.value })}
            options={processUserOptions}
            required
          />

          <Select
            label="Select Process"
            value={linkFormData.processId}
            onChange={(e) => setLinkFormData({ ...linkFormData, processId: e.target.value })}
            options={processOptions}
            required
          />

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsLinkModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              Link User to Process
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Delete"
      >
        <div className="p-4">
          <p className="mb-6 text-slate-700">
            Are you sure you want to delete this user? This action cannot be undone.
          </p>
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
  );
};

export default UsersPage;
