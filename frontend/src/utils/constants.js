export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export const ROLES = {
  ADMIN: 'admin',
  SECURITY: 'security',
  PROCESS: 'process',
}

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'security', label: 'Security' },
  { value: 'process', label: 'Process' }
]

export const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-800',
  security: 'bg-green-100 text-green-800',
  process: 'bg-yellow-100 text-yellow-800'
}

export const ROLE_DESCRIPTIONS = {
  admin: 'Full system access',
  security: 'Scan attendance and manage access',
  process: 'Manage specific process operations'
}

export const EMPLOYEE_TYPES = {
  PERMANENT: 'permanent',
  MANPOWER: 'manpower',
  CASUAL: 'casual',
}

export const ATTENDANCE_TYPES = {
  IN: 'IN',
  OUT: 'OUT',
}

export const WORK_SESSION_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
}
