import React from 'react'

/**
 * ReviewProgressWorkspace (Center Panel of Student Placement Review)
 * Template width: flex-1, minmax(570px, 1fr)
 */
export default function ReviewProgressWorkspace() {
  return (
    <section className="flex-1 min-w-[570px] bg-[#f5f8fc] h-full overflow-y-auto p-[18px] flex flex-col">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h1 className="text-[20px] font-[850] text-[#172554] m-0 leading-tight">
            Student Placement Progress
          </h1>
          <p className="text-[13px] text-[#64748b] mt-1 mb-0 font-medium">
            Review outcomes and identify students who should receive the next opportunity.
          </p>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="flex-1 flex items-center justify-center border-2 border-dashed border-[#dbe5f1] bg-white rounded-[14px] p-8 text-center text-[#94a3b8] text-[14px] shadow-2xs mt-3">
        Center Placement Progress Workspace
      </div>
    </section>
  )
}

