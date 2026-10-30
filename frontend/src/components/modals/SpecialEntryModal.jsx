import React, { useState, useEffect } from 'react'
import { X, Search, UserCheck, Loader2 } from 'lucide-react'
import { getDriveStudents } from '../../services/api'

export default function SpecialEntryModal({
  isOpen = false,
  onClose = () => {},
  driveId = null,
  stageName = '',
  existingUserIds = new Set(), // set of user_id already in this stage
  onConfirm = () => {},
  isSubmitting = false,
}) {
  const [candidates, setCandidates] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())

  useEffect(() => {
    if (isOpen && driveId) {
      loadCandidates()
      setSearchQuery('')
      setSelectedIds(new Set())
    }
  }, [isOpen, driveId])

  const loadCandidates = async () => {
    try {
      setIsLoading(true)
      const data = await getDriveStudents(driveId)
      // Show eligible pool excluding already excluded candidates
      const eligiblePool = (data || []).filter((s) => s.drive_status !== 'excluded')
      setCandidates(eligiblePool)
    } catch (err) {
      console.error('Failed to load drive candidates for special entry:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const getInitials = (name) => {
    if (!name) return 'ST'
    const p = name.trim().split(' ')
    if (p.length === 1) return p[0].substring(0, 2).toUpperCase()
    return (p[0][0] + p[p.length - 1][0]).toUpperCase()
  }

  // Short department code helper
  const getDeptShort = (dept) => {
    if (!dept) return 'ENGG'
    const lower = dept.toLowerCase()
    if (lower.includes('computer science')) return 'CSE'
    if (lower.includes('information tech')) return 'IT'
    if (lower.includes('electronics and comm')) return 'ECE'
    if (lower.includes('electrical')) return 'EEE'
    if (lower.includes('mech')) return 'MECH'
    return dept.substring(0, 3).toUpperCase()
  }

  // Filter candidates: search query AND exclude candidates who are already in this stage!
  const availableCandidates = candidates.filter((c) => !existingUserIds.has(c.user_id))

  const filtered = availableCandidates.filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    const nameMatch = c.name && c.name.toLowerCase().includes(q)
    const emailMatch = c.email && c.email.toLowerCase().includes(q)
    const rollMatch = c.roll_no && String(c.roll_no).toLowerCase().includes(q)
    const deptMatch = c.department_name && c.department_name.toLowerCase().includes(q)
    return nameMatch || emailMatch || rollMatch || deptMatch
  })

  const toggleSelect = (userId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filtered.map((c) => c.user_id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleConfirm = () => {
    if (selectedIds.size === 0) return
    onConfirm(Array.from(selectedIds))
  }

  const isAllChecked = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.user_id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/45 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-[820px] bg-white rounded-[20px] shadow-[0_24px_64px_-12px_rgba(15,23,42,0.30)] border border-[#dbe5f1] flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-[20px_26px_16px] flex items-start justify-between border-b border-[#f1f5f9]">
          <div>
            <h2 className="text-[20px] font-[850] text-[#172554] leading-tight">
              Special Entry — {stageName}
            </h2>
            <p className="text-[13px] text-[#64748b] mt-1 m-0">
              Select students to enter this recruitment stage directly as Special Entry.
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

        {/* Search Bar */}
        <div className="p-[16px_26px_12px] border-b border-[#f1f5f9] bg-[#fafbfc]">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, roll number, or email..."
              className="w-full pl-9 pr-3.5 py-[8.5px] bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[13.5px] text-[#1e293b] placeholder-[#94a3b8] outline-none transition"
            />
          </div>
        </div>

        {/* Student List Table */}
        <div className="flex-1 overflow-y-auto p-[14px_26px] scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10 border-b border-[#e2e8f0]">
              <tr className="text-[12px] font-[800] text-[#64748b] uppercase tracking-[0.35px]">
                <th className="py-2.5 px-3 w-[40px]">
                  <input
                    type="checkbox"
                    checked={isAllChecked}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded-[4px] border-[#cbd5e1] text-[#2563eb] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3">STUDENT</th>
                <th className="py-2.5 px-3">ROLL NO</th>
                <th className="py-2.5 px-3">DEPARTMENT</th>
                <th className="py-2.5 px-3">CGPA</th>
                <th className="py-2.5 px-3">10TH / 12TH</th>
                <th className="py-2.5 px-3">ARREARS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f7]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#64748b]">
                    <Loader2 size={24} className="animate-spin mx-auto text-[#2563eb]" />
                    <span className="block mt-2 text-[13px]">Loading candidates...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#64748b] text-[13.5px]">
                    No students available for special entry.
                  </td>
                </tr>
              ) : (
                filtered.map((st) => {
                  const isChecked = selectedIds.has(st.user_id)
                  const avatarInitials = getInitials(st.name)
                  const deptShort = getDeptShort(st.department_name)
                  return (
                    <tr
                      key={st.user_id}
                      onClick={() => toggleSelect(st.user_id)}
                      className={`hover:bg-[#fbfdff] transition cursor-pointer select-none ${
                        isChecked ? 'bg-[#eff6ff]/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(st.user_id)}
                          className="w-4 h-4 rounded-[4px] border-[#cbd5e1] text-[#2563eb] focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-[30px] h-[30px] rounded-[7px] bg-[#dbeafe] text-[#2563eb] font-[850] text-[11px] flex items-center justify-center shrink-0">
                            {avatarInitials}
                          </div>
                          <div>
                            <div className="text-[13.5px] font-[800] text-[#1e293b] leading-tight">
                              {st.name}
                            </div>
                            <div className="text-[11.5px] text-[#94a3b8] font-medium leading-tight mt-0.5">
                              {st.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[13px] font-[750] text-[#1e293b]">
                        {st.roll_no || '—'}
                      </td>
                      <td className="py-3 px-3 text-[13px] font-[700] text-[#475569]">
                        {deptShort}
                      </td>
                      <td className="py-3 px-3 text-[13px] font-[750] text-[#1e293b]">
                        {st.cgpa !== null && st.cgpa !== undefined ? Number(st.cgpa).toFixed(2) : '—'}
                      </td>
                      <td className="py-3 px-3 text-[12.5px] font-[600] text-[#475569]">
                        {st.tenth_mark ?? '—'}% / {st.twelfth_mark ?? '—'}%
                      </td>
                      <td className="py-3 px-3 text-[12.5px] font-[600] text-[#475569]">
                        {st.current_arrear_count ?? 0} / {st.history_arrear_count ?? 0}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-[14px_26px] border-t border-[#f1f5f9] flex items-center justify-between bg-[#fafbfc]">
          <span className="text-[13px] font-[700] text-[#64748b]">
            <strong className="text-[#1e293b]">{selectedIds.size}</strong> candidate(s) selected
          </span>
          <div className="flex items-center gap-3">
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
              onClick={handleConfirm}
              disabled={isSubmitting || selectedIds.size === 0}
              className="px-6 py-2 text-[13.5px] font-[750] text-white bg-[#2563eb] hover:bg-[#1d4ed8] rounded-[9px] shadow-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              <span>Add Special Entry</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

