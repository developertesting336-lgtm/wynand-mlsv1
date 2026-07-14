import React from 'react';
import { X, ExternalLink, ShieldCheck, Star, Check, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NEIGHBORHOOD_LABELS } from '@/lib/constants';

const ROWS = [
  { label: 'Price / mo', render: l => `$${l.price_usd?.toLocaleString()} USD` },
  { label: 'Neighborhood', render: l => NEIGHBORHOOD_LABELS[l.neighborhood] || l.neighborhood },
  { label: 'Bedrooms', render: l => l.bedrooms },
  { label: 'Bathrooms', render: l => l.bathrooms },
  { label: 'Furnished', render: l => ({ furnished: 'Furnished', unfurnished: 'Unfurnished', partially_furnished: 'Partial' }[l.furnished] || '—') },
  { label: 'Rental Type', render: l => ({ short_term: 'Short-term', long_term: 'Long-term', both: 'Both' }[l.rental_type] || '—') },
  { label: 'Pet Friendly', render: l => l.pet_friendly ? <Check className="w-4 h-4 text-green-500" /> : <Minus className="w-4 h-4 text-muted-foreground" /> },
  { label: 'Verified', render: l => l.is_verified ? <Check className="w-4 h-4 text-green-500" /> : <Minus className="w-4 h-4 text-muted-foreground" /> },
  { label: 'Deposit', render: l => l.deposit_amount ? `$${l.deposit_amount.toLocaleString()}` : '—' },
  { label: 'Available', render: l => l.availability_date ? new Date(l.availability_date).toLocaleDateString() : '—' },
];

export default function CompareDrawer({ listings, onRemove, onClose }) {
  if (!listings.length) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between gap-4 shadow-sm">
        <h2 className="text-lg font-bold">Compare Listings</h2>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
      </div>

      <div className="overflow-x-auto flex-1 p-4">
        <table className="w-full border-separate border-spacing-0 min-w-[600px]">
          {/* Listing header row */}
          <thead>
            <tr>
              <th className="w-32 min-w-[8rem] sticky left-0 bg-background z-10 text-left text-sm font-semibold text-muted-foreground p-3 border-b" />
              {listings.map(l => (
                <th key={l.id} className="p-3 border-b text-left align-top min-w-[180px]">
                  <div className="relative">
                    <button
                      onClick={() => onRemove(l.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-muted hover:bg-destructive hover:text-white flex items-center justify-center transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <img
                      src={l.photos?.[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&q=70'}
                      alt={l.title}
                      className="w-full aspect-[4/3] object-cover rounded-lg mb-2"
                    />
                    <p className="font-semibold text-sm leading-snug line-clamp-2 pr-4">{l.title}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {l.is_verified && <Badge className="bg-accent text-accent-foreground text-xs gap-1 px-1.5"><ShieldCheck className="w-3 h-3" /> Verified</Badge>}
                      {l.is_featured && <Badge className="bg-yellow-400 text-yellow-900 text-xs gap-1 px-1.5"><Star className="w-3 h-3" /> Featured</Badge>}
                    </div>
                    <Link to={`/listings/${l.id}`} onClick={onClose}>
                      <Button size="sm" variant="outline" className="mt-2 w-full gap-1 text-xs">
                        View <ExternalLink className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Data rows */}
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={row.label} className={i % 2 === 0 ? 'bg-muted/30' : ''}>
                <td className="sticky left-0 z-10 p-3 text-sm font-medium text-muted-foreground whitespace-nowrap bg-inherit">
                  {row.label}
                </td>
                {listings.map(l => (
                  <td key={l.id} className="p-3 text-sm font-medium">
                    {row.render(l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}