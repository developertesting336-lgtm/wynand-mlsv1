import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ReviewModal({ agent, open, onClose, onSubmitted, currentUser, existingReviews = [] }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check if current user has already reviewed this agent
  const hasAlreadyReviewed = existingReviews.some(
    review => review.agent_id === agent?.id && review.reviewer_id === currentUser?.id
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) { toast.error('Please select a star rating'); return; }
    if (hasAlreadyReviewed) { toast.error('You have already reviewed this agent'); return; }
    setSubmitting(true);
    await base44.entities.AgentReview.create({
      agent_id: agent.id,
      rating,
      reviewer_id: currentUser?.id || null,
      comment,
    });
    toast.success('Review submitted!');
    setSubmitting(false);
    setRating(0);
    setComment('');
    onSubmitted();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rate {agent?.full_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Star picker */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                type="button"
                key={s}
                onClick={() => setRating(s)}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
              >
                <Star
                  className={`w-8 h-8 transition-colors ${s <= (hovered || rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
                />
              </button>
            ))}
          </div>
          <div>
            <Label className="text-xs">Comments (optional)</Label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="Share your experience working with this agent…"
              value={comment}
              onChange={e => setComment(e.target.value)}
              disabled={hasAlreadyReviewed}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting || hasAlreadyReviewed}>
            {hasAlreadyReviewed ? 'Already Reviewed' : submitting ? 'Submitting…' : 'Submit Review'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}