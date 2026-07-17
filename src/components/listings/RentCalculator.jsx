import React, { useState } from 'react';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const UTILITIES = [
  { key: 'electricity', label: 'Electricity', placeholder: '50', default: '' },
  { key: 'water',       label: 'Water / Gas',  placeholder: '30', default: '' },
  { key: 'internet',    label: 'Internet',      placeholder: '40', default: '' },
  { key: 'hoa',         label: 'HOA / Maintenance', placeholder: '0', default: '' },
  { key: 'other',       label: 'Other',         placeholder: '0', default: '' },
];

export default function RentCalculator({ baseRent = 0 }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(
    Object.fromEntries(UTILITIES.map(u => [u.key, u.default]))
  );

  const utilsTotal = UTILITIES.reduce((sum, u) => sum + (parseFloat(values[u.key]) || 0), 0);
  const total = (parseFloat(baseRent) || 0) + utilsTotal;

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors"
      >
        <span className="font-semibold flex items-center gap-2 text-sm">
          <Calculator className="w-4 h-4 text-primary" />
          Total Cost
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t">
          {/* Base rent (read-only) */}
          <div className="flex items-center justify-between py-3 border-b">
            <span className="text-sm font-medium">Base Rent</span>
            <span className="font-bold">MXN ${(parseFloat(baseRent) || 0).toLocaleString()}/mo</span>
          </div>

          {/* Utility inputs */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Estimated Utilities (MXN/mo)</p>
            {UTILITIES.map(u => (
              <div key={u.key} className="flex items-center gap-3">
                <Label className="text-sm w-36 shrink-0 text-muted-foreground">{u.label}</Label>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    value={values[u.key]}
                    onChange={e => setValues(v => ({ ...v, [u.key]: e.target.value }))}
                    placeholder={u.placeholder}
                    className="pl-7 h-8 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="rounded-xl bg-muted/60 p-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Rent</span>
              <span>MXN ${(parseFloat(baseRent) || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Utilities</span>
              <span>+MXN {utilsTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
              <span>Estimated Total</span>
              <span className="text-primary">MXN {total.toLocaleString()}/mo</span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Utility estimates are approximate. Actual costs vary by usage and season.
          </p>
        </div>
      )}
    </div>
  );
}