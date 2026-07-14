import React from 'react';
import { X, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CompareBar({ count, max, onCompare, onClear }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-foreground text-background px-4 py-3 flex items-center justify-between gap-4 shadow-lg">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">{count}</span>
        {count === 1 ? 'listing selected' : 'listings selected'}
        <span className="text-background/50 text-xs hidden sm:inline">· select up to {max}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-background/70 hover:text-background hover:bg-white/10 gap-1"
          onClick={onClear}
        >
          <X className="w-3.5 h-3.5" /> Clear
        </Button>
        <Button
          size="sm"
          disabled={count < 2}
          onClick={onCompare}
          className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <ArrowLeftRight className="w-4 h-4" /> Compare {count > 1 ? `(${count})` : ''}
        </Button>
      </div>
    </div>
  );
}