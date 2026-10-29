import React, { useState, useEffect } from 'react'
import { X, Loader2, SlidersHorizontal, Check } from 'lucide-react'
import { updateDriveEligibility } from '../../services/api'

/**
 * EditEligibilityModal
 * Modal to configure placement_drive_eligibility criteria:
 * - min_cgpa
 * - min_tenth_mark
 * - min_twelfth_mark
 * - max_current_arrears
 * - max_history_arrears
 * - max_existing_offer_lpa
 * (academic_year removed as batch_id is stored directly on placement_drive)
 * No prefilled default values — clean placeholders only.
 * Increased font-size throughout.
 */
export default function EditEligibilityModal({
  isOpen = false,
  onClose = () => {},
  driveId = null,
  currentEligibility = null,
  onEligibilitySaved = () => {}
}) {
  const [formData, setFormData] = useState({
    min_cgpa: '',
    min_tenth_mark: '',
    min_twelfth_mark: '',
    max_current_arrears: '',
    max_history_arrears: '',
    max_existing_offer_lpa: ''
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (currentEligibility) {
      setFormData({
        min_cgpa: currentEligibility.min_cgpa !== null && currentEligibility.min_cgpa !== undefined ? String(currentEligibility.min_cgpa) : '',
        min_tenth_mark: currentEligibility.min_tenth_mark !== null && currentEligibility.min_tenth_mark !== undefined ? String(currentEligibility.min_tenth_mark) : '',
        min_twelfth_mark: currentEligibility.min_twelfth_mark !== null && currentEligibility.min_twelfth_mark !== undefined ? String(currentEligibility.min_twelfth_mark) : '',
        max_current_arrears: currentEligibility.max_current_arrears !== null && currentEligibility.max_current_arrears !== undefined ? String(currentEligibility.max_current_arrears) : '',
        max_history_arrears: currentEligibility.max_history_arrears !== null && currentEligibility.max_history_arrears !== undefined ? String(currentEligibility.max_history_arrears) : '',
        max_existing_offer_lpa: currentEligibility.max_existing_offer_lpa !== null && currentEligibility.max_existing_offer_lpa !== undefined ? String(currentEligibility.max_existing_offer_lpa) : ''
      })
    } else {
      setFormData({
        min_cgpa: '',
        min_tenth_mark: '',
        min_twelfth_mark: '',
        max_current_arrears: '',
        max_history_arrears: '',
        max_existing_offer_lpa: ''
      })
    }
  }, [currentEligibility, isOpen])

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!driveId) return

    try {
      setIsSaving(true)
      const payload = {
        min_cgpa: formData.min_cgpa !== '' ? parseFloat(formData.min_cgpa) : null,
        min_tenth_mark: formData.min_tenth_mark !== '' ? parseFloat(formData.min_tenth_mark) : null,
        min_twelfth_mark: formData.min_twelfth_mark !== '' ? parseFloat(formData.min_twelfth_mark) : null,
        max_current_arrears: formData.max_current_arrears !== '' ? parseInt(formData.max_current_arrears, 10) : null,
        max_history_arrears: formData.max_history_arrears !== '' ? parseInt(formData.max_history_arrears, 10) : null,
        max_existing_offer_lpa: formData.max_existing_offer_lpa !== '' ? parseFloat(formData.max_existing_offer_lpa) : null
      }

      const saved = await updateDriveEligibility(driveId, payload)
      onEligibilitySaved(saved)
      onClose()
    } catch (err) {
      console.error('Failed to update eligibility:', err)
      alert('Failed to save eligibility conditions. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle "No Criteria" (open to all students)
  const handleNoCriteria = async () => {
    if (!driveId) return
    try {
      setIsSaving(true)
      const payload = {
        min_cgpa: null,
        min_tenth_mark: null,
        min_twelfth_mark: null,
        max_current_arrears: null,
        max_history_arrears: null,
        max_existing_offer_lpa: null
      }

      const saved = await updateDriveEligibility(driveId, payload)
      onEligibilitySaved(saved)
      onClose()
    } catch (err) {
      console.error('Failed to set no criteria:', err)
      alert('Failed to set criteria. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-[20px] shadow-2xl border border-[#dbe5f1] max-w-2xl w-full p-7 text-[#1e293b]">
        {/* Header */}
        <div className="flex items-start justify-between pb-5 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-3.5">
            <div className="w-[46px] h-[46px] rounded-[13px] bg-[#eff6ff] border border-[#bfdbfe] flex items-center justify-center text-[#2563eb]">
              <SlidersHorizontal size={22} />
            </div>
            <div>
              <h2 className="text-[22px] font-[850] text-[#172554] m-0 tracking-tight">
                Set Eligibility Criteria
              </h2>
              <p className="text-[14px] text-[#64748b] mt-1">
                Define the requirements and academic thresholds for this drive.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] flex items-center justify-center transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-5">
            {/* Min CGPA */}
            <div>
              <label className="text-[14.5px] font-[750] text-[#334155] block mb-2">
                Minimum CGPA
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                name="min_cgpa"
                value={formData.min_cgpa}
                onChange={handleChange}
                placeholder="e.g. 7.5"
                className="w-full h-[48px] px-4 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] font-[600] text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition"
              />
            </div>

            {/* Minimum 10th % */}
            <div>
              <label className="text-[14.5px] font-[750] text-[#334155] block mb-2">
                Minimum 10th Mark (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                name="min_tenth_mark"
                value={formData.min_tenth_mark}
                onChange={handleChange}
                placeholder="e.g. 70"
                className="w-full h-[48px] px-4 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] font-[600] text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition"
              />
            </div>

            {/* Minimum 12th / Diploma % */}
            <div>
              <label className="text-[14.5px] font-[750] text-[#334155] block mb-2">
                Minimum 12th / Diploma Mark (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                name="min_twelfth_mark"
                value={formData.min_twelfth_mark}
                onChange={handleChange}
                placeholder="e.g. 70"
                className="w-full h-[48px] px-4 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] font-[600] text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition"
              />
            </div>

            {/* Max Current Arrears */}
            <div>
              <label className="text-[14.5px] font-[750] text-[#334155] block mb-2">
                Max Current Standing Arrears
              </label>
              <select
                name="max_current_arrears"
                value={formData.max_current_arrears}
                onChange={handleChange}
                className="w-full h-[48px] px-4 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] font-[600] text-[#1e293b] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition cursor-pointer"
              >
                <option value="">No restriction (e.g. 0)</option>
                <option value="0">0 (No standing arrears)</option>
                <option value="1">1 arrear permitted</option>
                <option value="2">2 arrears permitted</option>
                <option value="3">3+ arrears permitted</option>
              </select>
            </div>

            {/* Max History of Arrears */}
            <div>
              <label className="text-[14.5px] font-[750] text-[#334155] block mb-2">
                Max History Arrears
              </label>
              <select
                name="max_history_arrears"
                value={formData.max_history_arrears}
                onChange={handleChange}
                className="w-full h-[48px] px-4 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] font-[600] text-[#1e293b] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition cursor-pointer"
              >
                <option value="">No restriction (e.g. 0)</option>
                <option value="0">0 (Clean history)</option>
                <option value="1">Up to 1 past arrear</option>
                <option value="2">Up to 2 past arrears</option>
              </select>
            </div>

            {/* Max Existing Offer Package */}
            <div>
              <label className="text-[14.5px] font-[750] text-[#334155] block mb-2">
                Maximum Existing Offer Cap (LPA)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                name="max_existing_offer_lpa"
                value={formData.max_existing_offer_lpa}
                onChange={handleChange}
                placeholder="e.g. 8.5"
                className="w-full h-[48px] px-4 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[11px] text-[15.5px] font-[600] text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-5 border-t border-[#f1f5f9] mt-3">
            <button
              type="button"
              onClick={handleNoCriteria}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-[11px] text-[14.5px] font-[750] text-[#475569] bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#cbd5e1] transition cursor-pointer flex items-center gap-1.5 active:scale-98"
            >
              <span>No Criteria (Open to All)</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-[11px] text-[15px] font-[700] text-[#64748b] hover:bg-[#f1f5f9] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-[11px] text-[15px] font-[800] text-white bg-[#2563eb] hover:bg-[#1d4ed8] shadow-sm hover:shadow-md transition cursor-pointer flex items-center gap-2 active:scale-98 disabled:opacity-75"
              >
                {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
                <span>{isSaving ? 'Saving...' : 'Save Criteria'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
