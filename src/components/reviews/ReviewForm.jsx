import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, Loader2 } from 'lucide-react';
import StarRating from './StarRating';
import { toast } from 'sonner';

export default function ReviewForm({ listing, user, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: () =>
      base44.entities.PropertyReview.create({
        listing_id: listing.id,
        listing_title: listing.title,
        reviewer_id: user.id,
        rating,
        comment,
        verified_tenant: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', listing.id] });
      queryClient.invalidateQueries({ queryKey: ['all-reviews'] });
      toast.success('Review submitted!');
      setDone(true);
      onDone?.();
    },
  });

  if (done) {
    return (
      <div className="text-center py-6">
        <CheckCircle className="w-10 h-10 text-accent mx-auto mb-2" />
        <p className="font-semibold">Thanks for your review!</p>
        <p className="text-sm text-muted-foreground mt-1">Your feedback helps other tenants.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) { toast.error('Please select a star rating'); return; }
        submitMutation.mutate();
      }}
      className="space-y-4"
    >
      <div>
        <Label className="text-sm font-medium mb-2 block">Your Rating *</Label>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>
      <div>
        <Label className="text-sm font-medium mb-1 block">Comment (optional)</Label>
        <Textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="How was your stay? Describe the property, owner responsiveness, accuracy of the listing..."
          rows={3}
        />
      </div>
      <Button type="submit" className="w-full gap-2" disabled={submitMutation.isPending || !rating}>
        {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Submit Review
      </Button>
    </form>
  );
}