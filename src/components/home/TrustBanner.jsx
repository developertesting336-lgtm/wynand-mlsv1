import React from 'react';
import { ShieldCheck, Video, Clock, MapPin } from 'lucide-react';

const features = [
  { icon: ShieldCheck, title: 'Verified Properties', desc: 'Every listing confirmed by our team' },
  { icon: Video, title: 'Video Walkthroughs', desc: 'See before you commit' },
  { icon: Clock, title: 'Real-Time Availability', desc: 'Updated within 48 hours' },
  { icon: MapPin, title: 'Local Expertise', desc: 'Deep Puerto Vallarta knowledge' },
];

export default function TrustBanner() {
  return (
    <section className="border-y bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}