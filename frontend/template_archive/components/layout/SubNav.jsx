import React, { useState } from 'react'

export default function SubNav() {
  const [activeTab, setActiveTab] = useState('Placement Drive')

  const navItems = [
    'Placement Intelligence',
    'Placement Drive',
    'Student Placement Review',
    'Events & Communications'
  ]

  return (
    <div className="h-[58px] min-h-[58px] px-5 flex items-center justify-between bg-white border-b border-[#dbe5f1] z-10 select-none">
      {/* Navigation Pills */}
      <nav aria-label="Module Navigation" className="p-[4px] flex items-center gap-[4px] rounded-[10px] bg-[#f1f5f9]">
        {navItems.map((item) => {
          const isActive = activeTab === item
          return (
            <button
              key={item}
              onClick={() => setActiveTab(item)}
              className={`px-[14px] py-[8px] text-[13px] font-[700] rounded-[8px] transition-all duration-150 ${
                isActive
                  ? 'bg-white text-[#2563eb] shadow-[0_2px_7px_rgba(15,23,42,0.09)]'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              {item}
            </button>
          )
        })}
      </nav>

      {/* Context Information */}
      <div className="text-[12px] text-[#64748b] font-medium hidden sm:block">
        Placement Team Workspace · <span className="text-[#94a3b8]">Last saved 10:42 AM</span>
      </div>
    </div>
  )
}
