import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ShieldCheck } from 'lucide-react';
import { NEIGHBORHOODS } from '@/lib/constants';

const QUICK_BUDGETS = [
  { label: 'Under $1,000', value: 1000 },
  { label: '$1k – $2k', value: 2000 },
  { label: '$2k – $3k', value: 3000 },
  { label: '$3k+', value: 9999 },
];

export default function HeroSection() {
  const navigate = useNavigate();
  const [neighborhood, setNeighborhood] = useState('');
  const [maxPrice, setMaxPrice] = useState(null);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (neighborhood && neighborhood !== 'all') params.set('neighborhood', neighborhood);
    if (maxPrice && maxPrice < 9999) params.set('maxPrice', maxPrice);
    navigate(`/listings?${params.toString()}`);
  };

  return (
    <section className="relative overflow-hidden min-h-[85vh] md:min-h-[75vh] flex items-center">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&q=80"
          alt="Puerto Vallarta"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/75" />
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Trust badge */}
        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-medium mb-5 border border-white/20">
          <ShieldCheck className="w-4 h-4 text-accent" />
          Every listing personally verified
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-[1.1] tracking-tight max-w-2xl">
          Verified Rentals in<br />
          <span className="text-primary">Puerto Vallarta</span>
        </h1>
        <p className="text-lg text-white/75 mt-3 max-w-md">
          No scams. No outdated listings. Just verified homes.
        </p>

        {/* Search card */}
        <div className="mt-8 bg-white rounded-2xl shadow-2xl overflow-hidden max-w-2xl">
          {/* Inputs */}
          <div className="p-4 space-y-3 sm:space-y-0 sm:flex sm:gap-3">
            <Select value={neighborhood} onValueChange={setNeighborhood}>
              <SelectTrigger className="h-12 text-base sm:flex-1 bg-muted/50 border-0">
                <SelectValue placeholder="Any neighborhood" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Neighborhoods</SelectItem>
                {NEIGHBORHOODS.map(n => (
                  <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleSearch} size="lg" className="w-full sm:w-auto h-12 px-6 text-base gap-2 shrink-0">
              <Search className="w-4 h-4" />
              Search
            </Button>
          </div>

          {/* Quick budget pills */}
          <div className="border-t px-4 py-3 flex gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground self-center mr-1">Budget:</span>
            {QUICK_BUDGETS.map(b => (
              <button
                key={b.value}
                onClick={() => setMaxPrice(prev => prev === b.value ? null : b.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${maxPrice === b.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary hover:text-primary'}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          {['500+ verified listings', 'Updated daily', 'No fake listings'].map(s => (
            <div key={s} className="flex items-center gap-1.5 text-white/70 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              {s}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}