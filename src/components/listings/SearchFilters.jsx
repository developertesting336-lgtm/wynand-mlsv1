import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { NEIGHBORHOODS, RENTAL_TYPES, FURNISHED_OPTIONS } from '@/lib/constants';

export default function SearchFilters({ filters, setFilters, compact = false }) {
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasFilters = Object.values(filters).some(v => v !== undefined && v !== '' && v !== 'all');

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${compact ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
        <Select value={filters.neighborhood || 'all'} onValueChange={v => updateFilter('neighborhood', v === 'all' ? undefined : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Neighborhood" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Neighborhoods</SelectItem>
            {NEIGHBORHOODS.map(n => (
              <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min $"
            value={filters.minPrice || ''}
            onChange={e => updateFilter('minPrice', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full"
          />
          <Input
            type="number"
            placeholder="Max $"
            value={filters.maxPrice || ''}
            onChange={e => updateFilter('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full"
          />
        </div>

        <Select value={filters.bedrooms || 'all'} onValueChange={v => updateFilter('bedrooms', v === 'all' ? undefined : Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Bedrooms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Bedrooms</SelectItem>
            <SelectItem value="1">1+ Bedroom</SelectItem>
            <SelectItem value="2">2+ Bedrooms</SelectItem>
            <SelectItem value="3">3+ Bedrooms</SelectItem>
            <SelectItem value="4">4+ Bedrooms</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.bathrooms || 'all'} onValueChange={v => updateFilter('bathrooms', v === 'all' ? undefined : Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Bathrooms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Bathrooms</SelectItem>
            <SelectItem value="1">1+ Bath</SelectItem>
            <SelectItem value="2">2+ Baths</SelectItem>
            <SelectItem value="3">3+ Baths</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={`grid gap-3 ${compact ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
        <Select value={filters.furnished || 'all'} onValueChange={v => updateFilter('furnished', v === 'all' ? undefined : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Furnished" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Furnishing</SelectItem>
            {FURNISHED_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.rentalType || 'all'} onValueChange={v => updateFilter('rentalType', v === 'all' ? undefined : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Rental Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Type</SelectItem>
            {RENTAL_TYPES.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 px-3 h-10 rounded-md border">
          <Switch
            id="petFriendly"
            checked={filters.petFriendly || false}
            onCheckedChange={v => updateFilter('petFriendly', v || undefined)}
          />
          <Label htmlFor="petFriendly" className="text-sm cursor-pointer">Pet Friendly</Label>
        </div>

        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters} className="gap-2">
            <X className="w-4 h-4" /> Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}