import React from 'react'

/**
 * TopNavigationBar
 * Balanced top application header:
 * - Bar height: 74px
 * - Logo badge: 44x44px, text 17px
 * - Title: 21px font
 * - Subtitle: 13px font
 * - Right: Static Year pill + PO User Avatar
 */
export default function TopNavigationBar() {
  return (
    <header className="h-[74px] min-h-[74px] px-[26px] flex items-center justify-between text-white bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#1d4ed8] shadow-[0_3px_16px_rgba(30,64,175,0.20)] z-30 select-none">
      {/* Brand Identity */}
      <div className="flex items-center gap-[14px]">
        <div className="w-[44px] h-[44px] flex items-center justify-center rounded-[13px] bg-white/15 border border-white/25 font-[850] text-[17px] tracking-wide shadow-xs">
          IP
        </div>
        <div>
          <div className="text-[21px] font-[800] leading-tight tracking-tight">
            InstiPortal
          </div>
          <div className="text-[13px] text-white/85 font-medium mt-[2px]">
            Placement Drive Management
          </div>
        </div>
      </div>

      {/* Right User Actions */}
      <div className="flex items-center gap-[14px]">
        <div className="px-[16px] py-[8px] text-[13.5px] font-[750] text-white/95 bg-white/12 border border-white/20 rounded-[10px] shadow-xs">
          Placement Year 2025–26
        </div>

        <div
          title="Placement Officer"
          className="w-[42px] h-[42px] rounded-full bg-white text-[#172554] font-[850] text-[15px] flex items-center justify-center shadow-md cursor-pointer hover:ring-3 hover:ring-white/40 transition"
        >
          PO
        </div>
      </div>
    </header>
  )
}
