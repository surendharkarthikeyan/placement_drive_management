import React, { useState, useEffect, useRef } from 'react'

/**
 * GlassSegmentedControl
 * Renders an InstiPortal glassmorphism segmented pill control with an animated
 * floating glass indicator that slides smoothly between options.
 */
export default function GlassSegmentedControl({
  options = [],
  value,
  onChange = () => {},
  className = '',
  buttonPy = 'py-[7px]',
  fontSize = 'text-[12.5px]'
}) {
  const containerRef = useRef(null)
  const itemRefs = useRef({})
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, height: 0, top: 0, opacity: 0 })

  const updatePill = () => {
    const activeEl = itemRefs.current[value]
    if (activeEl && activeEl.offsetWidth > 0) {
      setPillStyle({
        left: activeEl.offsetLeft,
        top: activeEl.offsetTop,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
        opacity: 1
      })
    }
  }

  useEffect(() => {
    const id = requestAnimationFrame(updatePill)
    const timer1 = setTimeout(updatePill, 40)
    const timer2 = setTimeout(updatePill, 120)
    return () => {
      cancelAnimationFrame(id)
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [value, options])

  useEffect(() => {
    window.addEventListener('resize', updatePill)
    return () => window.removeEventListener('resize', updatePill)
  }, [value])

  return (
    <div
      ref={containerRef}
      className={`relative p-[5px] flex items-stretch gap-[4px] rounded-[13px] bg-[#f1f5f9]/85 border border-[#e2e8f0] backdrop-blur-md overflow-hidden ${className}`}
    >
      {/* Animated Moving Glass Pill Indicator */}
      <div
        style={{
          transform: `translate3d(${pillStyle.left}px, ${pillStyle.top}px, 0)`,
          width: `${pillStyle.width}px`,
          height: `${pillStyle.height}px`,
          opacity: pillStyle.opacity
        }}
        className="absolute top-0 left-0 pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] rounded-[9px] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.05)] border border-[#e2e8f0]/60 z-0"
      />

      {options.map((opt) => {
        const isActive = value === opt.id
        return (
          <button
            key={opt.id}
            ref={(el) => (itemRefs.current[opt.id] = el)}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`relative z-10 flex-1 min-h-[36px] flex items-center justify-center ${buttonPy} px-2.5 ${fontSize} font-bold rounded-[9px] transition-colors duration-200 cursor-pointer text-center leading-tight ${
              isActive
                ? 'text-[#2563eb]'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

