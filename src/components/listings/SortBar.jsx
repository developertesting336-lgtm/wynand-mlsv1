import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FilterDrawer from './FilterDrawer';
import FilterChips from './FilterChips';

export default function SortBar({ filters, setFilters, sortBy, setSortBy, count, isLoading }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <FilterDrawer filters={filters} setFilters={setFilters} />

        <div className="flex-1 overflow-x-auto">
          {/* Desktop inline quick-filters */}
          <div className="hidden md:flex gap-2 items-center">
            {[
              { key: 'rentalType', value: 'long_term', label: 'Long-term' },
              { key: 'rentalType', value: 'short_term', label: 'Short-term' },
              { key: 'petFriendly', value: true, label: '🐾 Pet OK' },
              { key: 'furnished', value: 'furnished', label: 'Furnished' },
            ].map(({ key, value, label }) => {
              const active = filters[key] === value;
              return (
                <button
                  key={label}
                  onClick={() => setFilters(prev => ({ ...prev, [key]: active ? undefined : value }))}
                  className={`whitespace-nowrap px-4 py-2 rounded-full border text-sm font-medium transition-all ${active ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'border-border hover:border-primary hover:text-primary bg-card'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {!isLoading && (
            <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:block">
              {count} rental{count !== 1 ? 's' : ''}
            </span>
          )}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price ↑</SelectItem>
              <SelectItem value="price_desc">Price ↓</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <FilterChips filters={filters} setFilters={setFilters} />
    </div>
  );
}