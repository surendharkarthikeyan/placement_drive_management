import React, { useState, useEffect } from 'react'
import { Save, Loader2, CheckCircle2, AlertCircle, Trophy, Sparkles, Building2, SlidersHorizontal, PlusCircle, AlertTriangle, Pencil, User, Lock } from 'lucide-react'
import { getDriveById, updateDriveDetails, getPlacementOfficers, getBatches } from '../../../services/api'
import EditEligibilityModal from '../../modals/placement_drive/EditEligibilityModal'
import EditDriveModal from '../../modals/placement_drive/EditDriveModal'
import SearchableSelect from '../../common/SearchableSelect'
import CustomSelect from '../../common/CustomSelect'
import MultiSelectDropdown from '../../common/MultiSelectDropdown'
import DriveStudentsRoster from './DriveStudentsRoster'
import DriveStagesAndOutcomes from './DriveStagesAndOutcomes'
import FinalSelectionWorkspace from './FinalSelectionWorkspace'
import FilterAndIncludeStudentsModal from '../../modals/placement_drive/FilterAndIncludeStudentsModal'

/**
 * CenterWorkspacePanel (Middle Panel)
 * - Directly connected to MySQL via GET /api/drives/:id & PUT /api/drives/:id
 * - Duplicate button removed as requested
 * - Top Row: Title, Subtitle, Status Badge, Edit Drive button, Save Changes button
 * - KPI Summary Cards: Initially eligible, Included in drive, Reached final stage, Awaiting final result, Not cleared/absent
 * - Workflow navigation: 1. Drive Setup, 2. Student List, 3. Stages & Outcomes, 4. Final Selection
 * - Live Form fields for Company & Drive Information with Custom & Searchable Selects
 * - Eligibility Conditions tag view
 */
