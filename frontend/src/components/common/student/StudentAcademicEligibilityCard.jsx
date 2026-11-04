import React from 'react'

/**
 * Reusable Academic Eligibility Card.
 * Displays Batch, CGPA, 10th, 12th, Arrears, History of Arrears in clean table format.
 */
export default function StudentAcademicEligibilityCard({ student = {} }) {
  if (!student) return null

  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-[14px] font-bold text-[#172554] tracking-tight m-0">
        Academic Eligibility
      </h3>

      <div className="bg-white border border-[#dbe5f1] rounded-[16px] px-5 py-1.5 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col">
        {/* Row 1: Batch */}
        <div className="flex items-center justify-between py-3 border-b border-[#f1f5f9]">
          <span className="text-[13.5px] font-medium text-[#475569]">Batch</span>
          <span className="text-[14px] font-bold text-[#172554]">
            {student.batch_name || '2022-2026'}
          </span>
        </div>

        {/* Row 2: CGPA */}
        <div className="flex items-center justify-between py-3 border-b border-[#f1f5f9]">
          <span className="text-[13.5px] font-medium text-[#475569]">CGPA</span>
          <span className="text-[14px] font-bold text-[#172554]">
            {student.cgpa != null ? Number(student.cgpa).toFixed(2) : '-'}
          </span>
        </div>

        {/* Row 3: 10th */}
        <div className="flex items-center justify-between py-3 border-b border-[#f1f5f9]">
          <span className="text-[13.5px] font-medium text-[#475569]">10th</span>
          <span className="text-[14px] font-bold text-[#172554]">
            {student.tenth_mark != null ? `${Number(student.tenth_mark).toFixed(1)}%` : '-'}
          </span>
        </div>

        {/* Row 4: 12th */}
        <div className="flex items-center justify-between py-3 border-b border-[#f1f5f9]">
          <span className="text-[13.5px] font-medium text-[#475569]">12th</span>
          <span className="text-[14px] font-bold text-[#172554]">
            {student.twelfth_mark != null ? `${Number(student.twelfth_mark).toFixed(1)}%` : '-'}
          </span>
        </div>

        {/* Row 5: Arrears */}
        <div className="flex items-center justify-between py-3 border-b border-[#f1f5f9]">
          <span className="text-[13.5px] font-medium text-[#475569]">Arrears</span>
          <span className="text-[14px] font-bold text-[#172554]">
            {student.current_arrears ?? 0}
          </span>
        </div>

        {/* Row 6: History of Arrears */}
        <div className="flex items-center justify-between py-3">
          <span className="text-[13.5px] font-medium text-[#475569]">History of Arrears</span>
          <span className="text-[14px] font-bold text-[#172554]">
            {student.history_of_arrears ?? 0}
          </span>
        </div>
      </div>
    </div>
  )
}

