"use client";
import React from "react";

export interface FilterState {
  search: string;
  type: string; // DataQube | ContentQube | ToolQube | ModelQube | AigentQube | ""
  instance: string; // template | instance | ""
  businessModel: string; // Buy | Sell | Rent | Lease | Subscribe | Stake | License | Donate | ""
  sort?: 'newest' | 'oldest';
}

interface FilterSectionProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
  className?: string;
}

const label = "text-[12px] text-slate-400 text-center";
const select =
  "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/50";

export const FilterSection: React.FC<FilterSectionProps> = ({ value, onChange, className }) => {
  const update = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  return (
    <div className={"grid gap-3 md:grid-cols-2 lg:grid-cols-5 " + (className || "") }>
      <div>
        <div className={label}>Search</div>
        <input
          type="text"
          value={value.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Search iQubes"
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/50"
        />
      </div>

      <div>
        <div className={label}>Type</div>
        <select
          value={value.type}
          onChange={(e) => update({ type: e.target.value })}
          className={select}
          aria-label="Type"
        >
          <option value="">All Types</option>
          <option>DataQube</option>
          <option>ContentQube</option>
          <option>ToolQube</option>
          <option>ModelQube</option>
          <option>AigentQube</option>
        </select>
      </div>

      <div>
        <div className={label}>Instance</div>
        <select
          value={value.instance}
          onChange={(e) => update({ instance: e.target.value })}
          className={select}
          aria-label="Instance"
        >
          <option value="">Templates & Instances</option>
          <option value="template">Templates</option>
          <option value="instance">Instances</option>
        </select>
      </div>

      <div>
        <div className={label}>Business Model</div>
        <select
          value={value.businessModel}
          onChange={(e) => update({ businessModel: e.target.value })}
          className={select}
          aria-label="Business Model"
        >
          <option value="">All Models</option>
          <option>Buy</option>
          <option>Sell</option>
          <option>Rent</option>
          <option>Lease</option>
          <option>Subscribe</option>
          <option>Stake</option>
          <option>License</option>
          <option>Donate</option>
        </select>
      </div>

      <div>
        <div className={label}>Date</div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            className={`px-3 py-2 text-sm rounded-lg border ${value.sort !== 'oldest' ? 'border-white/10 text-slate-300' : 'border-indigo-500/40 text-indigo-300 bg-indigo-500/10'}`}
            title="Newest first"
            onClick={() => update({ sort: 'newest' })}
          >
            ↓
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm rounded-lg border ${value.sort === 'oldest' ? 'border-indigo-500/40 text-indigo-300 bg-indigo-500/10' : 'border-white/10 text-slate-300'}`}
            title="Oldest first"
            onClick={() => update({ sort: 'oldest' })}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
};
