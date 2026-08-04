import api from './api'

// Back-compat: getWorkSessions(statusString)
// New: getWorkSessions({ date: 'YYYY-MM-DD' })
export const getWorkSessions = async (arg) => {
  const params = {}
  if (typeof arg === 'string' && arg) {
    params.status = arg
  } else if (arg && typeof arg === 'object') {
    if (arg.date) params.date = arg.date
  }
  const response = await api.get('/api/work-session', {
    params,
  })
  return response.data.sessions || []
}

export const startWorkSession = async (data) => {
  const response = await api.post('/api/work-session/start', data)
  return response.data.session
}

export const stopWorkSession = async (id) => {
  const response = await api.post(`/api/work-session/${id}/stop`)
  return response.data.session
}

// Admin-only: update a work session's start/end times
export const updateWorkSessionTimes = async (sessionId, { startTime, endTime }) => {
  if (!sessionId) throw new Error('sessionId is required')

  const payload = {}
  if (startTime !== undefined) payload.startTime = startTime
  if (endTime !== undefined) payload.endTime = endTime

  const response = await api.put(`/api/work-session/sessions/${sessionId}/times`, payload)
  return response.data?.session || response.data
}

// Admin-only: get active (checked-in) work sessions grouped by processName
export const getActiveSessionsByProcess = async () => {
  const response = await api.get('/api/work-session/active-by-process')
  return response.data?.grouped || {}
}
