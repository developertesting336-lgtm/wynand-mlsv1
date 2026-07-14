import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Home, Mail, MessageSquare, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NEIGHBORHOOD_LABELS } from '@/lib/constants';

function StarRating({ rating, count }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
          />
        ))}
      </div>
      <span className="text-sm font-semibold">{rating > 0 ? rating.toFixed(1) : '—'}</span>
      {count > 0 && <span className="text-xs text-muted-foreground">({count} review{count !== 1 ? 's' : ''})</span>}
    </div>
  );
}

export default function AgentCard({ agent, listings, reviews, onReview }) {
  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  const recentListings = listings.slice(0, 3);
  const neighborhoods = [...new Set(listings.map(l => l.neighborhood).filter(Boolean))].slice(0, 3);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-0">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border-2 border-white shadow">
                <span className="text-xl font-bold text-primary">
                  {agent.full_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-base leading-tight">{agent.full_name}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge className="bg-accent/20 text-accent-foreground text-xs px-2 py-0 border-0 gap-1">
                    <ShieldCheck className="w-3 h-3" /> Verified Agent
                  </Badge>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold text-primary">{listings.length}</div>
              <div className="text-xs text-muted-foreground">listing{listings.length !== 1 ? 's' : ''}</div>
            </div>
          </div>

          <div className="mt-3">
            <StarRating rating={avgRating} count={reviews.length} />
          </div>

          {neighborhoods.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {neighborhoods.map(n => (
                <span key={n} className="text-xs bg-white/70 border px-2 py-0.5 rounded-full text-muted-foreground">
                  {NEIGHBORHOOD_LABELS[n] || n}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Recent Listings */}
        {recentListings.length > 0 && (
          <div className="px-5 py-3 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Listings</p>
            <div className="space-y-1.5">
              {recentListings.map(l => (
                <Link
                  key={l.id}
                  to={`/listings/${l.id}`}
                  className="flex items-center justify-between gap-2 group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Home className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate group-hover:text-primary transition-colors">
                      {l.title}
                    </span>
                  </div>
                  <span className="text-sm font-semibold shrink-0">${l.price_usd?.toLocaleString()}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-5 py-3 flex gap-2">
          <a
            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(agent.email)}&su=${encodeURIComponent('Inquiry about your listings')}&body=${encodeURIComponent('Hi, I am interested in your rental listings. Please let me know more details.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
              <Mail className="w-3.5 h-3.5" /> Email
            </Button>
          </a>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 text-xs"
            onClick={() => onReview(agent)}
          >
            <Star className="w-3.5 h-3.5" /> Rate Agent
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}