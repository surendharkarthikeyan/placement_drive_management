import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, Calendar, Loader2 } from 'lucide-react'

const INITIAL_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending — Date Not Announced' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_result', label: 'Awaiting Result' },
  { value: 'completed', label: 'Completed' },
]

export default function AddStageModal({
  isOpen = false,
  onClose = () => {},
  onSubmit = () => {},
  isSubmitting = false,
  initialData = null, // for editing
}) {
  const [stageName, setStageName] = useState('')
  const [stageStructure, setStageStructure] = useState('single') // 'single' | 'multiple'
  const [scheduledDate, setScheduledDate] = useState('')
  const [initialStatus, setInitialStatus] = useState('pending')
  const [internalNotes, setInternalNotes] = useState('')
  const [substages, setSubstages] = useState([
    { substage_name: '', scheduled_date: '', status: 'pending' },
  ])
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setStageName(initialData.stage_name || '')
        setScheduledDate(initialData.scheduled_date ? initialData.scheduled_date.substring(0, 10) : '')
        setInitialStatus(initialData.stage_status || 'pending')
        setInternalNotes(initialData.internal_notes || '')
        if (initialData.substages && initialData.substages.length > 0) {
          setStageStructure('multiple')
          setSubstages(
            initialData.substages.map((s) => ({
              substage_name: s.substage_name || '',
              scheduled_date: s.scheduled_date ? s.scheduled_date.substring(0, 10) : '',
              status: s.substage_status || 'pending',
            }))
          )
        } else {
          setStageStructure('single')
          setSubstages([{ substage_name: '', scheduled_date: '', status: 'pending' }])
        }
      } else {
        setStageName('')
        setStageStructure('single')
        setScheduledDate('')
        setInitialStatus('pending')
        setInternalNotes('')
        setSubstages([{ substage_name: '', scheduled_date: '', status: 'pending' }])
      }
      setError('')
    }
  }, [isOpen, initialData])

  if (!isOpen) return null

  const handleAddSubstage = () => {
    setSubstages((prev) => [
      ...prev,
      { substage_name: '', scheduled_date: '', status: 'pending' },
    ])
  }

  const handleRemoveSubstage = (index) => {
    if (substages.length <= 1) return
    setSubstages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubstageChange = (index, field, value) => {
    setSubstages((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!stageName.trim()) {
      setError('Please provide a stage name')
      return
    }

    let payloadSubstages = []
    if (stageStructure === 'multiple') {
      const validSubstages = substages.filter((s) => s.substage_name.trim())
      if (validSubstages.length === 0) {
        setError('Please configure at least one substage name')
        return
      }
      payloadSubstages = validSubstages.map((s) => ({
        substage_name: s.substage_name.trim(),
        scheduled_date: s.scheduled_date || null,
        status: s.status || 'pending',
      }))
    }

    setError('')
    onSubmit({
      stage_name: stageName.trim(),
      scheduled_date: scheduledDate || null,
      initial_status: initialStatus,
      stage_status: initialStatus,
      internal_notes: internalNotes.trim(),
      substages: payloadSubstages,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-[620px] bg-white rounded-[20px] shadow-[0_24px_64px_-12px_rgba(15,23,42,0.30)] border border-[#dbe5f1] flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-[20px_26px_16px] flex items-start justify-between border-b border-[#f1f5f9]">
          <div>
            <h2 className="text-[20px] font-[850] text-[#172554] leading-tight">
              {initialData ? 'Edit Recruitment Stage' : 'Add Recruitment Stage'}
            </h2>
            <p className="text-[13px] text-[#64748b] mt-1 m-0">
              Create a new main stage or a stage containing multiple substages.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#64748b] hover:bg-[#f1f5f9] transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-[22px_26px] space-y-4 scrollbar-thin">
          {error && (
            <div className="p-3 bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] text-[13px] font-[650] rounded-[10px]">
              {error}
            </div>
          )}

          {/* Stage Name */}
          <div>
            <label className="block text-[13px] font-[800] text-[#1e293b] mb-1.5">
              Stage Name <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              placeholder="Example: Managerial Interview"
              className="w-full h-[42px] px-3.5 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[14px] text-[#1e293b] outline-none transition focus:ring-2 focus:ring-[#2563eb]/15"
            />
          </div>

          {/* Stage Structure: Single Stage vs Multiple Substages */}
          <div>
            <label className="block text-[13px] font-[800] text-[#1e293b] mb-2">
              Stage Structure
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStageStructure('single')}
                className={`py-[10px] px-4 rounded-[10px] text-[13.5px] font-[750] border transition cursor-pointer text-center ${
                  stageStructure === 'single'
                    ? 'bg-[#eff6ff] text-[#2563eb] border-[#93c5fd] shadow-2xs'
                    : 'bg-white text-[#64748b] border-[#cbd5e1] hover:bg-[#f8fafc]'
                }`}
              >
                Single Stage
              </button>
              <button
                type="button"
                onClick={() => setStageStructure('multiple')}
                className={`py-[10px] px-4 rounded-[10px] text-[13.5px] font-[750] border transition cursor-pointer text-center ${
                  stageStructure === 'multiple'
                    ? 'bg-[#eff6ff] text-[#2563eb] border-[#93c5fd] shadow-2xs'
                    : 'bg-white text-[#64748b] border-[#cbd5e1] hover:bg-[#f8fafc]'
                }`}
              >
                Multiple Substages
              </button>
            </div>
          </div>

          {/* Scheduled Date & Initial Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[13px] font-[800] text-[#1e293b] mb-1.5">
                Scheduled Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full h-[42px] px-3.5 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[13.5px] text-[#1e293b] outline-none transition focus:ring-2 focus:ring-[#2563eb]/15"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-[800] text-[#1e293b] mb-1.5">
                Status
              </label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value)}
                className="w-full h-[42px] px-3 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[13.5px] font-[600] text-[#1e293b] outline-none transition focus:ring-2 focus:ring-[#2563eb]/15 cursor-pointer"
              >
                {INITIAL_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Multiple Substages section */}
          {stageStructure === 'multiple' && (
            <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-[12px] space-y-3">
              <label className="block text-[13px] font-[850] text-[#172554]">
                Substages
              </label>

              {substages.map((sub, idx) => (
                <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <input
                    type="text"
                    value={sub.substage_name}
                    onChange={(e) => handleSubstageChange(idx, 'substage_name', e.target.value)}
                    placeholder="Substage name"
                    className="flex-1 min-w-[150px] h-[40px] px-3 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[9px] text-[13.5px] text-[#1e293b] outline-none"
                  />
                  <input
                    type="date"
                    value={sub.scheduled_date || ''}
                    onChange={(e) => handleSubstageChange(idx, 'scheduled_date', e.target.value)}
                    className="w-[145px] h-[40px] px-2.5 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[9px] text-[12.5px] font-[600] text-[#1e293b] outline-none cursor-pointer"
                  />
                  <select
                    value={sub.status}
                    onChange={(e) => handleSubstageChange(idx, 'status', e.target.value)}
                    className="w-[135px] h-[40px] px-2.5 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[9px] text-[13px] font-[600] text-[#1e293b] outline-none cursor-pointer"
                  >
                    <option value="pending">Pending</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="awaiting_result">Awaiting Result</option>
                    <option value="completed">Completed</option>
                  </select>
                  {substages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSubstage(idx)}
                      className="w-9 h-9 rounded-[8px] border border-[#fecaca] text-[#ef4444] hover:bg-[#fef2f2] flex items-center justify-center transition cursor-pointer shrink-0"
                      title="Remove substage"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddSubstage}
                className="mt-1 py-1.5 px-3 bg-[#eff6ff] hover:bg-[#dbeafe] text-[#2563eb] border border-[#bfdbfe] rounded-[8px] text-[12.5px] font-[750] transition cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={14} strokeWidth={2.6} />
                <span>Add Another Substage</span>
              </button>
            </div>
          )}

          {/* Internal Notes */}
          <div>
            <label className="block text-[13px] font-[800] text-[#1e293b] mb-1.5">
              Internal Notes
            </label>
            <textarea
              rows={3}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Instructions or company information about this stage"
              className="w-full p-3 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[13.5px] text-[#1e293b] outline-none transition focus:ring-2 focus:ring-[#2563eb]/15 resize-y"
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-[14px_26px] border-t border-[#f1f5f9] flex items-center justify-end gap-3 bg-[#fafbfc]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2 text-[13.5px] font-[700] text-[#475569] bg-white hover:bg-[#f8fafc] border border-[#dbe5f1] rounded-[9px] transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 text-[13.5px] font-[750] text-white bg-[#2563eb] hover:bg-[#1d4ed8] rounded-[9px] shadow-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-70"
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            <span>{initialData ? 'Update Stage' : 'Add Stage'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

