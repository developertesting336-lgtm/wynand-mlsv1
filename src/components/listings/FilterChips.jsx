import React from 'react';
import { X } from 'lucide-react';
import { NEIGHBORHOOD_LABELS } from '@/lib/constants';

const CHIP_LABELS = {
  neighborhood: v => NEIGHBORHOOD_LABELS[v] || v,
  bedrooms: v => `${v}+ Beds`,
  bathrooms: v => `${v}+ Baths`,
  minPrice: v => `From $${v.toLocaleString()}`,
  maxPrice: v => `Up to $${v.toLocaleString()}`,
  furnished: v => ({ furnished: 'Furnished', unfurnished: 'Unfurnished', partially_furnished: 'Partly Furnished' }[v] || v),
  rentalType: v => ({ short_term: 'Short-term', long_term: 'Long-term', both: 'Any Type' }[v] || v),
  petFriendly: () => '🐾 Pet Friendly',
};

export default function FilterChips({ filters, setFilters }) {
  const chips = Object.entries(filters).filter(([, v]) => v !== undefined && v !== '' && v !== false);
  if (!chips.length) return null;

  const remove = (key) => setFilters(prev => { const n = { ...prev }; delete n[key]; return n; });

  return (
    <div className="flex gap-2 flex-wrap">
      {chips.map(([key, value]) => (
        <button
          key={key}
          onClick={() => remove(key)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
        >
          {CHIP_LABELS[key]?.(value) ?? String(value)}
          <X className="w-3.5 h-3.5" />
        </button>
      ))}
      <button
        onClick={() => setFilters({})}
        className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors px-1"
      >
        Clear all
      </button>
    </div>
  );
}