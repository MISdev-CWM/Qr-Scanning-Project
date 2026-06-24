import React, { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useToast } from '../../hooks/useToast'
import { createCompany, updateCompany } from '../../services/company.service'
import { isValidEmail } from '../../utils/validators'

export const CompanyForm = ({
  initialData,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    companyId: initialData?.companyId || '',
    companyName: initialData?.companyName || '',
    employeeTypeAllowed: initialData?.employeeTypeAllowed || '',
    createdAt: initialData?.createdAt || '',
  })

  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const { showToast } = useToast()

  const validate = () => {
    const newErrors = {};
    if (!formData.companyId || formData.companyId.length < 3) {
      newErrors.companyId = 'Company ID must be at least 3 characters';
    }
    if (!formData.companyName || formData.companyName.length < 3) {
      newErrors.companyName = 'Company Name must be at least 3 characters';
    }
    if (!formData.employeeTypeAllowed || !['manpower', 'permanent', 'casual'].includes(formData.employeeTypeAllowed)) {
      newErrors.employeeTypeAllowed = 'Select a valid employee type';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  } 

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)

    try {
      if (initialData) {
        await updateCompany(initialData.companyId, formData);
        showToast('Company updated successfully', 'success');
      } else {
        await createCompany(formData);
        showToast('Company created successfully', 'success');
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
  } 

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Company ID"
        value={formData.companyId}
        onChange={(e) =>
          setFormData({ ...formData, companyId: e.target.value })
        }
        error={errors.companyId}
      />

      <Input
        label="Company Name"
        value={formData.companyName}
        onChange={(e) =>
          setFormData({ ...formData, companyName: e.target.value })
        }
        error={errors.companyName}
      />

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Employee Type Allowed</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={formData.employeeTypeAllowed}
          onChange={(e) => setFormData({ ...formData, employeeTypeAllowed: e.target.value })}
        >
          <option value="">Select type</option>
          <option value="manpower">Manpower</option>
          <option value="permanent">Permanent</option>
          <option value="casual">Casual</option>
        </select>
        {errors.employeeTypeAllowed && (
          <div className="text-red-500 text-xs mt-1">{errors.employeeTypeAllowed}</div>
        )}
      </div>

      {/* createdAt is set automatically, but can be shown as read-only if editing */}
      {initialData && (
        <Input
          label="Created At"
          value={formData.createdAt ? new Date(formData.createdAt).toLocaleString() : ''}
          readOnly
        />
      )}

      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button type="submit" isLoading={isLoading}>
          {initialData ? 'Update Company' : 'Create Company'}
        </Button>
      </div>
    </form>
  )
}
