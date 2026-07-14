import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Star } from 'lucide-react';
import { format } from 'date-fns';
import StarRating from './StarRating';

// Fetch reviews for a listing, joining profiles to get reviewer's name
async function fetchReviews(listingId) {
  const { data, error } = await supabase
    .from('property_reviews')
    .select(`
      id,
      listing_id,
      rating,
      comment,
      verified_tenant,
      created_date,
      reviewer_id,
      profiles:reviewer_id (
        full_name,
        email
      )
    `)
    .eq('listing_id', listingId)
    .order('created_date', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

function getReviewerName(review) {
  const name = review.profiles?.full_name;
  const email = review.profiles?.email;
  if (name) return name;
  if (email) return email.split('@')[0];
  return 'Tenant';
}

function AverageStars({ reviews }) {
  if (!reviews.length) return null;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return (
    <div className="flex items-center gap-2">
      <StarRating value={Math.round(avg)} readonly size="sm" />
      <span className="font-bold text-sm">{avg.toFixed(1)}</span>
      <span className="text-muted-foreground text-sm">({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
    </div>
  );
}

export function ReviewAverageInline({ listingId }) {
  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', listingId],
    queryFn: () => fetchReviews(listingId),
    enabled: !!listingId,
  });
  if (!reviews.length) return null;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return (
    <div className="flex items-center gap-1.5">
      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
      <span className="font-semibold text-sm">{avg.toFixed(1)}</span>
      <span className="text-muted-foreground text-xs">({reviews.length})</span>
    </div>
  );
}

export default function ReviewsSection({ listingId }) {
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews', listingId],
    queryFn: () => fetchReviews(listingId),
    enabled: !!listingId,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Tenant Reviews</h2>
        {!isLoading && <AverageStars reviews={reviews} />}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      )}

      {!isLoading && reviews.length === 0 && (
        <p className="text-muted-foreground text-sm py-4">No reviews yet. Verified tenants can leave a review from their dashboard.</p>
      )}

      {!isLoading && reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map(review => (
            <div key={review.id} className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{getReviewerName(review)}</span>
                    {review.verified_tenant && (
                      <Badge className="bg-accent/10 text-accent border-0 gap-1 text-xs py-0">
                        <ShieldCheck className="w-3 h-3" /> Verified Tenant
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(review.created_date), 'MMM d, yyyy')}
                  </p>
                </div>
                <StarRating value={review.rating} readonly size="sm" />
              </div>
              {review.comment && (
                <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}