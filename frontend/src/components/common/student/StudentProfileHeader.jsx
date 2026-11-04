import React from 'react'
import { ChevronLeft } from 'lucide-react'

const getInitials = (name) => {
  if (!name) return 'ST'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const formatCGPA = (cgpa) => {
  if (cgpa == null || cgpa === '') return '8.50'
  const num = Number(cgpa)
  return isNaN(num) ? '8.50' : num.toFixed(2)
}

/**
 * Reusable Student Profile Header with avatar gradient, meta info, and status badges.
 * Supports optional `onBack` handler for back navigation.
 */
export default function StudentProfileHeader({
  student,
  onBack = null,
  backLabel = 'Back to Students'
}) {
  if (!student) return null

  return (
    <div className="flex flex-col">
      {/* Optional Back Navigation */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#2563eb] hover:text-[#1d4ed8] mb-3 px-2 py-1 -ml-2 rounded-[7px] hover:bg-[#eff6ff] transition-all cursor-pointer w-fit"
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
          <span>{backLabel}</span>
        </button>
      )}

      {/* Avatar + Info Row */}
      <div className="flex items-center gap-3.5">
        <div className="w-[50px] h-[50px] rounded-[14px] bg-gradient-to-tr from-[#2563eb] via-[#3b82f6] to-[#6366f1] flex items-center justify-center text-white text-[17px] font-extrabold shadow-sm tracking-wide shrink-0">
          {getInitials(student.name)}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-extrabold text-[#0f172a] tracking-tight leading-tight truncate m-0">
            {student.name}
          </h2>
          <p className="text-[12.5px] font-semibold text-[#64748b] mt-0.5 mb-0 truncate leading-snug">
            {student.roll_no ? `${student.roll_no} · ` : ''}
            {student.department_code || student.department_name || 'ENG'} · CGPA {formatCGPA(student.cgpa)}
          </p>
        </div>
      </div>

      {/* Badges Row */}
      <div className="flex items-center gap-2 mt-3">
        {student.is_placed ? (
          <span className="px-3 py-1 rounded-full text-[12px] font-bold font-sans tracking-tight bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] inline-flex items-center justify-center">
            Placed
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full text-[12px] font-bold font-sans tracking-tight bg-[#fef9c3] text-[#854d0e] border border-[#fef08a] inline-flex items-center justify-center">
            Not Placed
          </span>
        )}

        {student.category_badge && (
          <span
            className={`px-3 py-1 rounded-full text-[12px] font-bold font-sans tracking-tight border inline-flex items-center justify-center ${
              student.category_badge === 'NIP'
                ? 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]'
                : 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]'
            }`}
          >
            {student.category_badge}
          </span>
        )}
      </div>
    </div>
  )
}
