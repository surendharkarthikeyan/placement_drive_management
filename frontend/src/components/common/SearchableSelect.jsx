import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Check, Building2, User } from 'lucide-react'

/**
 * SearchableSelect
 * Custom searchable dropdown designed with clean glassmorphic styling,
 * inner search input, keyboard/click navigation, and highlighted active selection.
 */
export default function SearchableSelect({
  label = '',
  required = false,
  options = [],
  value = '',
  onChange = () => {},
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  icon: Icon = null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef(null)
  const searchInputRef = useRef(null)

  // Find selected option
  const selectedOption = options.find((opt) => String(opt.value) === String(value))

  // Filter options based on search query
  const filteredOptions = options.filter((opt) => {
    const term = searchTerm.toLowerCase()
    return (
      (opt.label && opt.label.toLowerCase().includes(term)) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(term))
    )
  })

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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('')
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus()
        }
      }, 50)
    }
  }, [isOpen])

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
        <div className="flex items-center gap-2.5 truncate">
          {Icon && <Icon size={18} className="text-[#2563eb] shrink-0" />}
          <span className={selectedOption ? 'text-[#1e293b]' : 'text-[#94a3b8]'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.sublabel && (
            <span className="text-[12.5px] font-medium text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded-[6px]">
              {selectedOption.sublabel}
            </span>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`text-[#64748b] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[#2563eb]' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-white border border-[#dbe5f1] rounded-[13px] shadow-[0_10px_25px_-5px_rgba(15,23,42,0.12),0_8px_10px_-6px_rgba(15,23,42,0.06)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Inner Search Box */}
          <div className="p-2.5 border-b border-[#f1f5f9] bg-[#f8fafc]">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-[40px] pl-9 pr-3 bg-white border border-[#cbd5e1] focus:border-[#2563eb] rounded-[9px] text-[14.5px] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15 transition"
              />
            </div>
          </div>

          {/* Options List with Dedicated Custom Scrollbar */}
          <div className="max-h-[175px] overflow-y-auto p-1.5 flex flex-col gap-1 overscroll-contain pr-1 custom-dropdown-scroll">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-[14px] text-[#94a3b8]">
                No matching results found
              </div>
            ) : (
              filteredOptions.map((opt) => {
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
                    <div className="flex flex-col">
                      <span className="leading-snug">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-[12.5px] text-[#64748b] font-normal">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={16} className="text-[#2563eb] shrink-0 ml-2" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

