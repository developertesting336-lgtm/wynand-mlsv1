import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StarRating({ value = 0, onChange, size = 'md', readonly = false }) {
  const sizes = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-6 h-6' };
  const cls = sizes[size] || sizes.md;

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={cn('transition-colors', !readonly && 'hover:scale-110 cursor-pointer', readonly && 'cursor-default')}
          aria-label={`${star} star`}
        >
          <Star
            className={cn(cls, star <= value ? 'fill-yellow-400 text-yellow-400' : 'fill-transparent text-muted-foreground/40')}
          />
        </button>
      ))}
    </div>
  );
}