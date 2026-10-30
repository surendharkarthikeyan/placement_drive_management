import axios from 'axios'

const API_BASE_URL = 'http://127.0.0.1:8080/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Drives API
export const getDrives = async ({ status = 'all', search = '', batch = '' } = {}) => {
  const params = {}
  if (status && status !== 'all') params.status = status
  if (search) params.search = search
  if (batch && batch !== 'all') params.batch = batch

  const response = await api.get('/drives', { params })
  return response.data?.data || []
}

export const getDriveById = async (id) => {
  const response = await api.get(`/drives/${id}`)
  return response.data?.data
}

export const createDrive = async (driveData) => {
  const response = await api.post('/drives', driveData)
  return response.data?.data
}

export const updateDriveDetails = async (id, updateData) => {
  const response = await api.put(`/drives/${id}`, updateData)
  return response.data?.data
}

export const updateDriveStatus = async (id, overallStatus) => {
  const response = await api.patch(`/drives/${id}/status`, {
    overall_status: overallStatus,
  })
  return response.data
}

export const getDriveActivities = async (id) => {
  const response = await api.get(`/drives/${id}/activities`)
  return response.data?.data || []
}

export const updateDriveEligibility = async (id, eligibilityData) => {
  const response = await api.put(`/drives/${id}/eligibility`, eligibilityData)
  return response.data?.data
}

export const getDriveStudents = async (id) => {
  const response = await api.get(`/drives/${id}/students`)
  return response.data?.data || []
}

export const updateDriveStudentsRoster = async (id, updates) => {
  const response = await api.post(`/drives/${id}/students`, { updates })
  return response.data?.data || []
}

export const getCompanies = async () => {
  const response = await api.get('/companies')
  return response.data?.data || []
}

export const getPlacementOfficers = async () => {
  const response = await api.get('/placement-officers')
  return response.data?.data || []
}

export const getBatches = async () => {
  const response = await api.get('/batches')
  return response.data?.data || []
}

export default api
