import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users } from 'lucide-react';
import AgentCard from '@/components/agents/AgentCard';
import ReviewModal from '@/components/agents/ReviewModal';
import { useAuth } from '@/lib/AuthContext';

export default function AgentDirectory() {
  const [search, setSearch] = useState('');
  const [reviewingAgent, setReviewingAgent] = useState(null);
  const queryClient = useQueryClient();
  
  // Get auth state
  const { user, login, authChecked } = useAuth();

  // Disable scroll when not authenticated
  useEffect(() => {
    if (authChecked && !user) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [authChecked, user]);

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['approved-listings'],
    queryFn: () => base44.entities.Listing.filter({ status: 'approved' }, '-created_date', 200),
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['agent-reviews'],
    queryFn: () => base44.entities.AgentReview.list(),
  });

  // Filter reviews for current user to check if they've already reviewed
  const userReviews = useMemo(() => {
    if (!user?.id) return [];
    return reviews.filter(r => r.reviewer_id === user.id);
  }, [reviews, user?.id]);

  // Only show users who have at least one listing OR are admins/agents, excluding current user
  const agents = useMemo(() => {
    const agentEmails = new Set(listings.map(l => l.owner_email).filter(Boolean));
    return users.filter(u => u.email !== user?.email && (agentEmails.has(u.email) || u.role === 'admin'));
  }, [users, listings, user?.email]);

  const filtered = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter(a =>
      a.full_name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q)
    );
  }, [agents, search]);

  const listingsByAgent = useMemo(() => {
    const map = {};
    listings.forEach(l => {
      if (!l.owner_email) return;
      if (!map[l.owner_email]) map[l.owner_email] = [];
      map[l.owner_email].push(l);
    });
    return map;
  }, [listings]);

  const reviewsByAgent = useMemo(() => {
    const map = {};
    reviews.forEach(r => {
      if (!map[r.agent_id]) map[r.agent_id] = [];
      map[r.agent_id].push(r);
    });
    return map;
  }, [reviews]);

  const isLoading = loadingUsers;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Agent Directory</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Browse verified rental agents in Puerto Vallarta — view their listings, ratings, and contact them directly.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search agents by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-11 text-base bg-card"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >✕</button>
        )}
      </div>

      {/* Count */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground mb-4">
          {filtered.length} agent{filtered.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-xl overflow-hidden border">
              <Skeleton className="h-36 w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">👤</div>
          <p className="text-xl font-semibold">No agents found</p>
          <p className="text-muted-foreground mt-2 text-sm">Try a different search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              listings={listingsByAgent[agent.email] || []}
              reviews={reviewsByAgent[agent.id] || []}
              onReview={setReviewingAgent}
            />
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewingAgent && (
        <ReviewModal
          agent={reviewingAgent}
          open={!!reviewingAgent}
          onClose={() => setReviewingAgent(null)}
          onSubmitted={() => queryClient.invalidateQueries({ queryKey: ['agent-reviews'] })}
          currentUser={user}
          existingReviews={reviewsByAgent[reviewingAgent.id] || []}
        />
      )}

      {/* Show login prompt if not authenticated */}
      {!authChecked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        </div>
      )}
      {authChecked && !user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Sign In Required</h2>
            <p className="text-muted-foreground mb-6">
              You need to sign in to view agents and their listings.
            </p>
            <button
              onClick={login}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Sign In / Sign Up
            </button>
          </div>
        </div>
      )}
    </div>
  );
}