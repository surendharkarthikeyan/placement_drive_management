import React from 'react'

/**
 * Reusable Offers Received Card.
 * Displays each offer with rupee icon, company name, package, and status pill.
 */
export default function StudentOffersCard({ offers = [] }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-[14px] font-bold text-[#172554] tracking-tight m-0">
        Offers Received
      </h3>

      {offers && offers.length > 0 ? (
        offers.map((offer, idx) => (
          <div
            key={offer.offer_id || idx}
            className="bg-white border border-[#dbe5f1] rounded-[16px] p-[12px_16px] flex items-center justify-between shadow-[0_1px_3px_rgba(15,23,42,0.03)] hover:border-[#cbd5e1] transition-all"
          >
            {/* Left: Rupee Icon & Offer Details */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-[42px] h-[42px] rounded-[12px] bg-[#eff6ff] flex items-center justify-center text-[#2563eb] text-[16px] font-bold shrink-0">
                ₹
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[15px] font-bold text-[#172554] leading-snug truncate">
                  {offer.company_name}
                </span>
                <span className="text-[13px] font-medium text-[#64748b] leading-tight mt-0.5">
                  {offer.package_lpa != null ? `₹${offer.package_lpa} LPA` : (offer.role || 'Offer Secured')}
                </span>
              </div>
            </div>

            {/* Right: Status Pill Badge */}
            <span className="px-3.5 py-1 rounded-full text-[12px] font-bold bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0]/60 inline-flex items-center shrink-0">
              {offer.status || 'Accepted'}
            </span>
          </div>
        ))
      ) : (
        <div className="bg-[#fbfdff] border border-dashed border-[#cbd5e1] rounded-[16px] py-4 px-4 flex items-center justify-center text-center text-[#94a3b8] text-[13px] font-semibold">
          No offers
        </div>
      )}
    </div>
  )
}
