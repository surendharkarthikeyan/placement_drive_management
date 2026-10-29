import React, { useState, useEffect } from 'react'
import { X, Loader2, AlertCircle, Building2, User, Pencil } from 'lucide-react'
import { updateDriveDetails, getPlacementOfficers, getBatches } from '../../services/api'
import SearchableSelect from '../common/SearchableSelect'
import CustomSelect from '../common/CustomSelect'
import MultiSelectDropdown from '../common/MultiSelectDropdown'

/**
 * EditDriveModal
 * Modal to edit placement drive setup details:
 * - Company Name (read only / context)
 * - Job Role
 * - Placement Type
 * - Package (LPA)
 * - Drive Start Date
 * - Drive End Date
 * - Drive Owner (Searchable dropdown)
 * - Target Academic Batches (MultiSelect dropdown with checkboxes)
 * - Job Description
 */
export default function EditDriveModal({
  isOpen = false,
  onClose = () => {},
  drive = null,
  onDriveUpdated = () => {}
}) {
  const [officers, setOfficers] = useState([])
  const [batches, setBatches] = useState([])
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [formData, setFormData] = useState({
    job_role: '',
    placement_type: 'Full-time Placement',
    package_lpa: '',
    drive_start_date: '',
    drive_end_date: '',
    drive_owner_user_id: '',
    batch_ids: [],
    job_description: ''
  })

  // Load officers and batches
  useEffect(() => {
    if (isOpen) {
      const loadMetadata = async () => {
        try {
          setIsLoadingMetadata(true)
          const [officersData, batchesData] = await Promise.all([
            getPlacementOfficers(),
            getBatches()
          ])
          setOfficers(officersData)
          setBatches(batchesData)
        } catch (err) {
          console.error('Failed to load edit modal metadata:', err)
        } finally {
          setIsLoadingMetadata(false)
        }
      }
      loadMetadata()
    }
  }, [isOpen])

  // Populate initial values from drive prop
  useEffect(() => {
    if (drive && isOpen) {
      setFormData({
        job_role: drive.job_role || '',
        placement_type: drive.placement_type || 'Full-time Placement',
        package_lpa: drive.package_lpa ? `${drive.package_lpa} LPA` : '',
        drive_start_date: drive.drive_start_date ? drive.drive_start_date.substring(0, 10) : '',
        drive_end_date: drive.drive_end_date ? drive.drive_end_date.substring(0, 10) : '',
        drive_owner_user_id: drive.drive_owner_user_id ? String(drive.drive_owner_user_id) : '',
        batch_ids: drive.batch_ids ? Array.from(drive.batch_ids) : [],
        job_description: drive.job_description || ''
      })
      setErrorMessage('')
    }
  }, [drive, isOpen])

  if (!isOpen || !drive) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    if (!formData.job_role.trim()) {
      setErrorMessage('Please enter a Job Role.')
      return
    }

    try {
      setIsSubmitting(true)
      const numPackage = parseFloat(formData.package_lpa.replace(/[^0-9.]/g, '')) || 0

      // If user selected all or none, fallback to all batch IDs (never null)
      const finalBatchIds =
        formData.batch_ids && formData.batch_ids.length > 0
          ? formData.batch_ids
          : batches.map((b) => b.id)

      const payload = {
        job_role: formData.job_role.trim(),
        placement_type: formData.placement_type,
        package_lpa: numPackage,
        drive_start_date: formData.drive_start_date || '',
        drive_end_date: formData.drive_end_date || '',
        drive_owner_user_id: formData.drive_owner_user_id ? Number(formData.drive_owner_user_id) : null,
        batch_ids: finalBatchIds,
        job_description: formData.job_description.trim()
      }

      const updated = await updateDriveDetails(drive.id, payload)
      onDriveUpdated(updated)
      onClose()
    } catch (err) {
      console.error('Error updating drive:', err)
      setErrorMessage(err.response?.data?.error || 'Failed to update drive. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const companyName = drive.company?.company_name || 'Placement Company'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-[700px] max-h-[92vh] bg-white rounded-[20px] shadow-[0_24px_64px_-12px_rgba(15,23,42,0.30)] border border-[#dbe5f1] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-[26px_30px_20px] flex items-start justify-between border-b border-[#f1f5f9]">
          <div className="flex items-center gap-3.5">
            <div className="w-[44px] h-[44px] rounded-[13px] bg-[#eff6ff] border border-[#bfdbfe] flex items-center justify-center text-[#2563eb]">
              <Pencil size={21} />
            </div>
            <div>
              <h2 className="text-[24px] font-[850] text-[#172554] leading-tight">
                Edit Drive Details
              </h2>
              <p className="text-[14.5px] text-[#64748b] mt-[4px]">
                {companyName} · Update drive schedule, package, role, and batches
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[38px] h-[38px] flex items-center justify-center rounded-[10px] text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9] transition cursor-pointer"
          >
            <X size={21} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-[26px_30px] flex flex-col gap-[20px]">
          {errorMessage && (
            <div className="p-[12px_16px] bg-[#fef2f2] border border-[#fecaca] rounded-[12px] text-[14px] text-[#dc2626] flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Row 1: Company Name (Disabled / Context) & Job Role */}
          <div className="grid grid-cols-2 gap-[20px]">
            <div>
              <label className="text-[15px] font-[750] text-[#334155] block mb-[7px]">
                Company Name
              </label>
              <div className="w-full h-[50px] px-[15px] bg-[#f8fafc] border border-[#dbe5f1] rounded-[11px] text-[15.5px] font-[600] text-[#64748b] flex items-center gap-2 select-none">
                <Building2 size={18} className="text-[#94a3b8]" />
                <span>{companyName}</span>
              </div>
            </div>

            <div>
              <label className="text-[15px] font-[750] text-[#334155] block mb-[7px]">
                Job Role <span className="text-[#dc2626]">*</span>
              </label>
              <input
                type="text"
                name="job_role"
                value={formData.job_role}
                onChange={handleChange}
                placeholder="Job role"
                required
                className="w-full h-[50px] px-[15px] bg-white border border-[#dbe5f1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] text-[#1e293b] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition"
              />
            </div>
          </div>

          {/* Row 2: Package & Placement Type */}
          <div className="grid grid-cols-2 gap-[20px]">
            <div>
              <label className="text-[15px] font-[750] text-[#334155] block mb-[7px]">
                Package
              </label>
              <input
                type="text"
                name="package_lpa"
                value={formData.package_lpa}
                onChange={handleChange}
                placeholder="Example: 12 LPA"
                className="w-full h-[50px] px-[15px] bg-white border border-[#dbe5f1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] text-[#1e293b] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition"
              />
            </div>

            <div>
              <CustomSelect
                label="Placement Type"
                options={[
                  { value: 'Full-time Placement', label: 'Full-time Placement' },
                  { value: 'Internship + PPO', label: 'Internship + PPO' },
                  { value: 'Internship', label: 'Internship' },
                  { value: 'Apprenticeship', label: 'Apprenticeship' }
                ]}
                value={formData.placement_type}
                onChange={(val) => setFormData((prev) => ({ ...prev, placement_type: val }))}
                placeholder="Select placement type..."
              />
            </div>
          </div>

          {/* Row 3: Drive Start Date & Drive End Date */}
          <div className="grid grid-cols-2 gap-[20px]">
            <div>
              <label className="text-[15px] font-[750] text-[#334155] block mb-[7px]">
                Drive Start Date
              </label>
              <input
                type="date"
                name="drive_start_date"
                min="2000-01-01"
                max="2099-12-31"
                value={formData.drive_start_date}
                onChange={handleChange}
                className="w-full h-[50px] px-[15px] bg-white border border-[#dbe5f1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] text-[#1e293b] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition cursor-pointer"
              />
            </div>

            <div>
              <label className="text-[15px] font-[750] text-[#334155] block mb-[7px]">
                Drive End Date
              </label>
              <input
                type="date"
                name="drive_end_date"
                min="2000-01-01"
                max="2099-12-31"
                value={formData.drive_end_date}
                onChange={handleChange}
                className="w-full h-[50px] px-[15px] bg-white border border-[#dbe5f1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] text-[#1e293b] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition cursor-pointer"
              />
            </div>
          </div>

          {/* Row 4: Drive Owner (Searchable) & Target Academic Batches (Multi-Select) */}
          <div className="grid grid-cols-2 gap-[20px]">
            <div>
              <SearchableSelect
                label="Drive Owner (Placement Team)"
                icon={User}
                options={officers.map((o) => ({
                  value: o.id,
                  label: o.name,
                  sublabel: o.email || 'Placement Office'
                }))}
                value={formData.drive_owner_user_id}
                onChange={(val) => setFormData((prev) => ({ ...prev, drive_owner_user_id: val }))}
                placeholder="Select placement officer..."
                searchPlaceholder="Search officer name or email..."
              />
            </div>

            <div>
              <MultiSelectDropdown
                label="Target Academic Batch"
                options={batches.map((b) => ({
                  value: b.id,
                  label: `Batch ${b.name}`
                }))}
                selectedValues={formData.batch_ids}
                onChange={(vals) => setFormData((prev) => ({ ...prev, batch_ids: vals }))}
                placeholder="Select target batches..."
              />
            </div>
          </div>

          {/* Row 5: Job Description */}
          <div>
            <label className="text-[15px] font-[750] text-[#334155] block mb-[7px]">
              Job Description / Drive Notes
            </label>
            <textarea
              name="job_description"
              value={formData.job_description}
              onChange={handleChange}
              rows={3}
              placeholder="Software development role requiring strong DSA, problem-solving, and communication skills."
              className="w-full p-[14px] bg-white border border-[#dbe5f1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] font-[500] text-[#1e293b] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition leading-relaxed resize-y shadow-xs"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-[20px] mt-[6px] border-t border-[#f1f5f9] flex items-center justify-end gap-[14px]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-[22px] py-[12px] text-[15.5px] font-[700] text-[#475569] bg-white hover:bg-[#f8fafc] border border-[#dbe5f1] rounded-[11px] transition cursor-pointer active:scale-98"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-[28px] py-[12px] text-[15.5px] font-[750] text-white bg-[#2563eb] hover:bg-[#1d4ed8] rounded-[11px] shadow-sm hover:shadow-md transition cursor-pointer flex items-center gap-2 active:scale-98 disabled:opacity-70"
            >
              {isSubmitting && <Loader2 size={18} className="animate-spin" />}
              <span>{isSubmitting ? 'Saving...' : 'Save Drive Details'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

