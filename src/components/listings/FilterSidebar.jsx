import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

const BEDROOM_OPTIONS = [
  { label: 'Any', val: undefined },
  { label: '1+', val: 1 },
  { label: '2+', val: 2 },
  { label: '3+', val: 3 },
  { label: '4+', val: 4 },
];

const BUDGET_PRESETS = [1000, 1500, 2000, 3000];

export default function FilterSidebar({ filters, setFilters }) {
  const update = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const activeCount = Object.values(filters).filter(v => v !== undefined && v !== '' && v !== false).length;

  return (
    <aside className="hidden lg:block w-64 shrink-0">
      <div className="sticky top-36 rounded-2xl border bg-card shadow-sm p-5 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base">Filters</h2>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground" onClick={() => setFilters({})}>
              Clear all ({activeCount})
            </Button>
          )}
        </div>

        {/* Bedrooms */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Bedrooms</Label>
          <div className="flex gap-1.5 flex-wrap">
            {BEDROOM_OPTIONS.map(({ label, val }) => {
              const active = (filters.bedrooms ?? undefined) === val;
              return (
                <button
                  key={label}
                  onClick={() => update('bedrooms', val)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary hover:text-primary'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Price Range */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Monthly Budget (USD)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={filters.minPrice || ''}
              onChange={e => update('minPrice', e.target.value ? Number(e.target.value) : undefined)}
              className="h-9 text-sm"
            />
            <Input
              type="number"
              placeholder="Max"
              value={filters.maxPrice || ''}
              onChange={e => update('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
              className="h-9 text-sm"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap pt-1">
            {BUDGET_PRESETS.map(p => (
              <button
                key={p}
                onClick={() => update('maxPrice', filters.maxPrice === p ? undefined : p)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${filters.maxPrice === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary hover:text-primary'}`}
              >
                Under ${p.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Pet Friendly */}
        <div className="flex items-center justify-between border rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Pet Friendly</p>
            <p className="text-xs text-muted-foreground">Pets allowed</p>
          </div>
          <Switch
            checked={filters.petFriendly || false}
            onCheckedChange={v => update('petFriendly', v || undefined)}
          />
        </div>
      </div>
    </aside>
  );
}