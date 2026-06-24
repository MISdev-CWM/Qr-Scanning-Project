import React, { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useToast } from '../../hooks/useToast'
import { createEmployee, updateEmployee } from '../../services/employee.service'
import { getCompanies } from '../../services/company.service'
import { isDateAfter } from '../../utils/validators'

export const EmployeeForm = ({
  initialData,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    employeeId: initialData?.employeeId || '',
    name: initialData?.name || '',
    employeeType: initialData?.employeeType || 'permanent',
    companyId: initialData?.companyId || '',
    // isActive: initialData?.isActive ?? true,
  })

  const [companies, setCompanies] = useState([])
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  const { showToast } = useToast()

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const data = await getCompanies()
        setCompanies(data)
      } catch (error) {
        showToast('Failed to load companies', 'error')
      }
    }

    fetchCompanies()
  }, [showToast])

  const validate = () => {
    const newErrors = {};
    if (!formData.name || formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    if (!formData.companyId) {
      newErrors.companyId = 'Company is required';
    }
    if (!formData.employeeType) {
      newErrors.employeeType = 'Employee type is required';
    }
    // employeeId validation
    // if (formData.employeeType === 'permanent') {
    //   if (!formData.employeeId || formData.employeeId.length < 2) {
    //     newErrors.employeeId = 'Permanent employees must have an Employee ID';
    //   }
    // } else if (formData.employeeType === 'manpower') {
    //   if (formData.employeeId) {
    //     newErrors.employeeId = 'Manpower employees must not have an Employee ID';
    //   }
    // }
    if (['permanent', 'manpower', 'casual'].includes(formData.employeeType)) {
      if (!formData.employeeId || formData.employeeId.length < 2) {
        newErrors.employeeId = 'Employees must have an Employee ID';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      const payload = { ...formData };
      if (initialData) {
        await updateEmployee(initialData._id, payload);
        showToast('Employee updated successfully', 'success');
      } else {
        await createEmployee(payload);
        showToast('Employee created successfully', 'success');
      }
      onSuccess();
    } catch (error) {
      showToast(
        error?.response?.data?.error || 'Operation failed',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Casual employees use the same company list as permanent employees.
  const filteredCompanies = companies.filter((c) => {
    return c.employeeTypeAllowed === formData.employeeType;
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Employee Type"
          value={formData.employeeType}
          onChange={(e) => setFormData({ ...formData, employeeType: e.target.value, employeeId: '' })}
          options={[
            { value: 'permanent', label: 'Permanent' },
            { value: 'manpower', label: 'Manpower' },
            { value: 'casual', label: 'Casual' },
          ]}
          error={errors.employeeType}
        />

        <Select
          label="Company"
          value={formData.companyId}
          onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
          options={filteredCompanies.map((c) => ({
            value: c._id || c.id,
            label: c.companyName || c.name,
          }))}
          error={errors.companyId}
        />
      </div>
      <Input
        label="Employee ID"
        value={formData.employeeId}
        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
        error={errors.employeeId}
        // disabled={formData.employeeType === 'manpower'}
        // className={formData.employeeType === 'manpower' ? 'bg-slate-100' : ''}
      />
      <Input
        label="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        error={errors.name}
      />

      

      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {initialData ? 'Update Employee' : 'Create Employee'}
        </Button>
      </div>
    </form>
  );
}
