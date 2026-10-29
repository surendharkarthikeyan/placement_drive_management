import React, { useState } from 'react'
import { Plus, Search } from 'lucide-react'

export default function LeftPanel({
  selectedDriveId = 'amazon',
  onSelectDrive = () => {},
  onOpenCreateModal = () => {}
}) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const drives = [
    {
      id: 'amazon',
      name: 'Amazon',
      role: 'Software Development Engineer',
      status: 'Awaiting Result',
      badgeClass: 'text-[#b45309] bg-[#fef3c7]',
      students: '92 students',
      subMeta: 'Final result pending',
      group: 'Requires Attention',
      statusType: 'active'
    },
    {
      id: 'qualcomm',
      name: 'Qualcomm',
      role: 'Embedded Software Engineer',
      status: 'In Progress',
      badgeClass: 'text-[#1d4ed8] bg-[#dbeafe]',
      students: '64 students',
      subMeta: 'Round 3 active',
      group: 'Requires Attention',
      statusType: 'active'
    },
    {
      id: 'bosch',
      name: 'Bosch',
      role: 'Graduate Engineer Trainee',
      status: 'Date Pending',
      badgeClass: 'text-[#b45309] bg-[#fef3c7]',
      students: '118 students',
      subMeta: 'Next round not announced',
      group: 'Requires Attention',
      statusType: 'active'
    },
    {
      id: 'zoho',
      name: 'Zoho',
      role: 'Member Technical Staff',
      status: 'Scheduled',
      badgeClass: 'text-[#6d28d9] bg-[#ede9fe]',
      students: '156 students',
      subMeta: '28 Sep 2026',
      group: 'Upcoming',
      statusType: 'active'
    },
    {
      id: 'siemens',
      name: 'Siemens',
      role: 'Digital Industries Trainee',
      status: 'Draft',
      badgeClass: 'text-[#475569] bg-[#e2e8f0]',
      students: 'Students not added',
      subMeta: '4 Oct 2026',
      group: 'Upcoming',
      statusType: 'active'
    },
    {
      id: 'paypal',
      name: 'PayPal',
      role: 'Software Engineer',
      status: 'Completed',
      badgeClass: 'text-[#15803d] bg-[#dcfce7]',
      students: '3 selected',
      subMeta: '21 Sep 2026',
      group: 'Recently Completed',
      statusType: 'completed'
    },
    {
      id: 'tcs',
      name: 'TCS Digital',
      role: 'Digital Engineer',
      status: 'Completed',
      badgeClass: 'text-[#15803d] bg-[#dcfce7]',
      students: '26 selected',
      subMeta: '18 Sep 2026',
      group: 'Recently Completed',
      statusType: 'completed'
    }
  ]

  const filteredDrives = drives.filter(d => {
    if (activeFilter === 'active' && d.statusType !== 'active') return false
    if (activeFilter === 'completed' && d.statusType !== 'completed') return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return d.name.toLowerCase().includes(q) || d.role.toLowerCase().includes(q)
    }
    return true
  })

  const groups = ['Requires Attention', 'Upcoming', 'Recently Completed']

  return (
    <aside className="h-full overflow-y-auto p-[16px] bg-[#fbfdff] border-r border-[#dbe5f1] select-none">
      {/* 1. Create New Drive Button */}
      <button
        onClick={onOpenCreateModal}
        className="w-full mb-[14px] py-[9px] px-[13px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-[750] text-[13px] rounded-[9px] border border-[#2563eb] transition cursor-pointer"
      >
        + Create New Drive
      </button>

      {/* 2. Search Box */}
      <div className="relative">
        <span className="absolute left-[11px] top-[10px] text-[#94a3b8] text-[15px] pointer-events-none">
          ⌕
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search company or role"
          className="w-full py-[10px] pr-[10px] pl-[34px] bg-white border border-[#dbe5f1] rounded-[9px] text-[13px] text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:border-[#93c5fd] focus:ring-3 focus:ring-[#dbeafe]"
        />
      </div>

      {/* 3. Filter Tabs (All / Active / Completed) */}
      <div className="my-[12px] p-[4px] grid grid-cols-3 gap-[3px] rounded-[9px] bg-[#eef2f7]">
        {['all', 'active', 'completed'].map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`py-[7px] px-[3px] text-[11px] font-[750] rounded-[7px] capitalize transition cursor-pointer ${
              activeFilter === filter
                ? 'bg-white text-[#2563eb] shadow-[0_2px_6px_rgba(15,23,42,0.07)]'
                : 'text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* 4. Drive List with Groups */}
      <div>
        {groups.map((group) => {
          const groupDrives = filteredDrives.filter((d) => d.group === group)
          if (!groupDrives.length) return null

          return (
            <div key={group}>
              <div className="mt-[15px] mb-[7px] text-[#64748b] text-[11px] font-[850] tracking-[0.5px] uppercase">
                {group}
              </div>

              {groupDrives.map((drive) => {
                const isSelected = selectedDriveId === drive.id
                return (
                  <div
                    key={drive.id}
                    onClick={() => onSelectDrive(drive.id)}
                    className={`mb-[8px] p-[11px] rounded-[10px] border transition cursor-pointer ${
                      isSelected
                        ? 'border-[#60a5fa] bg-[#eff6ff] shadow-[inset_3px_0_#2563eb]'
                        : 'border-[#dbe5f1] bg-white hover:border-[#93c5fd]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-[6px]">
                      <div>
                        <div className="text-[13px] font-[800] text-[#25344a]">{drive.name}</div>
                        <div className="text-[11px] text-[#64748b] mt-[4px]">{drive.role}</div>
                      </div>
                      <span
                        className={`py-[5px] px-[7px] rounded-[20px] text-[10px] font-[850] whitespace-nowrap shrink-0 ${drive.badgeClass}`}
                      >
                        {drive.status}
                      </span>
                    </div>

                    <div className="mt-[9px] flex items-center justify-between text-[10px] text-[#64748b]">
                      <span>{drive.students}</span>
                      <span>{drive.subMeta}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
