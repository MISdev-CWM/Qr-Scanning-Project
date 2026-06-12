import api from './api'

const tryParseJson = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

const tryDecodeBase64Json = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // Quick heuristic: base64 is usually longer and only has these chars.
  if (!/^[A-Za-z0-9+/=]+$/.test(trimmed)) return null
  try {
    const json = atob(trimmed)
    return JSON.parse(json)
  } catch {
    return null
  }
}

export const getAttendance = async (date) => {
  const response = await api.get('/api/attendance', {
    params: { date },
  })
  return response.data.data
}

// Accepts either a QRCode _id/code or employeeId
// Added employeeIdOverride parameter for manpower QR codes
export const scanAttendance = async (input, scanType, employeeIdOverride = null) => {
  let qrId = input;
  let employeeObjectId = employeeIdOverride // Use override if provided

  // 1) Some QR codes in this app are generated as JSON strings.
  //    Example: { qrId: 'abc123', employeeId: '507f1f77bcf86cd799439011' }
  const parsedJson = tryParseJson(qrId)
  if (parsedJson && typeof parsedJson === 'object') {
    // Extract qrId from JSON
    if (typeof parsedJson.qrId === 'string' && parsedJson.qrId.trim()) {
      qrId = parsedJson.qrId.trim()
    }
    // Extract employeeId (MongoDB ObjectId) if present and not already overridden
    if (!employeeObjectId && typeof parsedJson.employeeId === 'string' && /^[a-fA-F0-9]{24}$/.test(parsedJson.employeeId)) {
      employeeObjectId = parsedJson.employeeId
    }
    // Fallback: If employeeId is a business ID (EMP001), keep it in qrId for resolution below
    else if (!employeeObjectId && typeof parsedJson.employeeId === 'string' && parsedJson.employeeId.trim()) {
      qrId = parsedJson.employeeId.trim()
    }
  }

  // 2) Backend-generated QR images may encode a base64 JSON payload.
  //    If so, extract employeeId and resolve to a QR id.
  const parsedBase64 = !parsedJson ? tryDecodeBase64Json(qrId) : null
  if (parsedBase64 && typeof parsedBase64 === 'object') {
    const payloadEmployeeId = parsedBase64.employeeId
    // If payload has a Mongo ObjectId for employee, resolve QR directly.
    if (typeof payloadEmployeeId === 'string' && /^[a-fA-F0-9]{24}$/.test(payloadEmployeeId)) {
      if (!employeeObjectId) {
        employeeObjectId = payloadEmployeeId
      }
      try {
        const qrRes = await api.get(`/api/qr/employee/${payloadEmployeeId}`)
        if (qrRes?.data?.qrId) {
          qrId = qrRes.data.qrId
        }
      } catch (err) {
        console.error('Error resolving QR code from base64 payload:', err)
      }
    }
  }

  // If input looks like an employeeId (starts with EMP or is not a valid ObjectId/UUID), fetch QRCode for employee
  if (typeof qrId === 'string' && (qrId.startsWith('EMP') || qrId.length < 24)) {
    // Try to fetch QRCode for employee
    try {
      // Don't strip the prefix - employee IDs are stored with their full format (EMP001, ABC001, etc.)
      const empId = qrId.trim();
      console.log('Looking up employee with ID:', empId);
      
      // Get employee by business employeeId (scoped endpoint)
      const empRes = await api.get('/api/employees/lookup', { params: { employeeId: empId } });
      console.log('Employee lookup response:', empRes.data);
      
      const employee = empRes.data;
      
      if (!employee || !employee._id) {
        throw new Error(`Employee with ID '${empId}' not found`);
      }
      
      console.log('Found employee:', employee);

      // Get existing QR id for employee (no admin permission required)
      const qrRes = await api.get(`/api/qr/employee/${employee._id}`);
      console.log('QR lookup response:', qrRes.data);
      qrId = qrRes.data.qrId;
      
      if (!qrId) {
        throw new Error('QR code lookup failed - no qrId returned');
      }
    } catch (err) {
      console.error('Error resolving QR code:', err);
      // Preserve the original error message if available
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Could not resolve QR code for employee';
      throw new Error(errorMsg);
    }
  }

  // Build the request payload
  const payload = {
    context: 'SECURITY',
    qrId,
  }

  // Add scanType if provided
  if (scanType) {
    payload.scanType = scanType
  }

  // Add employeeId if we have one (for manpower QR codes)
  if (employeeObjectId) {
    payload.employeeId = employeeObjectId
  }

  const response = await api.post('/api/attendance/scan', payload)
  return response.data.attendance || response.data;
}

export const getDailySummary = async (date) => {
  const response = await api.get('/api/attendance/daily-summary', {
    params: { date },
  })
  return response.data
}

export const getOTSummary = async (date) => {
  const response = await api.get('/api/attendance/ot-summary', {
    params: { date },
  })
  return response.data
}

export const getRecentAttendanceLogs = async (limit = 10) => {
  const response = await api.get('/api/attendance/recent', {
    params: { limit },
  })
  return Array.isArray(response.data) ? response.data : []
}

// Admin-only: employees whose latest SECURITY scan for the date is IN
export const getNonCheckoutEmployees = async (date) => {
  const response = await api.get('/api/attendance/non-checkout', {
    params: { date },
  })
  return response.data
}

// Admin-only: update scan time for a specific attendance log
export const updateAttendanceLogScanTime = async (attendanceLogId, scanTime) => {
  if (!attendanceLogId) {
    throw new Error('attendanceLogId is required')
  }

  const response = await api.put(`/api/attendance/logs/${attendanceLogId}/scan-time`, {
    scanTime,
  })

  return response.data?.attendance || response.data
}

// Admin-only: create a manual attendance log (e.g. if employee wasn't checked out)
export const createManualAttendanceLog = async ({ employeeId, companyId, scanType, scanTime, workDate }) => {
  const response = await api.post('/api/attendance/logs/manual', {
    employeeId,
    companyId,
    scanType,
    scanTime,
    workDate,
  })
  return response.data?.attendance || response.data
}