export default function CenterWorkspacePanel({
  selectedDriveId = null,
  onDriveUpdated = () => {},
  onDriveLoaded = () => {},
  onDirtyChange = () => {},
  saveTrigger = 0,
  refreshKey = 0
}) {
  const [drive, setDrive] = useState(null)
  const isDriveCompleted = drive?.overall_status === 'completed'
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState('setup')
  const [officers, setOfficers] = useState([])
  const [batches, setBatches] = useState([])
  const [isEligibilityModalOpen, setIsEligibilityModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isIncludeStudentsModalOpen, setIsIncludeStudentsModalOpen] = useState(false)
  const [studentsRosterKey, setStudentsRosterKey] = useState(0)
  const driveCacheRef = React.useRef({})

  const extractFormData = (data) => ({
    company_name: data?.company?.company_name || '',
    job_role: data?.job_role || '',
    placement_type: data?.placement_type || 'Full-time Placement',
    package_lpa: data?.package_lpa ? `${data.package_lpa} LPA` : '',
    drive_start_date: data?.drive_start_date ? data.drive_start_date.substring(0, 10) : '',
    drive_end_date: data?.drive_end_date ? data.drive_end_date.substring(0, 10) : '',
    drive_owner_user_id: data?.drive_owner_user_id ? String(data.drive_owner_user_id) : '',
    batch_ids: data?.batch_ids ? Array.from(data.batch_ids) : [],
    job_description: data?.job_description || ''
  })

  // Initial and Editable Form State
  const [initialData, setInitialData] = useState(null)
  const [formData, setFormData] = useState({
    company_name: '',
    job_role: '',
    placement_type: 'Full-time Placement',
    package_lpa: '',
    drive_start_date: '',
    drive_end_date: '',
    drive_owner_user_id: '',
    batch_ids: [],
    job_description: ''
  })

  // Track if changes are unsaved
  useEffect(() => {
    if (!initialData) {
      onDirtyChange(false)
      return
    }
    const isDirty =
      formData.job_role !== initialData.job_role ||
      formData.placement_type !== initialData.placement_type ||
      formData.package_lpa !== initialData.package_lpa ||
      formData.drive_start_date !== initialData.drive_start_date ||
      formData.drive_end_date !== initialData.drive_end_date ||
      formData.drive_owner_user_id !== initialData.drive_owner_user_id ||
      formData.job_description !== initialData.job_description ||
      JSON.stringify(formData.batch_ids || []) !== JSON.stringify(initialData.batch_ids || [])

    onDirtyChange(isDirty)
  }, [formData, initialData])

  // Fetch placement officers and batches for dropdowns
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [officersData, batchesData] = await Promise.all([
          getPlacementOfficers(),
          getBatches()
        ])
        setOfficers(officersData)
        setBatches(batchesData)
      } catch (err) {
        console.error('Failed to load placement metadata:', err)
      }
    }
    loadMetadata()
  }, [])

  // Fetch selected drive from backend with instant cache swap (no blinking)
  useEffect(() => {
    if (!selectedDriveId) return

    // 1. Instant swap from in-memory cache if available (eliminates blink completely)
    const cached = driveCacheRef.current[selectedDriveId]
    if (cached) {
      setDrive(cached)
      onDriveLoaded(cached)
      const cachedForm = extractFormData(cached)
      setFormData(cachedForm)
      setInitialData(cachedForm)
      onDirtyChange(false)
    } else if (!drive) {
      setIsLoading(true)
    }

    // 2. Fetch fresh details from backend
    const fetchDriveDetails = async () => {
      try {
        const data = await getDriveById(selectedDriveId)
        driveCacheRef.current[selectedDriveId] = data
        setDrive(data)
        onDriveLoaded(data)

        const loadedForm = extractFormData(data)
        setFormData(loadedForm)
        setInitialData(loadedForm)
        onDirtyChange(false)
      } catch (err) {
        console.error('Failed to fetch drive details:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDriveDetails()
  }, [selectedDriveId, refreshKey])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Save changes to backend via PUT /api/drives/:id
  const handleSaveChanges = async () => {
    if (!selectedDriveId) return
    if (!formData.batch_ids || formData.batch_ids.length === 0) {
      alert('Please choose the target academic batch option.')
      return false
    }
    try {
      setIsSaving(true)
      const numPackage = parseFloat(formData.package_lpa.replace(/[^0-9.]/g, '')) || 0

      const payload = {
        job_role: formData.job_role,
        placement_type: formData.placement_type,
        package_lpa: numPackage,
        drive_start_date: formData.drive_start_date,
        drive_end_date: formData.drive_end_date,
        drive_owner_user_id: formData.drive_owner_user_id ? Number(formData.drive_owner_user_id) : null,
        batch_ids: formData.batch_ids,
        job_description: formData.job_description
      }

      const updated = await updateDriveDetails(selectedDriveId, payload)
      const merged = { ...drive, ...updated }
      if (selectedDriveId) driveCacheRef.current[selectedDriveId] = merged
      setDrive(merged)
      setInitialData({ ...formData })
      onDirtyChange(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      onDriveUpdated()
      return true
    } catch (err) {
      console.error('Failed to save drive details:', err)
      alert('Failed to save changes. Please try again.')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // Respond to programmatic save triggers (e.g. from prompt dialog or right panel)
  useEffect(() => {
    if (saveTrigger > 0) {
      handleSaveChanges()
    }
  }, [saveTrigger])

  if (isLoading && !drive) {
    return (
      <section className="flex-1 h-full overflow-y-auto p-[22px] bg-[#f5f8fc] flex items-center justify-center">
        <div className="flex items-center gap-2 text-[#64748b] text-[14px]">
          <Loader2 size={20} className="animate-spin text-[#2563eb]" />
          <span>Loading drive details...</span>
        </div>
      </section>
    )
  }

  if (!drive) {
    return (
      <section className="flex-1 h-full overflow-y-auto p-[22px] bg-[#f5f8fc] flex items-center justify-center">
        <div className="text-center p-8 bg-white border border-[#dbe5f1] rounded-[14px] shadow-xs max-w-sm">
          <p className="text-[14px] text-[#64748b]">Select a drive from the left panel to view workspace.</p>
        </div>
      </section>
    )
  }

  const companyName = drive.company?.company_name || 'Placement Company'
  const stats = drive.stats || {}
  const eligibility = drive.eligibility

  // Helper for status badge presentation
  const getBadgeDetails = (status) => {
    switch (status) {
      case 'draft':
        return { label: 'Draft', bg: 'bg-[#f1f5f9]', text: 'text-[#475569]', border: 'border-[#cbd5e1]' }
      case 'registration_open':
        return { label: 'Registration Open', bg: 'bg-[#ecfdf5]', text: 'text-[#059669]', border: 'border-[#a7f3d0]' }
      case 'scheduled':
        return { label: 'Scheduled', bg: 'bg-[#eff6ff]', text: 'text-[#2563eb]', border: 'border-[#bfdbfe]' }
      case 'in_progress':
        return { label: 'In Progress', bg: 'bg-[#eff6ff]', text: 'text-[#1d4ed8]', border: 'border-[#bfdbfe]' }
      case 'awaiting_next_round':
        return { label: 'Awaiting Next Round', bg: 'bg-[#fefce8]', text: 'text-[#ca8a04]', border: 'border-[#fef08a]' }
      case 'awaiting_final_result':
        return { label: 'Awaiting Final Result', bg: 'bg-[#fffbeb]', text: 'text-[#d97706]', border: 'border-[#fde68a]' }
      case 'completed':
        return { label: 'Completed', bg: 'bg-[#f0fdf4]', text: 'text-[#16a34a]', border: 'border-[#bbf7d0]' }
      case 'on_hold':
        return { label: 'On Hold', bg: 'bg-[#fef2f2]', text: 'text-[#b91c1c]', border: 'border-[#fecaca]' }
      case 'cancelled':
        return { label: 'Cancelled', bg: 'bg-[#f8fafc]', text: 'text-[#64748b]', border: 'border-[#cbd5e1]' }
      default:
        return { label: status || 'Draft', bg: 'bg-[#f1f5f9]', text: 'text-[#475569]', border: 'border-[#cbd5e1]' }
    }
  }

  const statusBadge = getBadgeDetails(drive.overall_status)

  return (
    <section className="flex-1 h-full overflow-y-auto p-[22px] bg-[#f5f8fc] text-[#1e293b] select-none flex flex-col gap-[18px]">
      {/* 1. Top Row: Title, Subtitle, Status Badge, Edit Drive button */}
      <div className="flex items-start justify-between gap-[16px]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[23px] font-[850] text-[#172554] m-0 leading-tight">
              {companyName} Placement Drive
            </h1>
            <span className={`py-[3px] px-[10px] rounded-full text-[12px] font-[750] border shadow-2xs ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
              {statusBadge.label}
            </span>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="py-[4px] px-[10px] bg-white hover:bg-[#f8fafc] text-[#2563eb] border border-[#bfdbfe] hover:border-[#93c5fd] rounded-[8px] text-[12px] font-[700] shadow-2xs hover:shadow-xs transition cursor-pointer flex items-center gap-1.5 active:scale-98"
              title="Edit full drive details in modal"
            >
              <Pencil size={13} className="text-[#2563eb]" />
              <span>Edit Drive</span>
            </button>
          </div>
          <p className="text-[13px] text-[#64748b] mt-[4px] mb-0">
            {drive.job_role} · {drive.package_lpa ? `${drive.package_lpa} LPA` : 'Competitive'} · Placement Drive Record
          </p>
        </div>
      </div>

      {/* 2. KPI Summary Cards (5 Colored Border-Top Cards) */}
      <div className="grid grid-cols-5 gap-[12px]">
        {[
          { label: 'Initially eligible', count: stats.initially_eligible ?? 182, border: 'border-t-[#2563eb]', isSpecial: false },
          { label: 'Included in drive', count: stats.included_in_drive ?? (drive.total_students || 148), border: 'border-t-[#7c3aed]', isSpecial: false },
          { label: 'Reached final stage', count: stats.reached_final_stage ?? 24, border: 'border-t-[#16a34a]', isSpecial: false },
          { label: 'Not cleared / absent', count: stats.not_cleared_absent ?? 124, border: 'border-t-[#dc2626]', isSpecial: false },
          { label: 'Offered students', count: stats.offered_students ?? (drive.stats?.offers_count ?? 0), border: 'border-t-[#f59e0b]', isSpecial: true }
        ].map((card, i) => (
          <div
            key={i}
            className={`relative p-[16px_18px] border border-t-[4px] ${card.border} rounded-[13px] transition-all duration-200 ${
              card.isSpecial
                ? 'bg-gradient-to-br from-[#fffdf5] via-[#fefce8] to-[#fef3c7]/50 border-[#fde68a] shadow-[0_4px_12px_rgba(245,158,11,0.12)]'
                : 'bg-white border-[#dbe5f1] shadow-[0_1px_3px_rgba(15,23,42,0.03)]'
            }`}
          >
            {card.isSpecial && (
              <div className="absolute top-[14px] right-[14px] w-[32px] h-[32px] rounded-full bg-gradient-to-tr from-[#f59e0b] to-[#fbbf24] flex items-center justify-center text-white shadow-sm ring-2 ring-[#fef08a]">
                <Trophy size={16} className="text-white drop-shadow-xs" />
              </div>
            )}
            <strong className={`block text-[28px] font-[850] leading-tight ${card.isSpecial ? 'text-[#b45309]' : 'text-[#172554]'}`}>
              {card.count}
            </strong>
            <span className={`text-[14px] mt-[6px] block leading-[1.3] font-semibold flex items-center gap-1.5 ${card.isSpecial ? 'text-[#92400e]' : 'text-[#475569]'}`}>
              {card.label}
              {card.isSpecial && <Sparkles size={13} className="text-[#f59e0b]" />}
            </span>
          </div>
        ))}
      </div>

      {/* 3. Workflow Step Navigation Tabs */}
      <div className="flex items-center gap-[6px] border-b border-[#dbe5f1]">
        {[
          { id: 'setup', label: '1. Drive Setup' },
          { id: 'students', label: '2. Student List' },
          { id: 'stages', label: '3. Stages & Outcomes' },
          { id: 'final', label: '4. Final Selection' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`py-[12px] px-[18px] text-[15px] font-[800] transition border-b-2 cursor-pointer ${
              activeTab === tab.id
                ? 'text-[#2563eb] border-b-[#2563eb]'
                : 'text-[#64748b] border-b-transparent hover:text-[#1e293b]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Tab 1: Drive Setup Content */}
      {activeTab === 'setup' && (
        <div className="flex flex-col gap-[18px]">
          {isDriveCompleted && (
            <div className="flex items-center gap-2.5 p-3.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-[12px] text-[#475569] text-[13px] font-medium shadow-2xs">
              <Lock size={16} className="text-[#64748b] shrink-0" />
              <span>
                This placement drive is marked as completed. Drive setup, student roster, and stages are finalized and locked. (Offer letters can still be managed in the <strong>4. Final Selection</strong> tab).
              </span>
            </div>
          )}

          {/* Card: Company and Drive Information with Premium Styling */}
          <div className="p-[24px] bg-white border border-[#dbe5f1] border-t-4 border-t-[#2563eb] rounded-[16px] shadow-[0_2px_8px_rgba(15,23,42,0.04)] relative">
            <div className="flex items-center justify-between mb-[22px]">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-[12px] bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] border border-[#bfdbfe] flex items-center justify-center text-[#2563eb] shadow-xs">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="text-[18px] font-[850] text-[#172554] m-0">
                    Company and Drive Information
                  </h3>
                  <p className="text-[13.5px] text-[#64748b] mt-[3px] mb-0 font-medium">
                    Enter the basic details received from the company.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-3 gap-[20px]">
              {/* Company Name */}
              <div>
                <label className="text-[14px] font-[800] text-[#334155] block mb-[8px]">
                  Company Name
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  disabled
                  title="Company name is tied to company master record"
                  className="w-full h-[48px] px-[14px] bg-[#f8fafc] border border-[#cbd5e1] rounded-[10px] text-[15px] font-[650] text-[#334155] cursor-not-allowed shadow-inner"
                />
              </div>

              {/* Job Role */}
              <div>
                <label className="text-[14px] font-[800] text-[#334155] block mb-[8px]">
                  Job Role
                </label>
                <input
                  type="text"
                  name="job_role"
                  value={formData.job_role}
                  onChange={handleInputChange}
                  disabled={isDriveCompleted}
                  placeholder="Job role"
                  className={`w-full h-[48px] px-[14px] rounded-[10px] text-[15px] font-[600] outline-none shadow-xs transition ${
                    isDriveCompleted
                      ? 'bg-[#f8fafc] text-[#64748b] border border-[#cbd5e1] cursor-not-allowed'
                      : 'bg-white text-[#1e293b] border border-[#cbd5e1] focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/15'
                  }`}
                />
              </div>

              {/* Placement Type (Custom Dropdown) */}
              <div>
                <label className="text-[14px] font-[800] text-[#334155] block mb-[8px]">
                  Placement Type
                </label>
                <CustomSelect
                  options={[
                    { value: 'Full-time Placement', label: 'Full-time Placement' },
                    { value: 'Internship + PPO', label: 'Internship + PPO' },
                    { value: 'Internship', label: 'Internship' },
                    { value: 'Apprenticeship', label: 'Apprenticeship' }
                  ]}
                  value={formData.placement_type}
                  onChange={(val) => !isDriveCompleted && setFormData((prev) => ({ ...prev, placement_type: val }))}
                  disabled={isDriveCompleted}
                  placeholder="Select type"
                />
              </div>

              {/* Package */}
              <div>
                <label className="text-[14px] font-[800] text-[#334155] block mb-[8px]">
                  Package
                </label>
                <input
                  type="text"
                  name="package_lpa"
                  value={formData.package_lpa}
                  onChange={handleInputChange}
                  disabled={isDriveCompleted}
                  placeholder="e.g. 18.5 LPA"
                  className={`w-full h-[48px] px-[14px] rounded-[10px] text-[15px] font-[600] outline-none shadow-xs transition ${
                    isDriveCompleted
                      ? 'bg-[#f8fafc] text-[#64748b] border border-[#cbd5e1] cursor-not-allowed'
                      : 'bg-white text-[#1e293b] border border-[#cbd5e1] focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/15'
                  }`}
                />
              </div>

              {/* Drive Start Date */}
              <div>
                <label className="text-[14px] font-[800] text-[#334155] block mb-[8px]">
                  Drive Start Date
                </label>
                <input
                  type="date"
                  name="drive_start_date"
                  min="2000-01-01"
                  max="2099-12-31"
                  value={formData.drive_start_date}
                  onChange={handleInputChange}
                  disabled={isDriveCompleted}
                  className={`w-full h-[48px] px-[14px] rounded-[10px] text-[15px] font-[600] outline-none shadow-xs transition ${
                    isDriveCompleted
                      ? 'bg-[#f8fafc] text-[#64748b] border border-[#cbd5e1] cursor-not-allowed'
                      : 'bg-white text-[#1e293b] border border-[#cbd5e1] focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/15 cursor-pointer'
                  }`}
                />
              </div>

              {/* Drive End Date */}
              <div>
                <label className="text-[14px] font-[800] text-[#334155] block mb-[8px]">
                  Drive End Date
                </label>
                <input
                  type="date"
                  name="drive_end_date"
                  min="2000-01-01"
                  max="2099-12-31"
                  value={formData.drive_end_date}
                  onChange={handleInputChange}
                  disabled={isDriveCompleted}
                  className={`w-full h-[48px] px-[14px] rounded-[10px] text-[15px] font-[600] outline-none shadow-xs transition ${
                    isDriveCompleted
                      ? 'bg-[#f8fafc] text-[#64748b] border border-[#cbd5e1] cursor-not-allowed'
                      : 'bg-white text-[#1e293b] border border-[#cbd5e1] focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/15 cursor-pointer'
                  }`}
                />
              </div>

              {/* Drive Owner (Searchable Dropdown) */}
              <div>
                <label className="text-[14px] font-[800] text-[#334155] block mb-[8px]">
                  Drive Owner
                </label>
                <SearchableSelect
                  options={officers.map((officer) => ({
                    value: String(officer.id),
                    label: officer.name,
                    subtext: officer.email || 'Placement Team'
                  }))}
                  value={formData.drive_owner_user_id}
                  onChange={(val) => !isDriveCompleted && setFormData((prev) => ({ ...prev, drive_owner_user_id: val }))}
                  disabled={isDriveCompleted}
                  placeholder="Select placement officer"
                  searchPlaceholder="Search officer..."
                  icon={User}
                />
              </div>

              {/* Target Academic Batch (Multi-select Dropdown) */}
              <div className="col-span-2">
                <MultiSelectDropdown
                  label="Target Academic Batch"
                  required
                  options={batches.map((b) => ({
                    value: b.id,
                    label: `Batch ${b.name}`
                  }))}
                  selectedValues={formData.batch_ids}
                  onChange={(ids) => !isDriveCompleted && setFormData((prev) => ({ ...prev, batch_ids: ids }))}
                  disabled={isDriveCompleted}
                  placeholder="Choose batch(es)..."
                />
              </div>

              {/* Job Description / Notes - Full Width */}
              <div className="col-span-3">
                <label className="text-[14px] font-[800] text-[#334155] block mb-[8px]">
                  Job Description / Drive Notes
                </label>
                <textarea
                  name="job_description"
                  value={formData.job_description}
                  onChange={handleInputChange}
                  disabled={isDriveCompleted}
                  rows={3}
                  placeholder="Software development role requiring strong DSA, problem-solving, and communication skills."
                  className={`w-full p-[14px] rounded-[11px] text-[15px] font-[500] leading-relaxed resize-y shadow-xs outline-none transition ${
                    isDriveCompleted
                      ? 'bg-[#f8fafc] text-[#64748b] border border-[#cbd5e1] cursor-not-allowed'
                      : 'bg-white text-[#1e293b] border border-[#cbd5e1] focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/15'
                  }`}
                />
              </div>
            </div>

            {/* Save Changes Button located right inside Company and Drive Information card */}
            <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t border-[#f1f5f9]">
              {saveSuccess && (
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#16a34a] bg-[#dcfce7] border border-[#bbf7d0] px-3 py-1.5 rounded-[9px] animate-in fade-in duration-200">
                  <CheckCircle2 size={15} />
                  Saved!
                </span>
              )}

              {isDriveCompleted ? (
                <div className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0] rounded-[10px] shadow-2xs select-none">
                  <Lock size={15} />
                  <span>Drive Completed (Locked)</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="py-[9px] px-[20px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[10px] text-[13.5px] font-[750] shadow-sm hover:shadow transition cursor-pointer flex items-center gap-2 active:scale-98 disabled:opacity-75"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Card: Eligibility Conditions */}
          <div className="p-[20px] bg-white border border-[#dbe5f1] rounded-[14px] shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between mb-[14px]">
              <div>
                <h3 className="text-[16px] font-[850] text-[#334155] m-0">
                  Eligibility Conditions
                </h3>
                <p className="text-[12px] text-[#64748b] mt-[3px] mb-0">
                  {eligibility
                    ? 'These conditions are used to filter students for this drive.'
                    : 'No eligibility criteria configured yet. Set criteria to filter students.'}
                </p>
              </div>

              {!isDriveCompleted && (
                <button
                  type="button"
                  onClick={() => setIsEligibilityModalOpen(true)}
                  className={`py-[8px] px-[16px] text-[13px] font-[800] rounded-[8px] transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
                    eligibility
                      ? 'text-[#2563eb] bg-[#eff6ff] hover:bg-[#dbeafe] border border-[#bfdbfe]'
                      : 'text-white bg-[#2563eb] hover:bg-[#1d4ed8]'
                  }`}
                >
                  {eligibility ? (
                    <>
                      <SlidersHorizontal size={14} />
                      <span>Edit Conditions</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle size={15} />
                      <span>Set Criteria</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* If criteria not set yet */}
            {!eligibility ? (
              <div className="p-4 rounded-[10px] bg-[#fffbeb] border border-[#fef08a] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-[#d97706] shrink-0" size={20} />
                  <div>
                    <strong className="text-[13.5px] font-[800] text-[#92400e] block">
                      Criteria Not Configured
                    </strong>
                    <span className="text-[12px] text-[#b45309]">
                      Click "Set Criteria" to define the minimum CGPA, 10th/12th percentages, and allowed arrears from the <code>placement_drive_eligibility</code> table.
                    </span>
                  </div>
                </div>
                {!isDriveCompleted && (
                  <button
                    type="button"
                    onClick={() => setIsEligibilityModalOpen(true)}
                    className="py-1.5 px-3 text-[12px] font-bold text-[#b45309] bg-white border border-[#fde68a] hover:bg-[#fef9c3] rounded-[7px] cursor-pointer shadow-xs"
                  >
                    Configure Now
                  </button>
                )}
              </div>
            ) : (
              /* Eligibility Condition Tags */
              <div className="flex flex-wrap gap-[8px]">
                {drive?.batches && drive.batches.length > 0 && (
                  <span className="py-[6px] px-[12px] rounded-full text-[12px] font-semibold text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe]">
                    Batches: {drive.batches.map((b) => b.name).join(', ')}
                  </span>
                )}
                {eligibility.min_cgpa !== null && eligibility.min_cgpa !== undefined && (
                  <span className="py-[6px] px-[12px] rounded-full text-[12px] font-semibold text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe]">
                    CGPA ≥ {eligibility.min_cgpa}
                  </span>
                )}
                {eligibility.min_tenth_mark !== null && eligibility.min_tenth_mark !== undefined && (
                  <span className="py-[6px] px-[12px] rounded-full text-[12px] font-semibold text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe]">
                    10th ≥ {eligibility.min_tenth_mark}%
                  </span>
                )}
                {eligibility.min_twelfth_mark !== null && eligibility.min_twelfth_mark !== undefined && (
                  <span className="py-[6px] px-[12px] rounded-full text-[12px] font-semibold text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe]">
                    12th ≥ {eligibility.min_twelfth_mark}%
                  </span>
                )}
                {eligibility.max_current_arrears !== null && eligibility.max_current_arrears !== undefined && (
                  <span className="py-[6px] px-[12px] rounded-full text-[12px] font-semibold text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe]">
                    Current Arrears: ≤ {eligibility.max_current_arrears}
                  </span>
                )}
                {eligibility.max_history_arrears !== null && eligibility.max_history_arrears !== undefined && (
                  <span className="py-[6px] px-[12px] rounded-full text-[12px] font-semibold text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe]">
                    History Arrears: ≤ {eligibility.max_history_arrears}
                  </span>
                )}
                {eligibility.max_existing_offer_lpa !== null && eligibility.max_existing_offer_lpa !== undefined && (
                  <span className="py-[6px] px-[12px] rounded-full text-[12px] font-semibold text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe]">
                    Offer Cap: ≤ {eligibility.max_existing_offer_lpa} LPA
                  </span>
                )}
                {eligibility.min_cgpa === null &&
                  eligibility.min_tenth_mark === null &&
                  eligibility.min_twelfth_mark === null &&
                  eligibility.max_current_arrears === null &&
                  eligibility.max_history_arrears === null &&
                  eligibility.max_existing_offer_lpa === null && (
                    <span className="py-[6px] px-[12px] rounded-full text-[12px] font-semibold text-[#15803d] bg-[#dcfce7] border border-[#bbf7d0]">
                      Open to All Students (No Criteria)
                    </span>
                  )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Student List */}
      {activeTab === 'students' && (
        <div className="flex flex-col gap-4">
          {!eligibility ? (
            <div className="p-8 bg-white border border-[#fef08a] rounded-[14px] text-center flex flex-col items-center justify-center gap-3 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-[#fef3c7] text-[#d97706] flex items-center justify-center">
                <AlertTriangle size={26} />
              </div>
              <h3 className="text-[17px] font-[850] text-[#172554] m-0">
                Set Eligibility Criteria First
              </h3>
              <p className="text-[13px] text-[#64748b] max-w-md m-0">
                You cannot view or include students for this drive until you configure the minimum eligibility criteria.
              </p>
              <button
                type="button"
                onClick={() => setIsEligibilityModalOpen(true)}
                className="mt-2 px-5 py-2.5 rounded-[10px] text-[13.5px] font-[800] text-white bg-[#2563eb] hover:bg-[#1d4ed8] shadow-sm transition cursor-pointer"
              >
                Set Criteria Now
              </button>
            </div>
          ) : (
            <DriveStudentsRoster
              key={studentsRosterKey}
              driveId={selectedDriveId}
              eligibility={eligibility}
              isDriveCompleted={isDriveCompleted}
              officerUserId={formData.drive_owner_user_id ? parseInt(formData.drive_owner_user_id, 10) : 6}
              isRosterConfirmed={drive?.roster_confirmed}
              onDriveUpdated={onDriveUpdated}
              onNavigateToStages={() => setActiveTab('stages')}
              onOpenFilterModal={() => !isDriveCompleted && setIsIncludeStudentsModalOpen(true)}
              onConfigureCriteria={() => !isDriveCompleted && setIsEligibilityModalOpen(true)}
            />
          )}
        </div>
      )}

      {/* Tab 3: Stages & Outcomes Phase */}
      {activeTab === 'stages' && (
        <DriveStagesAndOutcomes
          driveId={selectedDriveId}
          officerUserId={formData.drive_owner_user_id ? parseInt(formData.drive_owner_user_id, 10) : 6}
          isDriveCompleted={isDriveCompleted}
          overallStatus={drive?.overall_status}
          isRosterConfirmed={drive?.roster_confirmed}
          onDriveUpdated={onDriveUpdated}
          onNavigateToRoster={() => setActiveTab('students')}
          onNavigateToFinalSelection={() => setActiveTab('final')}
        />
      )}

      {/* Tab 4: Final Selection Phase */}
      {activeTab === 'final' && (
        <FinalSelectionWorkspace
          driveId={selectedDriveId}
          officerUserId={formData.drive_owner_user_id ? parseInt(formData.drive_owner_user_id, 10) : 6}
          onDriveUpdated={onDriveUpdated}
          onNavigateToTab={(tab) => setActiveTab(tab)}
        />
      )}

      {/* Modal to Edit/Set Eligibility Criteria */}
      <EditEligibilityModal
        isOpen={isEligibilityModalOpen}
        onClose={() => setIsEligibilityModalOpen(false)}
        driveId={selectedDriveId}
        currentEligibility={eligibility}
        onEligibilitySaved={(newEligibility) => {
          setDrive((prev) => {
            const next = { ...prev, eligibility: newEligibility }
            if (selectedDriveId) driveCacheRef.current[selectedDriveId] = next
            return next
          })
          onDriveUpdated()
        }}
      />

      {/* Modal to Edit Complete Drive Details */}
      <EditDriveModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        drive={drive}
        onDriveUpdated={(updatedDrive) => {
          if (updatedDrive) {
            const merged = { ...drive, ...updatedDrive }
            if (selectedDriveId) driveCacheRef.current[selectedDriveId] = merged
            setDrive(merged)
            const freshForm = extractFormData(merged)
            setFormData(freshForm)
            setInitialData(freshForm)
            onDirtyChange(false)
          }
          onDriveUpdated()
        }}
      />

      {/* Modal to Filter & Include Students (with Special Entry support) */}
      <FilterAndIncludeStudentsModal
        isOpen={isIncludeStudentsModalOpen}
        onClose={() => setIsIncludeStudentsModalOpen(false)}
        driveId={selectedDriveId}
        eligibility={eligibility}
        onRosterUpdated={() => {
          setStudentsRosterKey((k) => k + 1)
          onDriveUpdated()
        }}
      />
    </section>
  )
}

