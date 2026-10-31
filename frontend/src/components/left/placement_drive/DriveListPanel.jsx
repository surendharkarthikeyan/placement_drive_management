import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, Search, Loader2, Users, Filter, Check, X } from 'lucide-react'
import { getDrives } from '../../../services/api'

/**
 * DriveListPanel (Left Panel)
 * - Restored the 3 filter tabs (All / Active / Completed) with the smooth sliding glass pill indicator
 * - Integrated Filter icon button next to search bar for specific status checks
 * - Instant zero-flicker client-side filtering
 */
export default function DriveListPanel({
  selectedDriveId = null,
  onSelectDrive = () => {},
  onOpenCreateModal = () => {},
  refreshKey = 0,
  selectedBatch = 'all'
}) {
  const [allDrives, setAllDrives] = useState([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'active' | 'completed'
  const [selectedStatuses, setSelectedStatuses] = useState(new Set())
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)
  const filterDropdownRef = useRef(null)

  // Glass moving pill ref & state for Filter Tabs (All / Active / Completed)
  const tabNavRef = useRef(null)
  const tabRefs = useRef({})
  const [tabPillStyle, setTabPillStyle] = useState({ left: 0, width: 0, opacity: 0 })

  const updateTabPill = () => {
    const activeEl = tabRefs.current[activeTab]
    const container = tabNavRef.current
    if (activeEl && container) {
      const activeRect = activeEl.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      setTabPillStyle({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
        height: activeRect.height,
        top: activeRect.top - containerRect.top,
        opacity: 1
      })
    }
  }

  useEffect(() => {
    updateTabPill()
    window.addEventListener('resize', updateTabPill)
    return () => window.removeEventListener('resize', updateTabPill)
  }, [activeTab])

  const statusOptions = [
    { value: 'in_progress', label: 'In Progress', dotColor: 'bg-[#2563eb]' },
    { value: 'registration_open', label: 'Registration Open', dotColor: 'bg-[#0284c7]' },
    { value: 'awaiting_final_result', label: 'Awaiting Result', dotColor: 'bg-[#d97706]' },
    { value: 'scheduled', label: 'Scheduled', dotColor: 'bg-[#7c3aed]' },
    { value: 'draft', label: 'Draft', dotColor: 'bg-[#64748b]' },
    { value: 'completed', label: 'Completed', dotColor: 'bg-[#16a34a]' },
    { value: 'awaiting_next_round', label: 'Date Pending', dotColor: 'bg-[#d97706]' },
    { value: 'on_hold', label: 'On Hold', dotColor: 'bg-[#94a3b8]' },
    { value: 'cancelled', label: 'Cancelled', dotColor: 'bg-[#dc2626]' }
  ]

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setIsFilterDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchAllDrives = async () => {
    try {
      const data = await getDrives({ status: 'all', batch: selectedBatch })
      setAllDrives(data)

      if (!selectedDriveId && data.length > 0) {
        onSelectDrive(data[0].id)
      }
    } catch (err) {
      console.error('Failed to load drives from backend:', err)
    } finally {
      setIsInitialLoading(false)
    }
  }

  useEffect(() => {
    fetchAllDrives()
  }, [refreshKey, selectedBatch])

  const toggleStatus = (statusValue) => {
    const next = new Set(selectedStatuses)
    if (next.has(statusValue)) {
      next.delete(statusValue)
    } else {
      next.add(statusValue)
    }
    setSelectedStatuses(next)
  }

  const clearStatusFilters = () => {
    setSelectedStatuses(new Set())
  }

  // Instant zero-flicker filtering combining Tabs + Status Checkboxes + Search
  const filteredDrives = useMemo(() => {
    return allDrives.filter((drive) => {
      // 1. Tab Filter (All / Active / Completed)
      if (activeTab === 'active' && (drive.overall_status === 'completed' || drive.overall_status === 'cancelled')) {
        return false
      }
      if (activeTab === 'completed' && drive.overall_status !== 'completed' && drive.overall_status !== 'cancelled') {
        return false
      }

      // 2. Specific Status Checkbox Filter (if any selected)
      if (selectedStatuses.size > 0 && !selectedStatuses.has(drive.overall_status)) {
        return false
      }

      // 3. Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const company = (drive.company?.company_name || '').toLowerCase()
        const role = (drive.job_role || '').toLowerCase()
        const status = (drive.overall_status || '').toLowerCase()
        return company.includes(q) || role.includes(q) || status.includes(q)
      }

      return true
    })
  }, [allDrives, activeTab, selectedStatuses, searchQuery])

  const getBadgeDetails = (status) => {
    switch (status) {
      case 'in_progress':
        return {
          label: 'In Progress',
          className: 'text-[#1d4ed8] bg-[#dbeafe]/90 border border-[#bfdbfe]/80 shadow-[0_2px_8px_rgba(37,99,235,0.12)]'
        }
      case 'registration_open':
        return {
          label: 'Registration Open',
          className: 'text-[#0284c7] bg-[#e0f2fe]/90 border border-[#bae6fd]/80 shadow-[0_2px_8px_rgba(2,132,199,0.12)]'
        }
      case 'awaiting_final_result':
        return {
          label: 'Awaiting Result',
          className: 'text-[#b45309] bg-[#fef3c7]/90 border border-[#fde68a]/80 shadow-[0_2px_8px_rgba(217,119,6,0.12)]'
        }
      case 'awaiting_next_round':
        return {
          label: 'Date Pending',
          className: 'text-[#b45309] bg-[#fef3c7]/90 border border-[#fde68a]/80'
        }
      case 'scheduled':
        return {
          label: 'Scheduled',
          className: 'text-[#6d28d9] bg-[#ede9fe]/90 border border-[#ddd6fe]/80 shadow-[0_2px_8px_rgba(109,40,217,0.12)]'
        }
      case 'completed':
        return {
          label: 'Completed',
          className: 'text-[#15803d] bg-[#dcfce7]/90 border border-[#bbf7d0]/80 shadow-[0_2px_8px_rgba(22,163,74,0.12)]'
        }
      case 'on_hold':
        return {
          label: 'On Hold',
          className: 'text-[#64748b] bg-[#f1f5f9] border border-[#cbd5e1]'
        }
      case 'cancelled':
        return {
          label: 'Cancelled',
          className: 'text-[#dc2626] bg-[#fef2f2] border border-[#fecaca]'
        }
      case 'draft':
      default:
        return {
          label: 'Draft',
          className: 'text-[#475569] bg-[#e2e8f0]/90 border border-[#cbd5e1]/80'
        }
    }
  }

  const groups = ['Requires Attention', 'Upcoming', 'Recently Completed']
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' }
  ]

  return (
    <aside className="w-[335px] min-w-[335px] h-full overflow-y-auto p-[16px] bg-[#f8fbff]/70 backdrop-blur-md border-r border-[#dbe5f1] select-none flex flex-col">
      {/* 1. Large + Create New Drive Button */}
      <button
        type="button"
        onClick={onOpenCreateModal}
        className="group relative w-full mb-[12px] h-[46px] px-[18px] bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] text-white font-[800] text-[15px] rounded-[12px] shadow-[0_4px_14px_rgba(37,99,235,0.28)] hover:shadow-[0_6px_22px_rgba(37,99,235,0.38)] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98] overflow-hidden shrink-0"
      >
        <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        <Plus size={19} strokeWidth={3} className="transition-transform group-hover:rotate-90 duration-300" />
        <span>Create New Drive</span>
      </button>

      {/* 2. Search Box with Integrated Filter Button */}
      <div className="relative mb-[12px] flex items-center gap-2 shrink-0" ref={filterDropdownRef}>
        <div className="relative flex-1 group">
          <span className="absolute left-[13px] top-[13.5px] text-[#94a3b8] group-focus-within:text-[#2563eb] transition-colors pointer-events-none">
            <Search size={17} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company or role"
            className="w-full h-[44px] pr-[12px] pl-[38px] bg-white hover:bg-white focus:bg-white border border-[#dbe5f1] focus:border-[#2563eb] rounded-[11px] text-[14px] text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-3 focus:ring-[#2563eb]/15 transition-all shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
          />
        </div>

        {/* Filter Trigger Button */}
        <button
          type="button"
          onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
          title="Filter by recruitment status"
          className={`h-[44px] px-3 rounded-[11px] border flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
            selectedStatuses.size > 0
              ? 'bg-[#eff6ff] text-[#2563eb] border-[#93c5fd] font-bold shadow-xs'
              : 'bg-white text-[#64748b] hover:text-[#1e293b] border-[#dbe5f1] hover:border-[#cbd5e1]'
          }`}
        >
          <Filter size={16} />
          {selectedStatuses.size > 0 && (
            <span className="w-5 h-5 rounded-full bg-[#2563eb] text-white text-[11px] font-bold flex items-center justify-center">
              {selectedStatuses.size}
            </span>
          )}
        </button>

        {/* Status Filter Dropdown Menu */}
        {isFilterDropdownOpen && (
          <div className="absolute top-[50px] right-0 w-[240px] bg-white/95 backdrop-blur-md rounded-[14px] shadow-[0_12px_36px_rgba(15,23,42,0.18)] border border-[#dbe5f1] p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#f1f5f9]">
              <span className="text-[11px] font-[850] uppercase tracking-wider text-[#64748b]">
                Status Filter
              </span>
              {selectedStatuses.size > 0 && (
                <button
                  type="button"
                  onClick={clearStatusFilters}
                  className="text-[11px] text-[#2563eb] hover:underline font-semibold cursor-pointer"
                >
                  Reset All
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-1">
              {statusOptions.map((opt) => {
                const isChecked = selectedStatuses.has(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleStatus(opt.value)}
                    className={`w-full px-2.5 py-1.5 rounded-[8px] flex items-center justify-between text-left text-[12.5px] transition cursor-pointer ${
                      isChecked
                        ? 'bg-[#eff6ff] text-[#2563eb] font-semibold'
                        : 'text-[#334155] hover:bg-[#f8fafc]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${opt.dotColor}`} />
                      <span>{opt.label}</span>
                    </div>
                    {isChecked && <Check size={14} className="text-[#2563eb]" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Filter Tabs (All / Active / Completed) with Animated Sliding Glass Pill */}
      <div
        ref={tabNavRef}
        className="relative mb-[15px] p-[3px] grid grid-cols-3 gap-[3px] rounded-[10px] bg-[#f1f5f9]/90 border border-[#e2e8f0]/80 backdrop-blur-md overflow-hidden shrink-0"
      >
        {/* Animated Moving Glass Pill Indicator */}
        <div
          style={{
            transform: `translate3d(${tabPillStyle.left}px, ${tabPillStyle.top}px, 0)`,
            width: `${tabPillStyle.width}px`,
            height: `${tabPillStyle.height}px`,
            opacity: tabPillStyle.opacity
          }}
          className="absolute top-0 left-0 pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] rounded-[8px] bg-white/95 backdrop-blur-md border border-white shadow-[0_2px_8px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)] z-0"
        />

        {tabs.map((t) => {
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              ref={(el) => (tabRefs.current[t.id] = el)}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`relative z-10 py-[7.5px] px-[4px] text-[12.5px] font-[750] rounded-[7px] capitalize transition-colors duration-200 cursor-pointer text-center ${
                isActive
                  ? 'text-[#2563eb]'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Active Filter Chips (if any specific status is checked) */}
      {selectedStatuses.size > 0 && (
        <div className="mb-[12px] flex items-center flex-wrap gap-1.5 shrink-0">
          {Array.from(selectedStatuses).map((st) => {
            const opt = statusOptions.find((o) => o.value === st)
            return (
              <span
                key={st}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#eff6ff] text-[#1e40af] border border-[#bfdbfe]"
              >
                <span>{opt?.label || st}</span>
                <X
                  size={12}
                  className="cursor-pointer hover:text-[#dc2626]"
                  onClick={() => toggleStatus(st)}
                />
              </span>
            )
          })}
          <button
            type="button"
            onClick={clearStatusFilters}
            className="text-[11px] text-[#64748b] hover:text-[#dc2626] font-medium ml-1 underline cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* 4. Drives List fetched from DB with Smooth Zero-Flicker Transitions */}
      <div className="flex-1 overflow-y-auto pr-1">
        {isInitialLoading && (
          <div className="flex items-center justify-center py-12 text-[#64748b] gap-2 text-xs">
            <Loader2 size={16} className="animate-spin text-[#2563eb]" />
            <span>Loading drives...</span>
          </div>
        )}

        {!isInitialLoading && filteredDrives.length === 0 && (
          <div className="text-center py-12 text-[#64748b] text-[12px] bg-white/50 border border-dashed border-[#dbe5f1] rounded-[10px] m-1 p-4">
            No matching drives found.
          </div>
        )}

        {!isInitialLoading &&
          groups.map((group) => {
            const groupDrives = filteredDrives.filter(
              (d) => (d.status_group || 'Requires Attention') === group
            )
            if (!groupDrives.length) return null

            return (
              <div key={group} className="mb-[15px] animate-in fade-in duration-200">
                <div className="mb-[7px] text-[#64748b] text-[10.5px] font-[850] tracking-[0.6px] uppercase px-1 flex items-center justify-between">
                  <span>{group}</span>
                  <span className="text-[10px] font-semibold text-[#94a3b8] bg-[#f1f5f9] px-1.5 py-0.2 rounded-full">
                    {groupDrives.length}
                  </span>
                </div>

                {groupDrives.map((drive) => {
                  const isSelected = selectedDriveId === drive.id
                  const companyName = drive.company?.company_name || 'Placement Company'
                  const badge = getBadgeDetails(drive.overall_status)

                  return (
                    <div
                      key={drive.id}
                      onClick={() => onSelectDrive(drive.id)}
                      className={`group relative mb-[8px] p-[12px_14px] rounded-[11px] transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-br from-white via-[#f0f6ff] to-[#e6f0fd] border border-[#60a5fa] shadow-[0_4px_16px_rgba(37,99,235,0.10)] ring-1 ring-[#2563eb]/20 translate-x-[2px]'
                          : 'bg-white/90 hover:bg-white backdrop-blur-xs border border-[#e2e8f0] hover:border-[#93c5fd] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-[1px]'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute -left-[1px] top-[10px] bottom-[10px] w-[3.5px] rounded-r-full bg-[#2563eb] shadow-[0_0_8px_#3b82f6]" />
                      )}

                      <div className="flex items-start justify-between gap-[8px]">
                        <div>
                          <div className="text-[14px] font-[800] text-[#1e293b] group-hover:text-[#2563eb] transition-colors leading-tight flex items-center gap-1.5">
                            <span>{companyName}</span>
                          </div>
                          <div className="text-[11.5px] text-[#64748b] mt-[3px] line-clamp-1 font-medium">
                            {drive.job_role}
                          </div>
                        </div>

                        <span
                          className={`py-[3.5px] px-[8.5px] rounded-[18px] text-[10px] font-[850] whitespace-nowrap shrink-0 backdrop-blur-sm transition-transform group-hover:scale-[1.03] ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="mt-[9px] pt-[7px] border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#64748b]">
                        <span className="flex items-center gap-1 font-medium">
                          <Users size={12} className="text-[#94a3b8]" />
                          {drive.total_students || 0} students
                        </span>
                        <span className="text-[#94a3b8] font-normal">
                          {drive.subtitle_meta || 'Drive Record'}
                        </span>
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
