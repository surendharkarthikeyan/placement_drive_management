import React, { useState, useEffect } from 'react'
import { X, Loader2, AlertCircle, Building2, User, GraduationCap } from 'lucide-react'
import { createDrive, getPlacementOfficers, getCompanies, getBatches } from '../../services/api'
import SearchableSelect from '../common/SearchableSelect'
import CustomSelect from '../common/CustomSelect'

/**
 * CreateDriveModal
 * Scaled up modal with larger, clearer fonts, labels, and input fields:
 * - Company Name: Dropdown listing only companies from `placement_company` table
 * - Target Batch: Dropdown listing available academic batches
 * - Title: 24px font
 * - Subtitle: 15px font
 * - Labels: 15px font (font weight 750)
 * - Inputs & Dropdowns: 50px height, 15.5px text font
 * - Buttons: 15.5px font, generous padding
 */
export default function CreateDriveModal({
  isOpen = false,
  onClose = () => {},
  onDriveCreated = () => {}
}) {
  const [officers, setOfficers] = useState([])
  const [companies, setCompanies] = useState([])
  const [batches, setBatches] = useState([])
  const [isLoadingOfficers, setIsLoadingOfficers] = useState(false)
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [formData, setFormData] = useState({
    company_name: '',
    job_role: '',
    package_lpa: '',
    drive_start_date: '',
    drive_end_date: '',
    drive_owner_user_id: '',
    placement_type: 'Full-time Placement',
    batch_id: '',
    job_description: ''
  })

  // Load placement officers, companies, and batches
  useEffect(() => {
    if (isOpen) {
      const loadInitialData = async () => {
        try {
          setIsLoadingOfficers(true)
          setIsLoadingCompanies(true)

          const [officersData, companiesData, batchesData] = await Promise.all([
            getPlacementOfficers(),
            getCompanies(),
            getBatches()
          ])

          setOfficers(officersData)
          setCompanies(companiesData)
          setBatches(batchesData)

          setFormData((prev) => ({
            ...prev,
            company_name: prev.company_name || (companiesData.length > 0 ? companiesData[0].company_name : ''),
            drive_owner_user_id: prev.drive_owner_user_id || (officersData.length > 0 ? officersData[0].id : '')
          }))
        } catch (err) {
          console.error('Failed to load initial modal data:', err)
        } finally {
          setIsLoadingOfficers(false)
          setIsLoadingCompanies(false)
        }
      }
      loadInitialData()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    if (!formData.company_name.trim() || !formData.job_role.trim()) {
      setErrorMessage('Please fill in both Company Name and Job Role.')
      return
    }

    try {
      setIsSubmitting(true)
      const numPackage = parseFloat(formData.package_lpa.replace(/[^0-9.]/g, '')) || 0

      const payload = {
        company_name: formData.company_name.trim(),
        job_role: formData.job_role.trim(),
        placement_type: formData.placement_type,
        package_lpa: numPackage,
        drive_start_date: formData.drive_start_date || '',
        drive_end_date: formData.drive_end_date || '',
        drive_owner_user_id: formData.drive_owner_user_id ? Number(formData.drive_owner_user_id) : null,
        batch_id: formData.batch_id ? Number(formData.batch_id) : null,
        job_description: formData.job_description.trim()
      }

      const created = await createDrive(payload)
      onDriveCreated(created)
      onClose()
    } catch (err) {
      console.error('Error creating drive:', err)
      setErrorMessage(err.response?.data?.error || 'Failed to create drive. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/45 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal Card - Scaled to max-w-[700px] with responsive max height and smooth scroll */}
      <div className="w-full max-w-[700px] max-h-[92vh] bg-white rounded-[20px] shadow-[0_24px_64px_-12px_rgba(15,23,42,0.30)] border border-[#dbe5f1] overflow-y-auto flex flex-col">
        {/* Modal Header */}
        <div className="p-[26px_30px_20px] flex items-start justify-between border-b border-[#f1f5f9]">
          <div>
            <h2 className="text-[24px] font-[850] text-[#172554] leading-tight">
              Create Placement Drive
            </h2>
            <p className="text-[14.5px] text-[#64748b] mt-[5px]">
              Create the drive first; students and recruitment stages can be added next.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[38px] h-[38px] flex items-center justify-center rounded-[10px] text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9] transition cursor-pointer"
          >
            <X size={21} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-[26px_30px] flex flex-col gap-[20px]">
          {errorMessage && (
            <div className="p-[12px_16px] bg-[#fef2f2] border border-[#fecaca] rounded-[12px] text-[14px] text-[#dc2626] flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Row 1: Company Name & Job Role */}
          <div className="grid grid-cols-2 gap-[20px]">
            <div>
              <SearchableSelect
                label="Company Name"
                required
                icon={Building2}
                options={companies.map((c) => ({
                  value: c.company_name,
                  label: c.company_name,
                  sublabel: c.company_code ? `Code: ${c.company_code}` : ''
                }))}
                value={formData.company_name}
                onChange={(val) => setFormData((prev) => ({ ...prev, company_name: val }))}
                placeholder="Select company..."
                searchPlaceholder="Search company or code..."
              />
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
                className="w-full h-[50px] px-[15px] bg-white border border-[#dbe5f1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition"
              />
            </div>
          </div>

          {/* Row 2: Package & Expected Drive Date */}
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
                placeholder="Example: 10 LPA"
                className="w-full h-[50px] px-[15px] bg-white border border-[#dbe5f1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition"
              />
            </div>

            <div>
              <label className="text-[15px] font-[750] text-[#334155] block mb-[7px]">
                Expected Drive Date
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
          </div>

          {/* Row 3: Drive End Date & Drive Owner */}
          <div className="grid grid-cols-2 gap-[20px]">
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
          </div>

          {/* Row 4: Placement Type & Target Academic Batch */}
          <div className="grid grid-cols-2 gap-[20px]">
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

            <div>
              <label className="text-[15px] font-[750] text-[#334155] block mb-[7px]">
                Target Academic Batch
              </label>
              <select
                name="batch_id"
                value={formData.batch_id}
                onChange={handleChange}
                className="w-full h-[50px] px-[15px] bg-white border border-[#dbe5f1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] font-[600] text-[#1e293b] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition cursor-pointer shadow-xs"
              >
                <option value="">Open to All Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Batch {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-[20px] mt-[8px] border-t border-[#f1f5f9] flex items-center justify-end gap-[14px]">
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
              <span>{isSubmitting ? 'Creating...' : 'Create Drive'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
