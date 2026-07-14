import React, { useState } from 'react';
import { MapPin, Loader2, UtensilsCrossed, Heart, Building2, Coffee, ShoppingBag, GraduationCap, Dumbbell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const CATEGORY_ICONS = {
  'Places to Eat': UtensilsCrossed,
  'Hospitals & Clinics': Heart,
  'Doctors & Specialists': Heart,
  'Banks & ATMs': Building2,
  'Coffee Shops': Coffee,
  'Supermarkets & Shopping': ShoppingBag,
  'Schools & Education': GraduationCap,
  'Gyms & Fitness': Dumbbell,
};

export default function NeighborhoodAmenities({ neighborhood, neighborhoodLabel }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchAmenities = async () => {
    if (data) { setOpen(true); return; }
    setOpen(true);
    setLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `List notable local amenities in the ${neighborhoodLabel} neighborhood of Puerto Vallarta, Mexico.
Return a JSON object with these exact category keys, each containing an array of 4-6 place names (strings only, no extra info):
- "Places to Eat"
- "Hospitals & Clinics"
- "Doctors & Specialists"
- "Banks & ATMs"
- "Coffee Shops"
- "Supermarkets & Shopping"
- "Schools & Education"
- "Gyms & Fitness"
Focus on real, well-known local establishments. If a category has very few options in that neighborhood, list what exists (minimum 1).`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          'Places to Eat': { type: 'array', items: { type: 'string' } },
          'Hospitals & Clinics': { type: 'array', items: { type: 'string' } },
          'Doctors & Specialists': { type: 'array', items: { type: 'string' } },
          'Banks & ATMs': { type: 'array', items: { type: 'string' } },
          'Coffee Shops': { type: 'array', items: { type: 'string' } },
          'Supermarkets & Shopping': { type: 'array', items: { type: 'string' } },
          'Schools & Education': { type: 'array', items: { type: 'string' } },
          'Gyms & Fitness': { type: 'array', items: { type: 'string' } },
        },
      },
    });
    setData(result);
    setLoading(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={fetchAmenities}>
        <MapPin className="w-4 h-4" /> Nearby Amenities
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold">Nearby Amenities</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {neighborhoodLabel}, Puerto Vallarta
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm">Finding local amenities…</p>
                </div>
              ) : data ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {Object.entries(data).map(([category, places]) => {
                    if (!places?.length) return null;
                    const Icon = CATEGORY_ICONS[category] || MapPin;
                    return (
                      <div key={category} className="rounded-xl border bg-muted/40 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 rounded-lg bg-primary/10">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <h3 className="font-semibold text-sm">{category}</h3>
                        </div>
                        <ul className="space-y-1.5">
                          {places.map((place, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
                              {place}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <p className="text-center text-xs text-muted-foreground pb-4 px-6">
              Data sourced from public information and may not reflect current business status.
            </p>
          </div>
        </div>
      )}
    </>
  );
}