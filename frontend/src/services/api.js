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

export const getDriveCompletion = async (id) => {
  const response = await api.get(`/drives/${id}/completion`)
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

export const confirmDriveStudentsRoster = async (id, officerUserId = null) => {
  const response = await api.post(`/drives/${id}/confirm-students`, { officer_user_id: officerUserId })
  return response.data || {}
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

export const getDepartments = async () => {
  const response = await api.get('/departments')
  return response.data?.data || []
}

// Stages & Outcomes APIs
export const getDriveStages = async (driveId) => {
  const response = await api.get(`/drives/${driveId}/stages`)
  return response.data?.data || []
}

export const createDriveStage = async (driveId, stageData) => {
  const response = await api.post(`/drives/${driveId}/stages`, stageData)
  return response.data?.data
}

export const updateDriveStage = async (driveId, stageId, stageData) => {
  const response = await api.put(`/drives/${driveId}/stages/${stageId}`, stageData)
  return response.data?.data
}

export const createDriveSubstage = async (driveId, stageId, substageData) => {
  const response = await api.post(`/drives/${driveId}/stages/${stageId}/substages`, substageData)
  return response.data?.data
}

export const getStageResults = async (driveId, stageId, substageId = null) => {
  const params = {}
  if (substageId) params.substage_id = substageId
  const response = await api.get(`/drives/${driveId}/stages/${stageId}/results`, { params })
  return response.data?.data || []
}

export const updateStageResults = async (driveId, stageId, updates, officerUserId = null) => {
  const response = await api.put(`/drives/${driveId}/stages/${stageId}/results`, {
    updates,
    officer_user_id: officerUserId,
  })
  return response.data
}

export const addSpecialEntryToStage = async (driveId, stageId, userIds, substageId = null, officerUserId = null) => {
  const response = await api.post(`/drives/${driveId}/stages/${stageId}/special-entry`, {
    user_ids: userIds,
    substage_id: substageId,
    officer_user_id: officerUserId,
  })
  return response.data
}

export const completeDriveStage = async (driveId, stageId, officerUserId = null) => {
  const response = await api.post(`/drives/${driveId}/stages/${stageId}/complete`, {
    officer_user_id: officerUserId,
  })
  return response.data
}

export const completeDriveSubstage = async (driveId, stageId, substageId, officerUserId = null) => {
  const response = await api.post(`/drives/${driveId}/stages/${stageId}/substages/${substageId}/complete`, {
    officer_user_id: officerUserId,
  })
  return response.data
}

export const updateSubstageStatus = async (driveId, stageId, substageId, status) => {
  const response = await api.patch(`/drives/${driveId}/stages/${stageId}/substages/${substageId}/status`, {
    status,
  })
  return response.data
}



export const completeRecruitmentProcess = async (driveId, officerUserId = null) => {
  const response = await api.post(`/drives/${driveId}/complete-recruitment`, {
    officer_user_id: officerUserId,
  })
  return response.data
}

export const getFinalSelection = async (driveId) => {
  const response = await api.get(`/drives/${driveId}/final-selection`)
  return response.data?.data || null
}

export const saveFinalSelection = async (driveId, payload) => {
  const response = await api.post(`/drives/${driveId}/final-selection`, payload)
  return response.data
}

export const uploadReferenceDocument = async (driveId, file) => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post(`/drives/${driveId}/upload-reference-doc`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

export const uploadOfferLetter = async (driveId, driveStudentId, rollNo, companyCode, file) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('drive_student_id', driveStudentId)
  formData.append('roll_no', rollNo || '')
  formData.append('company_code', companyCode || '')
  const response = await api.post(`/drives/${driveId}/upload-offer-letter`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

export const downloadOfferLetterUrl = (driveId, driveStudentId) => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'
  return `${baseURL}/drives/${driveId}/download-offer-letter/${driveStudentId}`
}

export const updateStudentOffer = async (driveId, studentId, { final_role, package_lpa }) => {
  const response = await api.put(`/drives/${driveId}/offers/${studentId}`, {
    final_role,
    package_lpa
  })
  return response.data
}

// Student Placement Review
export const getStudentReviewDetail = async (userId = 'default') => {
  const response = await api.get(`/student-review/${userId}`)
  return response.data
}

export const getStudentRecruitmentHistory = async (userId = 'default', page = 1, limit = 5) => {
  const response = await api.get(`/student-review/${userId}/history`, {
    params: { page, limit }
  })
  return response.data
}

export const getStudentCompanyProcesses = async (userId = 'default', search = '') => {
  const response = await api.get(`/student-review/${userId}/company-processes`, {
    params: { search }
  })
  return response.data
}

export const getReviewAnalytics = async (filters = {}) => {
  const response = await api.post('/student-review/analytics', filters)
  return response.data
}

export const getReviewStudents = async (filters = {}, sort = 'opportunity_priority') => {
  const response = await api.post('/student-review/students', {
    filter: filters,
    sort
  })
  return response.data
}

export const saveStudentReviewNote = async (userId, note) => {
  const response = await api.post(`/student-review/${userId}/notes`, { note })
  return response.data
}

export const updateStudentReviewNote = async (noteId, note) => {
  const response = await api.put(`/student-review/notes/${noteId}`, { note })
  return response.data
}

export const deleteStudentReviewNote = async (noteId) => {
  const response = await api.delete(`/student-review/notes/${noteId}`)
  return response.data
}

export const exportReviewStudentsExcel = async (studentIds = [], filters = {}) => {
  const response = await api.post(
    '/student-review/export',
    { student_ids: studentIds, filter: filters },
    { responseType: 'blob' }
  )
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `Student_Placement_Review_${new Date().toISOString().slice(0, 10)}.xlsx`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

// Placement Intelligence APIs
export const getIntelligenceBatchSummaries = async () => {
  const response = await api.get('/intelligence/batch-summaries')
  return response.data?.data || []
}

export const getIntelligenceOutcomeSummary = async (batch = '') => {
  const params = {}
  if (batch && batch !== 'all') params.batch = batch
  const response = await api.get('/intelligence/outcome-summary', { params })
  return response.data?.data || {}
}

export const getIntelligenceOutcomeStudents = async ({ outcome = 'notPlaced', batch = '', department = '', type = '' } = {}) => {
  const params = {}
  if (outcome) params.outcome = outcome
  if (type) params.type = type
  if (batch && batch !== 'all' && batch !== 'All') {
    params.batch = String(batch).replace(/[\u2013\u2014]/g, '-')
  }
  if (department && department !== 'all' && department !== 'All' && department !== 'All Departments') {
    params.department = department
  }
  const response = await api.get('/intelligence/outcome-students', { params })
  return response.data?.data || []
}

export const getIntelligenceOverallStats = async (arg1 = {}, arg2 = '') => {
  let batch = ''
  let department = ''
  if (typeof arg1 === 'object' && arg1 !== null) {
    batch = arg1.batch || ''
    department = arg1.department || ''
  } else {
    batch = arg1 || ''
    department = arg2 || ''
  }
  const params = {}
  if (batch && batch !== 'all' && batch !== 'All') {
    params.batch = String(batch).replace(/[\u2013\u2014]/g, '-')
  }
  if (department && department !== 'all' && department !== 'All' && department !== 'All Departments') {
    params.department = department
  }
  const response = await api.get('/intelligence/overall-stats', { params })
  return response.data?.data !== undefined ? response.data.data : response.data
}

export const exportIntelligenceExcel = async (batch = '', department = '') => {
  const params = {}
  if (batch && batch !== 'all' && batch !== 'All') {
    params.batch = String(batch).replace(/[\u2013\u2014]/g, '-')
  }
  if (department && department !== 'all' && department !== 'All' && department !== 'All Departments') {
    params.department = department
  }
  const response = await api.get('/intelligence/overall-stats/export', {
    params,
    responseType: 'blob'
  })
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `Overall_Placement_Statistics_${new Date().toISOString().slice(0, 10)}.xlsx`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const getIntelligenceIndustryMatrix = async ({ sector = 'all', department = 'All' } = {}) => {
  const params = {}
  if (sector && sector !== 'all') params.sector = sector
  if (department && department !== 'All' && department !== 'All Departments') {
    params.department = department
  }
  const response = await api.get('/intelligence/industry-matrix', { params })
  return response.data?.data !== undefined ? response.data.data : response.data
}

export const getIntelligenceIndustryRightPanel = async ({ batch = '', sector = 'all', department = 'All' } = {}) => {
  const params = {}
  if (batch && batch !== 'all' && batch !== 'All') {
    params.batch = String(batch).replace(/[\u2013\u2014]/g, '-')
  }
  if (sector && sector !== 'all') params.sector = sector
  if (department && department !== 'All' && department !== 'All Departments') {
    params.department = department
  }
  const response = await api.get('/intelligence/industry-right-panel', { params })
  return response.data?.data !== undefined ? response.data.data : response.data
}

export const getIntelligenceIndustryCompanies = async ({ metric = 'visited', batch = '', sector = 'all', department = 'All' } = {}) => {
  const params = { metric }
  if (batch && batch !== 'all' && batch !== 'All') {
    params.batch = String(batch).replace(/[\u2013\u2014]/g, '-')
  }
  if (sector && sector !== 'all') params.sector = sector
  if (department && department !== 'All' && department !== 'All Departments') {
    params.department = department
  }
  const response = await api.get('/intelligence/industry-companies', { params })
  return response.data?.data !== undefined ? response.data.data : response.data
}

export const getIntelligenceCompanyDrives = async ({ companyId = '', companyName = '', batch = '', role = '', department = '' } = {}) => {
  const params = {}
  if (companyId) params.company_id = companyId
  if (companyName) params.company_name = companyName
  if (batch && batch !== 'All') params.batch = batch
  if (role && role !== 'All Roles' && role !== 'All') params.role = role
  if (department && department !== 'All Departments' && department !== 'All') params.department = department

  const response = await api.get('/intelligence/company-recruitment-drives', { params })
  return response.data?.data !== undefined ? response.data.data : response.data
}

export default api
