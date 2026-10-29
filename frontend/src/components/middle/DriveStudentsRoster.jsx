import React, { useState, useEffect } from 'react'
import {
  Users,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  GraduationCap,
  BookOpen,
  Award,
  AlertCircle,
  HelpCircle,
  Loader2,
  FileSpreadsheet
} from 'lucide-react'
import { getDriveStudents } from '../../services/api'

export default function DriveStudentsRoster({ driveId, eligibility, onConfigureCriteria }) {
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'eligible' | 'ineligible' | 'included'

  const fetchStudents = async () => {
    if (!driveId) return
    try {
      setIsLoading(true)
      const data = await getDriveStudents(driveId)
      setStudents(data)
    } catch (err) {
      console.error('Failed to load drive students:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [driveId])

  // Count summaries
  const totalStudents = students.length
  const eligibleCount = students.filter((s) => s.is_eligible).length
  const ineligibleCount = totalStudents - eligibleCount
  const includedCount = students.filter((s) => s.is_included_in_drive).length

  // Filter students
  const filteredStudents = students.filter((s) => {
    // Mode filter
    if (filterMode === 'eligible' && !s.is_eligible) return false
    if (filterMode === 'ineligible' && s.is_eligible) return false
    if (filterMode === 'included' && !s.is_included_in_drive) return false

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = s.name && s.name.toLowerCase().includes(q)
      const matchEmail = s.email && s.email.toLowerCase().includes(q)
      const matchDept = s.department_name && s.department_name.toLowerCase().includes(q)
      const matchBatch = s.batch_name && s.batch_name.toLowerCase().includes(q)
      return matchName || matchEmail || matchDept || matchBatch
    }
    return true
  })

  if (isLoading) {
    return (
      <div className="p-12 bg-white border border-[#dbe5f1] rounded-[16px] flex flex-col items-center justify-center gap-3 text-[#64748b]">
        <Loader2 size={26} className="animate-spin text-[#2563eb]" />
        <span className="text-[14.5px] font-[600]">Evaluating students against eligibility criteria...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {/* 1. Header Metrics Bar */}
      <div className="grid grid-cols-4 gap-[14px]">
        {/* Total Batch Pool */}
        <div className="p-[16px_18px] bg-white border border-[#dbe5f1] rounded-[14px] shadow-2xs">
          <div className="flex items-center justify-between text-[#64748b] text-[13px] font-[700]">
            <span>Total Candidates in Pool</span>
            <Users size={16} className="text-[#2563eb]" />
          </div>
          <div className="text-[26px] font-[850] text-[#172554] mt-1.5">{totalStudents}</div>
          <div className="text-[12px] text-[#64748b] mt-1">From targeted academic batches</div>
        </div>

        {/* Eligible Students */}
        <div
          onClick={() => setFilterMode('eligible')}
          className={`p-[16px_18px] bg-white border rounded-[14px] shadow-2xs cursor-pointer transition ${
            filterMode === 'eligible'
              ? 'border-[#22c55e] ring-2 ring-[#22c55e]/20 bg-[#f0fdf4]'
              : 'border-[#dbe5f1] hover:border-[#bbf7d0]'
          }`}
        >
          <div className="flex items-center justify-between text-[#15803d] text-[13px] font-[750]">
            <span>Eligible Candidates</span>
            <CheckCircle2 size={16} className="text-[#22c55e]" />
          </div>
          <div className="text-[26px] font-[850] text-[#15803d] mt-1.5">{eligibleCount}</div>
          <div className="text-[12px] text-[#16a34a] font-medium mt-1">
            {totalStudents > 0 ? Math.round((eligibleCount / totalStudents) * 100) : 0}% clearance rate
          </div>
        </div>

        {/* Ineligible Students */}
        <div
          onClick={() => setFilterMode('ineligible')}
          className={`p-[16px_18px] bg-white border rounded-[14px] shadow-2xs cursor-pointer transition ${
            filterMode === 'ineligible'
              ? 'border-[#ef4444] ring-2 ring-[#ef4444]/20 bg-[#fef2f2]'
              : 'border-[#dbe5f1] hover:border-[#fecaca]'
          }`}
        >
          <div className="flex items-center justify-between text-[#b91c1c] text-[13px] font-[750]">
            <span>Not Eligible</span>
            <XCircle size={16} className="text-[#ef4444]" />
          </div>
          <div className="text-[26px] font-[850] text-[#b91c1c] mt-1.5">{ineligibleCount}</div>
          <div className="text-[12px] text-[#dc2626] font-medium mt-1">Criteria threshold not met</div>
        </div>

        {/* Included in Drive */}
        <div
          onClick={() => setFilterMode('included')}
          className={`p-[16px_18px] bg-white border rounded-[14px] shadow-2xs cursor-pointer transition ${
            filterMode === 'included'
              ? 'border-[#7c3aed] ring-2 ring-[#7c3aed]/20 bg-[#faf5ff]'
              : 'border-[#dbe5f1] hover:border-[#ddd6fe]'
          }`}
        >
          <div className="flex items-center justify-between text-[#6d28d9] text-[13px] font-[750]">
            <span>Enrolled / Registered</span>
            <Award size={16} className="text-[#7c3aed]" />
          </div>
          <div className="text-[26px] font-[850] text-[#6d28d9] mt-1.5">{includedCount}</div>
          <div className="text-[12px] text-[#7c3aed] font-medium mt-1">Currently participating in drive</div>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="p-[16px_20px] bg-white border border-[#dbe5f1] rounded-[16px] shadow-2xs flex items-center justify-between gap-4">
        {/* Search Box */}
        <div className="relative flex-1 max-w-md">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name, email, department..."
            className="w-full h-[42px] pl-10 pr-4 bg-[#f8fafc] border border-[#cbd5e1] focus:border-[#2563eb] rounded-[10px] text-[14.5px] text-[#1e293b] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#f1f5f9] p-1 rounded-[11px]">
          {[
            { id: 'all', label: `All (${totalStudents})` },
            { id: 'eligible', label: `Eligible (${eligibleCount})` },
            { id: 'ineligible', label: `Ineligible (${ineligibleCount})` },
            { id: 'included', label: `Included (${includedCount})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`px-3.5 py-1.5 text-[13.5px] font-[750] rounded-[8px] transition cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-white text-[#2563eb] shadow-xs'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Students Table */}
      <div className="bg-white border border-[#dbe5f1] rounded-[16px] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[13px] font-[800] text-[#475569] uppercase tracking-wider">
                <th className="py-3.5 px-5">Candidate</th>
                <th className="py-3.5 px-4">Department & Batch</th>
                <th className="py-3.5 px-4 text-center">CGPA</th>
                <th className="py-3.5 px-4 text-center">10th / 12th %</th>
                <th className="py-3.5 px-4 text-center">Arrears (Curr / Hist)</th>
                <th className="py-3.5 px-4 text-center">Eligibility Status</th>
                <th className="py-3.5 px-4 text-right">Roster Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#64748b] text-[14.5px]">
                    No students match the current filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr
                    key={s.user_id}
                    className="hover:bg-[#f8fafc]/80 transition group"
                  >
                    {/* Candidate Identity */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-[800] text-[13.5px] ${
                            s.is_eligible
                              ? 'bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]'
                              : 'bg-[#f1f5f9] text-[#64748b] border border-[#cbd5e1]'
                          }`}
                        >
                          {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div className="text-[14.5px] font-[750] text-[#1e293b] leading-snug">
                            {s.name}
                          </div>
                          <div className="text-[12.5px] text-[#64748b] leading-tight">
                            {s.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Department & Batch */}
                    <td className="py-4 px-4">
                      <div className="text-[13.5px] font-[650] text-[#334155]">
                        {s.department_name || 'Department'}
                      </div>
                      <div className="text-[12px] font-medium text-[#64748b] flex items-center gap-1 mt-0.5">
                        <GraduationCap size={13} className="text-[#2563eb]" />
                        <span>Batch {s.batch_name}</span>
                      </div>
                    </td>

                    {/* CGPA */}
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-block py-1 px-2.5 rounded-[7px] text-[13.5px] font-[800] ${
                          s.cgpa !== null && s.cgpa !== undefined && (!eligibility?.min_cgpa || s.cgpa >= eligibility.min_cgpa)
                            ? 'bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0]'
                            : 'bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]'
                        }`}
                      >
                        {s.cgpa !== null && s.cgpa !== undefined ? s.cgpa.toFixed(2) : 'N/A'}
                      </span>
                    </td>

                    {/* 10th / 12th Marks */}
                    <td className="py-4 px-4 text-center">
                      <div className="text-[13px] font-[700] text-[#334155]">
                        {s.tenth_mark ? `${s.tenth_mark}%` : '—'} / {s.twelfth_mark ? `${s.twelfth_mark}%` : '—'}
                      </div>
                    </td>

                    {/* Arrears */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-[13px]">
                        <span
                          className={`font-[750] px-2 py-0.5 rounded-[6px] ${
                            s.current_arrear_count === 0
                              ? 'text-[#16a34a] bg-[#f0fdf4]'
                              : 'text-[#dc2626] bg-[#fef2f2] font-[800]'
                          }`}
                        >
                          {s.current_arrear_count} curr
                        </span>
                        <span className="text-[#94a3b8]">/</span>
                        <span className="text-[#64748b] font-[600]">
                          {s.history_arrear_count} hist
                        </span>
                      </div>
                    </td>

                    {/* Eligibility Status */}
                    <td className="py-4 px-4 text-center">
                      {s.is_eligible ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] font-[800] bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
                          <CheckCircle2 size={14} />
                          Eligible
                        </span>
                      ) : (
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] font-[800] bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]">
                            <XCircle size={14} />
                            Not Eligible
                          </span>
                          {s.ineligible_reasons && s.ineligible_reasons.length > 0 && (
                            <span
                              className="text-[11px] font-medium text-[#b91c1c] max-w-[170px] truncate"
                              title={s.ineligible_reasons.join(', ')}
                            >
                              {s.ineligible_reasons[0]}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Drive Roster Status */}
                    <td className="py-4 px-4 text-right">
                      {s.is_included_in_drive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[7px] text-[12px] font-[750] text-[#7c3aed] bg-[#f5f3ff] border border-[#ddd6fe]">
                          Enrolled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[7px] text-[12px] font-[600] text-[#94a3b8] bg-[#f8fafc] border border-[#e2e8f0]">
                          Not enrolled
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
