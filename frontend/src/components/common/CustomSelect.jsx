import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/**
 * CustomSelect
 * Clean, lightweight dropdown with matching rounded styling, active border highlights,
 * and custom popup menu WITHOUT any search bar.
 */
export default function CustomSelect({
  label = '',
  required = false,
  options = [],
  value = '',
  onChange = () => {},
  placeholder = 'Select option...'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const selectedOption = options.find((opt) => String(opt.value) === String(value))

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

  const handleSelect = (val) => {
    onChange(val)
    setIsOpen(false)
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="text-[15px] font-[750] text-[#334155] block mb-[7px]">
          {label} {required && <span className="text-[#dc2626]">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full h-[50px] px-[15px] bg-white border rounded-[11px] text-[15.5px] font-[600] text-[#1e293b] flex items-center justify-between transition cursor-pointer shadow-xs ${
          isOpen
            ? 'border-[#2563eb] ring-3 ring-[#2563eb]/15'
            : 'border-[#dbe5f1] hover:border-[#cbd5e1]'
        }`}
      >
        <span className={selectedOption ? 'text-[#1e293b]' : 'text-[#94a3b8]'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`text-[#64748b] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[#2563eb]' : ''
          }`}
        />
      </button>

      {/* Styled Popup List (Open upwards if near bottom, with scrolling) */}
      {isOpen && (
        <div className="absolute bottom-[calc(100%+6px)] left-0 right-0 z-50 bg-white border border-[#dbe5f1] rounded-[13px] shadow-[0_-10px_25px_-5px_rgba(15,23,42,0.12),0_-8px_10px_-6px_rgba(15,23,42,0.06)] p-1.5 flex flex-col gap-1 max-h-[175px] overflow-y-auto overscroll-contain pr-1 custom-dropdown-scroll animate-in fade-in zoom-in-95 duration-150">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-3.5 py-2.5 rounded-[9px] text-[15px] flex items-center justify-between text-left transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#eff6ff] text-[#2563eb] font-[750]'
                    : 'hover:bg-[#f8fafc] text-[#334155] font-[600]'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={16} className="text-[#2563eb] shrink-0 ml-2" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

