import React, { useState, useRef, useEffect } from 'react'
import { GraduationCap, ChevronDown, Check } from 'lucide-react'

/**
 * ModuleNavigationTabs
 * Enhanced secondary navigation bar:
 * - Left: Module navigation tabs (Placement Intelligence, Placement Drive, etc.) with animated moving pill
 * - Right: Batch choosing dropdown + Placement Team Workspace label
 */
export default function ModuleNavigationTabs({
  activeModule = 'Placement Drive',
  onModuleChange = () => {},
  batches = [],
  selectedBatch = 'all',
  onBatchChange = () => {}
}) {
  const [currentModule, setCurrentModule] = useState(activeModule)
  const [isBatchOpen, setIsBatchOpen] = useState(false)
  const batchRef = useRef(null)

  const modules = [
    'Placement Intelligence',
    'Placement Drive',
    'Student Placement Review',
    'Events & Communications'
  ]

  const navRef = useRef(null)
  const tabRefs = useRef({})
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, opacity: 0 })

  const updatePill = () => {
    const activeEl = tabRefs.current[currentModule]
    const container = navRef.current
    if (activeEl && container) {
      const activeRect = activeEl.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      setPillStyle({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
        height: activeRect.height,
        top: activeRect.top - containerRect.top,
        opacity: 1
      })
    }
  }

  useEffect(() => {
    updatePill()
    window.addEventListener('resize', updatePill)
    return () => window.removeEventListener('resize', updatePill)
  }, [currentModule])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (batchRef.current && !batchRef.current.contains(e.target)) {
        setIsBatchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (mod) => {
    setCurrentModule(mod)
    onModuleChange(mod)
  }

  const currentBatchLabel =
    selectedBatch === 'all'
      ? 'All Batches'
      : batches.find((b) => b.name === selectedBatch)?.name
      ? `Batch ${batches.find((b) => b.name === selectedBatch).name}`
      : `Batch ${selectedBatch}`

  return (
    <div className="h-[70px] min-h-[70px] px-[28px] flex items-center justify-between bg-white border-b border-[#dbe5f1] z-20 select-none">
      {/* Navigation Container */}
      <nav
        ref={navRef}
        aria-label="Modules"
        className="relative p-[5px] flex items-center gap-[6px] rounded-[12px] bg-[#f1f5f9] border border-[#e2e8f0]/80 overflow-hidden"
      >
        {/* Animated Moving Glass Pill Indicator */}
        <div
          style={{
            transform: `translate3d(${pillStyle.left}px, ${pillStyle.top}px, 0)`,
            width: `${pillStyle.width}px`,
            height: `${pillStyle.height}px`,
            opacity: pillStyle.opacity
          }}
          className="absolute top-0 left-0 pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] rounded-[9px] bg-white/95 backdrop-blur-md border border-white shadow-[0_2px_10px_rgba(15,23,42,0.09),0_1px_3px_rgba(15,23,42,0.05)] z-0"
        />

        {/* Tab Buttons */}
        {modules.map((mod) => {
          const isActive = currentModule === mod
          return (
            <button
              key={mod}
              ref={(el) => (tabRefs.current[mod] = el)}
              type="button"
              onClick={() => handleSelect(mod)}
              className={`relative z-10 px-[19px] py-[10px] text-[15px] font-[650] rounded-[9px] transition-colors duration-150 cursor-pointer ${
                isActive
                  ? 'text-[#2563eb]'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              {mod}
            </button>
          )
        })}
      </nav>

      {/* Right Section: Workspace context & Interactive Batch Dropdown */}
      <div className="flex items-center gap-3.5">
        <div className="text-[13.5px] font-[600] text-[#64748b] hidden xl:block">
          Placement Team Workspace
        </div>

        <div className="hidden xl:block h-4 w-[1px] bg-[#e2e8f0]" />

        {/* Batch Choosing Dropdown */}
        <div className="relative" ref={batchRef}>
          <button
            type="button"
            onClick={() => setIsBatchOpen((prev) => !prev)}
            className="h-[40px] px-3.5 bg-[#f8fafc] hover:bg-white border border-[#cbd5e1] hover:border-[#2563eb] rounded-[10px] text-[13.5px] font-[750] text-[#1e293b] flex items-center gap-2.5 transition cursor-pointer shadow-2xs active:scale-[0.98]"
          >
            <GraduationCap size={16} className="text-[#2563eb]" />
            <span>{currentBatchLabel}</span>
            <ChevronDown
              size={15}
              className={`text-[#64748b] transition-transform duration-200 ${
                isBatchOpen ? 'rotate-180 text-[#2563eb]' : ''
              }`}
            />
          </button>

          {isBatchOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-[210px] bg-white border border-[#dbe5f1] rounded-[12px] shadow-[0_12px_36px_rgba(15,23,42,0.14)] p-1.5 flex flex-col gap-1 z-50 text-[#1e293b] animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[11px] font-[800] uppercase tracking-wider text-[#94a3b8] border-b border-[#f1f5f9] mb-1">
                Filter By Batch
              </div>

              <button
                type="button"
                onClick={() => {
                  onBatchChange('all')
                  setIsBatchOpen(false)
                }}
                className={`w-full px-3 py-2 rounded-[8px] text-[13px] font-[650] flex items-center justify-between text-left transition cursor-pointer ${
                  selectedBatch === 'all'
                    ? 'bg-[#eff6ff] text-[#2563eb]'
                    : 'hover:bg-[#f8fafc] text-[#334155]'
                }`}
              >
                <span>All Batches</span>
                {selectedBatch === 'all' && <Check size={14} className="text-[#2563eb]" />}
              </button>

              {batches.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => {
                    onBatchChange(batch.name)
                    setIsBatchOpen(false)
                  }}
                  className={`w-full px-3 py-2 rounded-[8px] text-[13px] font-[650] flex items-center justify-between text-left transition cursor-pointer ${
                    selectedBatch === batch.name
                      ? 'bg-[#eff6ff] text-[#2563eb]'
                      : 'hover:bg-[#f8fafc] text-[#334155]'
                  }`}
                >
                  <span>Batch {batch.name}</span>
                  {selectedBatch === batch.name && <Check size={14} className="text-[#2563eb]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
