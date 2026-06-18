import React, { useEffect, useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { QRCodeDisplay } from '../../components/features/QRCodeDisplay'
import { getEmployee, getEmployeeQrId } from '../../services/employee.service'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export const EmployeeDetailPage = () => {
  const { id } = useParams()
  const [employee, setEmployee] = useState(null)
  const [qrValue, setQrValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const navigate = useNavigate()

  useEffect(() => {
    const fetchEmployee = async () => {
      if (!id) return

      try {
        const data = await getEmployee(id)
        setEmployee(data)

        // Prefer the backend-issued QR id for scanning.
        // This is what the attendance endpoints expect.
        try {
          const qrId = await getEmployeeQrId(data._id)
          if (qrId) setQrValue(qrId)
        } catch (err) {
          console.error('Failed to fetch employee QR id', err)
          setQrValue('')
        }
      } catch (error) {
        console.error('Failed to fetch employee', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchEmployee()
  }, [id])

  if (isLoading) {
    return (
      <DashboardLayout>
        Loading...
      </DashboardLayout>
    )
  }

  if (!employee) {
    return (
      <DashboardLayout>
        Employee not found
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => navigate('/employees')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Employees
        </Button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {employee.name}
            </h1>
          </div>

          <Badge
            variant={
              employee.employeeType === 'permanent'
                ? 'info'
                : 'warning'
            }
            className="text-sm px-3 py-1"
          >
            {employee.employeeType ? employee.employeeType.toUpperCase() : ''}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card title="Employee Information">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
              <div>
                <dt className="text-sm font-medium text-slate-500">
                  Employee ID
                </dt>
                <dd className="mt-1 text-sm text-slate-900 font-mono">
                  {employee.employeeId}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-slate-500">
                  Company
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {employee.companyId?.companyName || 'N/A'}
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        <div>
          <Card title="Identity QR Code">
            <div className="flex justify-center py-4">
              <QRCodeDisplay
                value={qrValue || employee.employeeId}
                label={employee.name}
                employeeId={employee.employeeId}
                name={employee.name}
                employeeType={employee.employeeType}
                companyName={employee.companyId?.companyName}
              />
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
