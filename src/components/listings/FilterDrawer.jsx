import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SlidersHorizontal } from 'lucide-react';
import { NEIGHBORHOODS, FURNISHED_OPTIONS, RENTAL_TYPES } from '@/lib/constants';

export default function FilterDrawer({ filters, setFilters }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(filters);

  const update = (key, value) => setLocal(prev => ({ ...prev, [key]: value }));

  const activeCount = Object.values(filters).filter(v => v !== undefined && v !== '' && v !== false).length;

  const apply = () => {
    setFilters(local);
    setOpen(false);
  };

  const clear = () => {
    setLocal({});
    setFilters({});
    setOpen(false);
  };

  const handleOpen = () => {
    setLocal(filters);
    setOpen(true);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-card text-sm font-medium hover:bg-muted transition-colors"
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filters
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
            {activeCount}
          </span>
        )}
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="border-b pb-4">
            <DrawerTitle className="text-lg font-bold">Filter Rentals</DrawerTitle>
          </DrawerHeader>

          <div className="overflow-y-auto px-4 py-5 space-y-6">
            {/* Neighborhood */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Neighborhood</Label>
              <Select value={local.neighborhood || 'all'} onValueChange={v => update('neighborhood', v === 'all' ? undefined : v)}>
                <SelectTrigger className="h-12 text-base"><SelectValue placeholder="All Neighborhoods" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Neighborhoods</SelectItem>
                  {NEIGHBORHOODS.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Monthly Budget (USD)</Label>
              <div className="flex gap-3">
                <Input
                  type="number"
                  placeholder="Min"
                  value={local.minPrice || ''}
                  onChange={e => update('minPrice', e.target.value ? Number(e.target.value) : undefined)}
                  className="h-12 text-base"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={local.maxPrice || ''}
                  onChange={e => update('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
                  className="h-12 text-base"
                />
              </div>
              {/* Quick budget pills */}
              <div className="flex gap-2 flex-wrap pt-1">
                {[1000, 1500, 2000, 3000].map(p => (
                  <button
                    key={p}
                    onClick={() => update('maxPrice', local.maxPrice === p ? undefined : p)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${local.maxPrice === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary hover:text-primary'}`}
                  >
                    Under ${p.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Bedrooms */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Bedrooms</Label>
              <div className="flex gap-2">
                {['Any', '1+', '2+', '3+', '4+'].map((label, i) => {
                  const val = i === 0 ? undefined : i;
                  const active = (local.bedrooms ?? undefined) === val;
                  return (
                    <button
                      key={label}
                      onClick={() => update('bedrooms', val)}
                      className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bathrooms */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Bathrooms</Label>
              <div className="flex gap-2">
                {['Any', '1+', '2+', '3+'].map((label, i) => {
                  const val = i === 0 ? undefined : i;
                  const active = (local.bathrooms ?? undefined) === val;
                  return (
                    <button
                      key={label}
                      onClick={() => update('bathrooms', val)}
                      className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Furnished */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Furnished</Label>
              <div className="flex gap-2 flex-wrap">
                {[{ value: undefined, label: 'Any' }, ...FURNISHED_OPTIONS].map(o => {
                  const active = local.furnished === o.value;
                  return (
                    <button
                      key={String(o.value)}
                      onClick={() => update('furnished', o.value)}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary'}`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rental Type */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Rental Type</Label>
              <div className="flex gap-2">
                {[{ value: undefined, label: 'Any' }, ...RENTAL_TYPES].map(r => {
                  const active = local.rentalType === r.value;
                  return (
                    <button
                      key={String(r.value)}
                      onClick={() => update('rentalType', r.value)}
                      className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary'}`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pet Friendly */}
            <div className="flex items-center justify-between py-3 border rounded-xl px-4">
              <div>
                <p className="font-semibold text-sm">Pet Friendly</p>
                <p className="text-xs text-muted-foreground">Show only pet-friendly properties</p>
              </div>
              <Switch checked={local.petFriendly || false} onCheckedChange={v => update('petFriendly', v || undefined)} />
            </div>
          </div>

          <DrawerFooter className="border-t pt-4 gap-3">
            <Button onClick={apply} size="lg" className="text-base">Show Results</Button>
            <Button onClick={clear} variant="outline" size="lg" className="text-base">Clear All</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}