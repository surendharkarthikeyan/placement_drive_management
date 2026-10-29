import React, { useState, useEffect } from 'react'
import {
  Users,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { getDriveStudents } from '../../services/api'

export default function DriveStudentsRoster({ driveId, eligibility, onConfigureCriteria }) {
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const fetchStudents = async () => {
    if (!driveId) return
    try {
      setIsLoading(true)
      const data = await getDriveStudents(driveId)
      setStudents(data || [])
    } catch (err) {
      console.error('Failed to load drive students:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [driveId])

  // Extract short department code (e.g. "Computer Science and Engineering" -> "CSE")
  const getDeptShortCode = (deptName) => {
    if (!deptName) return 'ENGG'
    const lower = deptName.toLowerCase()
    if (lower.includes('computer science')) return 'CSE'
    if (lower.includes('information tech')) return 'IT'
    if (lower.includes('electronics and comm')) return 'ECE'
    if (lower.includes('electrical')) return 'EEE'
    if (lower.includes('mechanical')) return 'MECH'
    if (lower.includes('civil')) return 'CIVIL'
    // Fallback: take initials
    return deptName
      .split(' ')
      .filter((w) => w.length > 2)
      .map((w) => w[0].toUpperCase())
      .join('')
  }

  // Generate roll / reg number format (e.g., 22CSE1001)
  const getRegNumber = (student) => {
    const yearPrefix = student.batch_name ? student.batch_name.substring(2, 4) : '22'
    const dept = getDeptShortCode(student.department_name)
    const padId = String(student.user_id + 1000).padStart(4, '0')
    return `${yearPrefix}${dept}${padId}`
  }

  // Get initials (e.g. "Aarav Krishnan" -> "AK")
  const getInitials = (name) => {
    if (!name) return 'ST'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Included students (or all eligible candidates if none explicitly enrolled yet)
  const includedStudents = students.filter((s) => s.is_included_in_drive)
  const displayStudents = includedStudents.length > 0 ? includedStudents : students

  // Aggregate department counts
  const cseCount = displayStudents.filter((s) => getDeptShortCode(s.department_name) === 'CSE').length
  const itCount = displayStudents.filter((s) => getDeptShortCode(s.department_name) === 'IT').length
  const eceCount = displayStudents.filter((s) => getDeptShortCode(s.department_name) === 'ECE').length

  // Select all toggle
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(displayStudents.map((s) => s.user_id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const toggleStudent = (userId) => {
    const next = new Set(selectedIds)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    setSelectedIds(next)
  }

  // Generate dynamic eligibility condition tags based on drive.eligibility
  const renderEligibilityFilterTags = () => {
    const tags = []

    // Academic Year / Final Year tag
    tags.push('Final Year')

    // Eligible Departments
    tags.push('CSE + IT + ECE')

    // Min CGPA
    if (eligibility?.min_cgpa !== null && eligibility?.min_cgpa !== undefined) {
      tags.push(`CGPA ≥ ${eligibility.min_cgpa}`)
    } else {
      tags.push('CGPA ≥ 7.0')
    }

    // Arrears
    if (eligibility?.max_current_arrears === 0) {
      tags.push('No Arrears')
    } else if (eligibility?.max_current_arrears > 0) {
      tags.push(`Max ${eligibility.max_current_arrears} Arrear(s)`)
    } else {
      tags.push('No Arrears')
    }

    // Offer cap
    if (eligibility?.max_existing_offer_lpa !== null && eligibility?.max_existing_offer_lpa !== undefined) {
      tags.push(`Not holding > ${eligibility.max_existing_offer_lpa} LPA offer`)
    } else {
      tags.push('Not holding > 15 LPA offer')
    }

    return tags
  }

  if (isLoading) {
    return (
      <div className="p-12 bg-white border border-[#dbe5f1] rounded-[16px] flex flex-col items-center justify-center gap-3 text-[#64748b]">
        <Loader2 size={26} className="animate-spin text-[#2563eb]" />
        <span className="text-[14.5px] font-[600]">Loading drive student list...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {/* 1. Top Bar: "Students Included in this Drive" + "+ Filter and Add Students" button */}
      <div className="p-[14px_18px] bg-white border border-[#dbe5f1] rounded-[12px] shadow-2xs flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-[850] text-[#172554] m-0 leading-tight">
            Students Included in this Drive
          </h2>
          <p className="text-[13px] text-[#64748b] mt-[3px] mb-0 font-medium">
            {displayStudents.length} students currently included
          </p>
        </div>

        <button
          type="button"
          onClick={onConfigureCriteria}
          className="py-[9px] px-[16px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-[9px] text-[13.5px] font-[750] shadow-sm hover:shadow transition cursor-pointer flex items-center gap-1.5 active:scale-98"
        >
          <Plus size={16} strokeWidth={2.8} />
          <span>Filter and Add Students</span>
        </button>
      </div>

      {/* 2. Filter / Criteria Tags Row */}
      <div className="flex flex-wrap items-center gap-[7px]">
        {renderEligibilityFilterTags().map((tag, idx) => (
          <span
            key={idx}
            className="py-[5px] px-[12px] rounded-full text-[12px] font-[700] text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe] shadow-2xs"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* 3. 4-Column Roster Summary KPI Boxes */}
      <div className="grid grid-cols-4 gap-[10px]">
        {/* Total Included */}
        <div className="p-[14px] text-center bg-[#fbfdff] border border-[#dbe5f1] rounded-[10px] shadow-2xs">
          <strong className="block text-[24px] font-[850] text-[#172554] leading-tight">
            {displayStudents.length}
          </strong>
          <span className="text-[12px] text-[#64748b] font-medium mt-[4px] block">
            Total included
          </span>
        </div>

        {/* CSE Students */}
        <div className="p-[14px] text-center bg-[#fbfdff] border border-[#dbe5f1] rounded-[10px] shadow-2xs">
          <strong className="block text-[24px] font-[850] text-[#172554] leading-tight">
            {cseCount}
          </strong>
          <span className="text-[12px] text-[#64748b] font-medium mt-[4px] block">
            CSE students
          </span>
        </div>

        {/* IT Students */}
        <div className="p-[14px] text-center bg-[#fbfdff] border border-[#dbe5f1] rounded-[10px] shadow-2xs">
          <strong className="block text-[24px] font-[850] text-[#172554] leading-tight">
            {itCount}
          </strong>
          <span className="text-[12px] text-[#64748b] font-medium mt-[4px] block">
            IT students
          </span>
        </div>

        {/* ECE Students */}
        <div className="p-[14px] text-center bg-[#fbfdff] border border-[#dbe5f1] rounded-[10px] shadow-2xs">
          <strong className="block text-[24px] font-[850] text-[#172554] leading-tight">
            {eceCount}
          </strong>
          <span className="text-[12px] text-[#64748b] font-medium mt-[4px] block">
            ECE students
          </span>
        </div>
      </div>

      {/* 4. Student Table Card matching template design */}
      <div className="bg-white border border-[#dbe5f1] rounded-[14px] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[12px] font-[800] text-[#64748b] uppercase tracking-[0.35px]">
                <th className="py-3 px-4 w-[48px]">
                  <input
                    type="checkbox"
                    checked={displayStudents.length > 0 && selectedIds.size === displayStudents.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded-[4px] border-[#cbd5e1] text-[#2563eb] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">CGPA</th>
                <th className="py-3 px-4">Current Offer</th>
                <th className="py-3 px-4 text-center">Drive Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf2f7]">
              {displayStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#64748b] text-[14px]">
                    No students currently added to this drive.
                  </td>
                </tr>
              ) : (
                displayStudents.map((st) => {
                  const isSelected = selectedIds.has(st.user_id)
                  const deptShort = getDeptShortCode(st.department_name)
                  const regNo = getRegNumber(st)
                  const avatarInitials = getInitials(st.name)

                  return (
                    <tr
                      key={st.user_id}
                      className={`hover:bg-[#fbfdff] transition ${
                        isSelected ? 'bg-[#eff6ff]/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStudent(st.user_id)}
                          className="w-4 h-4 rounded-[4px] border-[#cbd5e1] text-[#2563eb] focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Student Identity: Mini-avatar, Name, Reg Number */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-[34px] h-[34px] rounded-[9px] bg-[#dbeafe] text-[#2563eb] font-[850] text-[12px] flex items-center justify-center shrink-0">
                            {avatarInitials}
                          </div>
                          <div>
                            <div className="text-[14px] font-[800] text-[#1e293b] leading-snug">
                              {st.name}
                            </div>
                            <div className="text-[12px] text-[#94a3b8] font-medium leading-tight mt-0.5">
                              {regNo}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4 text-[13.5px] font-[600] text-[#475569]">
                        {deptShort}
                      </td>

                      {/* CGPA */}
                      <td className="py-3.5 px-4 text-[13.5px] font-[700] text-[#334155]">
                        {st.cgpa !== null && st.cgpa !== undefined ? st.cgpa.toFixed(2) : '—'}
                      </td>

                      {/* Current Offer */}
                      <td className="py-3.5 px-4 text-[13.5px] font-[600] text-[#475569]">
                        {st.max_existing_offer ? `${st.max_existing_offer} LPA` : 'No Offer'}
                      </td>

                      {/* Drive Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block py-[4px] px-[12px] rounded-full text-[12px] font-[750] text-[#2563eb] bg-[#eff6ff] border border-[#bfdbfe]">
                          Included
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
