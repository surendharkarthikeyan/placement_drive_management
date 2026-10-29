import React from 'react'

export default function Header() {
  return (
    <header className="h-[66px] min-h-[66px] px-5 flex items-center justify-between text-white bg-gradient-to-r from-[#172554] to-[#1d4ed8] shadow-[0_3px_14px_rgba(30,64,175,0.18)] z-20 select-none">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-[40px] h-[40px] flex items-center justify-center rounded-[12px] bg-white/15 border border-white/25 font-[850] text-sm tracking-wide">
          IP
        </div>
        <div>
          <div className="text-[18px] font-[800] leading-tight">
            InstiPortal
          </div>
          <div className="text-[11px] text-white/80 font-normal mt-[2px]">
            Placement Drive Management
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-[9px]">
        <button className="px-[13px] py-[9px] text-[13px] font-[750] text-white bg-white/10 hover:bg-white/20 border border-white/25 rounded-[9px] transition">
          Placement Year 2025–26
        </button>
        <div className="w-[37px] h-[37px] rounded-full bg-white text-[#172554] font-[850] text-[13px] flex items-center justify-center shadow-xs cursor-pointer hover:ring-2 hover:ring-white/50 transition">
          PO
        </div>
      </div>
    </header>
  )
}
