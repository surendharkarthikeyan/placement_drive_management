import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, GraduationCap } from 'lucide-react'

/**
 * MultiSelectDropdown
 * Custom multi-select component matching the exact styling of SearchableSelect & CustomSelect:
 * - Rounded 11px border with blue focus ring
 * - Custom checkbox items with blue accenting
 * - Select single or multiple batches
 * - Zero native browser select gray styling
 */
export default function MultiSelectDropdown({
  label = '',
  required = false,
  options = [],
  selectedValues = [],
  onChange = () => {},
  placeholder = 'Select batches...',
  itemNoun = 'batch',
  itemNounPlural = 'batches',
  icon: Icon = GraduationCap,
  buttonH = 'h-[50px]',
  fontSize = 'text-[15.5px]',
  labelFontSize = 'text-[15px] font-[750] text-[#334155]',
  iconSize = 18,
  badgeSize = 'text-[12px]'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleOption = (val) => {
    const current = new Set(selectedValues)
    if (current.has(val)) {
      current.delete(val)
    } else {
      current.add(val)
    }
    onChange(Array.from(current))
  }

  const isAllSelected = options.length > 0 && options.every((o) => selectedValues.includes(o.value))

  const handleToggleAll = () => {
    if (isAllSelected) {
      onChange([])
    } else {
      onChange(options.map((o) => o.value))
    }
  }

  // Label text to display on trigger button
  const getDisplayText = () => {
    if (!selectedValues || selectedValues.length === 0) return placeholder
    if (isAllSelected && options.length > 1) {
      return `All ${itemNounPlural}`
    }
    const selectedNames = options
      .filter((o) => selectedValues.includes(o.value))
      .map((o) => o.label)
    if (selectedNames.length === 0) return placeholder
    return selectedNames.join(', ')
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className={`${labelFontSize} block mb-[7px]`}>
          {label} {required && <span className="text-[#dc2626]">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full ${buttonH} px-[15px] bg-white border rounded-[11px] ${fontSize} font-[600] text-[#1e293b] flex items-center justify-between transition cursor-pointer shadow-xs ${
          isOpen
            ? 'border-[#2563eb] ring-3 ring-[#2563eb]/15'
            : 'border-[#dbe5f1] hover:border-[#cbd5e1]'
        }`}
      >
        <div className="flex items-center gap-2.5 truncate pr-2">
          {Icon && <Icon size={iconSize} className="text-[#2563eb] shrink-0" />}
          <span className={`truncate ${selectedValues && selectedValues.length > 0 ? 'text-[#1e293b]' : 'text-[#94a3b8]'}`}>
            {getDisplayText()}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selectedValues && selectedValues.length > 1 && (
            <span className={`${badgeSize} font-bold text-[#2563eb] bg-[#eff6ff] border border-[#bfdbfe] px-2 py-0.5 rounded-full`}>
              {selectedValues.length} {selectedValues.length === 1 ? itemNoun : itemNounPlural}
            </span>
          )}
          <ChevronDown
            size={iconSize}
            className={`text-[#64748b] transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180 text-[#2563eb]' : ''
            }`}
          />
        </div>
      </button>

      {/* Custom Dropdown List */}
      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-white border border-[#dbe5f1] rounded-[13px] shadow-[0_10px_25px_-5px_rgba(15,23,42,0.12),0_8px_10px_-6px_rgba(15,23,42,0.06)] p-2 flex flex-col gap-1 max-h-[230px] overflow-y-auto overscroll-contain pr-1 custom-dropdown-scroll animate-in fade-in zoom-in-95 duration-150">
          {options.length === 0 ? (
            <div className="py-4 text-center text-[14px] text-[#94a3b8]">
              No {itemNounPlural} found
            </div>
          ) : (
            <>
              {/* One-click Select All Option */}
              {options.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handleToggleAll}
                    className={`w-full px-3.5 py-2.5 rounded-[9px] ${fontSize} flex items-center justify-between text-left transition cursor-pointer ${
                      isAllSelected
                        ? 'bg-[#eff6ff] text-[#2563eb] font-[750]'
                        : 'hover:bg-[#f8fafc] text-[#1e293b] font-[700]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition ${
                          isAllSelected
                            ? 'bg-[#2563eb] border-[#2563eb] text-white'
                            : 'border-[#cbd5e1] bg-white'
                        }`}
                      >
                        {isAllSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className="font-[750]">
                        {isAllSelected ? `Deselect All (${options.length})` : `Select All (${options.length} ${itemNounPlural})`}
                      </span>
                    </div>
                    {isAllSelected && <Check size={16} className="text-[#2563eb] shrink-0 ml-2" />}
                  </button>
                  <div className="w-full h-px bg-[#f1f5f9] my-0.5" />
                </>
              )}

              {options.map((opt) => {
                const isSelected = selectedValues.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleToggleOption(opt.value)}
                    className={`w-full px-3.5 py-2.5 rounded-[9px] ${fontSize} flex items-center justify-between text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#eff6ff] text-[#2563eb] font-[750]'
                        : 'hover:bg-[#f8fafc] text-[#334155] font-[600]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition ${
                          isSelected
                            ? 'bg-[#2563eb] border-[#2563eb] text-white'
                            : 'border-[#cbd5e1] bg-white'
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span>{opt.label}</span>
                    </div>
                    {isSelected && <Check size={16} className="text-[#2563eb] shrink-0 ml-2" />}
                  </button>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

