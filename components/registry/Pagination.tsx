"use client";

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  limit,
  hasNextPage,
  hasPrevPage,
  onPageChange,
  onLimitChange,
}: PaginationProps) {
  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalCount);

  // Generate page numbers to show
  const getVisiblePages = () => {
    const pages: number[] = [];
    const maxVisible = 7;
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate range around current page
      let start = Math.max(2, currentPage - 2);
      let end = Math.min(totalPages - 1, currentPage + 2);
      
      // Adjust range if it's too small
      if (end - start < 4) {
        if (start === 2) {
          end = Math.min(totalPages - 1, start + 4);
        } else if (end === totalPages - 1) {
          start = Math.max(2, end - 4);
        }
      }
      
      // Add ellipsis if needed
      if (start > 2) {
        pages.push(-1); // Ellipsis indicator
      }
      
      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // Add ellipsis if needed
      if (end < totalPages - 1) {
        pages.push(-1); // Ellipsis indicator
      }
      
      // Always show last page if different from first
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-900/50 border-t border-slate-800">
      {/* Results summary */}
      <div className="text-sm text-slate-400">
        Showing {startItem} to {endItem} of {totalCount} results
      </div>

      <div className="flex items-center gap-4">
        {/* Results per page */}
        {onLimitChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Show</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(parseInt(e.target.value))}
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={96}>96</option>
            </select>
            <span className="text-sm text-slate-400">per page</span>
          </div>
        )}

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          {/* Previous button */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPrevPage}
            className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-700 bg-slate-800 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {visiblePages.map((page, index) => {
              if (page === -1) {
                // Ellipsis
                return (
                  <span key={`ellipsis-${index}`} className="px-2 text-slate-500">
                    ...
                  </span>
                );
              }

              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`flex items-center justify-center w-8 h-8 rounded-md border text-sm font-medium transition-colors ${
                    page === currentPage
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  aria-label={`Go to page ${page}`}
                  aria-current={page === currentPage ? 'page' : undefined}
                >
                  {page}
                </button>
              );
            })}
          </div>

          {/* Next button */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNextPage}
            className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-700 bg-slate-800 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
