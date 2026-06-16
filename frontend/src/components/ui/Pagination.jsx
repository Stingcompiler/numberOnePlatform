import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ count, pageSize = 10, currentPage, onPageChange }) {
  if (!count || count <= pageSize) return null

  const totalPages = Math.ceil(count / pageSize)
  const isFirst = currentPage === 1
  const isLast = currentPage === totalPages

  // A simple generator for page numbers.
  // In a very large app we might need to truncate these with ellipses (...), 
  // but for ERP dashboards showing ~10-20 pages max, straight mapping is very clean.
  let startPage = Math.max(1, currentPage - 2)
  let endPage = Math.min(totalPages, startPage + 4)

  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4)
  }

  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)

  return (
    <div className="flex items-center justify-center gap-1 mt-6 animate-fade-in" dir="rtl">
      <button
        onClick={() => !isFirst && onPageChange(currentPage - 1)}
        disabled={isFirst}
        title="السابق"
        className="p-2 disabled:opacity-30 bg-dark-800 border border-white/05 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all shadow-sm flex items-center"
      >
        <ChevronRight size={16} /> {/* Right points to Previous in RTL */}
      </button>

      <div className="flex items-center gap-1">
        {startPage > 1 && (
          <>
            <button onClick={() => onPageChange(1)} className="w-9 h-9 rounded-xl text-sm font-bold bg-dark-800 text-white/40 border border-white/05 hover:bg-white/10 hover:text-white transition-all">1</button>
            {startPage > 2 && <span className="text-white/20 select-none px-1">...</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-9 h-9 rounded-xl text-sm font-bold transition-all border ${p === currentPage
                ? 'bg-brand-blue text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] border-brand-blue/50'
                : 'bg-dark-800 text-white/40 border-white/05 hover:bg-white/10 hover:text-white'
              }`}
          >
            {p}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-white/20 select-none px-1">...</span>}
            <button onClick={() => onPageChange(totalPages)} className="w-9 h-9 rounded-xl text-sm font-bold bg-dark-800 text-white/40 border border-white/05 hover:bg-white/10 hover:text-white transition-all">{totalPages}</button>
          </>
        )}
      </div>

      <button
        onClick={() => !isLast && onPageChange(currentPage + 1)}
        disabled={isLast}
        title="التالي"
        className="p-2 disabled:opacity-30 bg-dark-800 border border-white/05 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all shadow-sm flex items-center"
      >
        <ChevronLeft size={16} /> {/* Left points to Next in RTL */}
      </button>
    </div>
  )
}
