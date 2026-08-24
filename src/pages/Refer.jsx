import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, DollarSign, Users, TrendingUp, Handshake, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

const INITIAL = {
  client_name: '', client_email: '', client_phone: '',
  referral_type: 'buyer', property_description: '', estimated_value_usd: '', notes: '',
};

export default function Refer() {
  const [form, setForm] = useState(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [agentListings, setAgentListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState('');
  const [propertySearchText, setPropertySearchText] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Debounced search text state with 600ms delay
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(propertySearchText);
      setVisibleCount(10); // Reset page count on debounced query change
    }, 600);
    return () => clearTimeout(handler);
  }, [propertySearchText]);

  // Get auth state
  const { user, login, authChecked } = useAuth();

  const [allListings, setAllListings] = useState([]);

  // Load appropriate listings for generating referral link based on user role
  useEffect(() => {
    if (user?.role && user?.email) {
      const loadReferralProperties = async () => {
        try {

          // Fetch all active/approved listings
          const listings = await base44.entities.Listing.filter({ status: 'approved' }, '-created_date', 500);


          // Fetch bookings to filter out those already on lease / booked
          let busyListingIds = new Set();
          try {
            const { data: activeBookings, error: bookingsError } = await supabase
              .from('bookings')
              .select('listing_id, status, end_lease')
              .in('status', ['approved', 'confirmed']);

            if (bookingsError) {
              console.warn('[DEBUG_REFER] RLS or database block fetching bookings:', bookingsError.message);
            } else if (activeBookings) {

              // Only consider the listing "busy" if it has an approved/confirmed booking AND the lease has NOT ended (end_lease is false or null)
              activeBookings
                .filter(b => b.end_lease !== true)
                .forEach(b => busyListingIds.add(b.listing_id));
            }
          } catch (err) {
            console.error('[DEBUG_REFER] Failed to fetch bookings status (RLS/Permissions):', err);
          }



          // Filter out booked/leased listings unless user is an agent (agents see all listings)
          let availableListings = listings;
          if (user.role !== 'agent') {
            availableListings = listings.filter(l => !busyListingIds.has(l.id));
          }

          setAgentListings(availableListings);

        } catch (err) {
          console.error('[DEBUG_REFER] Error loading referral listings:', err);
        }
      };

      loadReferralProperties();
    }
  }, [user?.email, user?.role]);

  // Disable scroll when not authenticated
  useEffect(() => {
    if (authChecked && !user) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [authChecked, user]);

  useEffect(() => {
    if (user) {
      setCurrentUser(user);
      // Auto-generate unique 10-digit code if profile lacks one
      if (user.id && !user.referral_code) {
        const getUniqueCode = async () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let uniqueCode = '';
          let isUnique = false;
          let attempts = 0;
          
          while (!isUnique && attempts < 10) {
            uniqueCode = '';
            for (let i = 0; i < 10; i++) {
              uniqueCode += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            const { data } = await supabase
              .from('profiles')
              .select('id')
              .eq('referral_code', uniqueCode)
              .maybeSingle();
              
            if (!data) {
              isUnique = true;
            }
            attempts++;
          }
          
          const updated = await base44.entities.User.update(user.id, { referral_code: uniqueCode });
          if (updated) setCurrentUser(updated);
        };
        
        getUniqueCode().catch(err => console.error('Failed to auto-generate unique referral code on refer page:', err));
      }
    }
  }, [user]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser?.stripe_onboarding_complete || !currentUser?.stripe_connect_id) {
      toast.error('Please connect Stripe first to receive payment');
      return;
    }
    if (!currentUser || !form.client_name) {
      toast.error('Please fill in all required fields');
      return;
    }
    setLoading(true);
    await base44.entities.SaleReferral.create({
      ...form,
      referrer_id: currentUser?.id,
      referral_type: form.referral_type,
      estimated_value_usd: form.estimated_value_usd ? Number(form.estimated_value_usd) : undefined,
      commission_pct: 15,
      status: 'pending',
    });

    // Notify admin
    base44.integrations.Core.SendEmail({
      to: 'admin@pvverifiedrentals.com',
      from_name: 'PV Verified Rentals',
      subject: `New Sale Referral: ${form.client_name} (${form.referral_type})`,
      body: `
<p>A new sale referral has been submitted.</p>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  <tr><td style="padding:6px 0;color:#666">Referrer ID</td><td style="font-weight:600">${currentUser?.id || 'N/A'}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Referrer</td><td style="font-weight:600">${currentUser?.full_name || 'N/A'} (${currentUser?.email || 'N/A'})</td></tr>
  <tr><td style="padding:6px 0;color:#666">Client</td><td>${form.client_name} · ${form.client_email || 'N/A'}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Type</td><td>${form.referral_type === 'buyer' ? 'Buyer' : 'Seller'}</td></tr>
  ${form.estimated_value_usd ? `<tr><td style="padding:6px 0;color:#666">Est. Value</td><td>${Number(form.estimated_value_usd).toLocaleString()}</td></tr>` : ''}
  ${form.property_description ? `<tr><td style="padding:6px 0;color:#666">Property</td><td>${form.property_description}</td></tr>` : ''}
</table>
<p>Please review in the Admin Dashboard.</p>
      `.trim(),
    }).catch(() => { });

    // Confirm to referrer
    base44.integrations.Core.SendEmail({
      to: currentUser?.email,
      from_name: 'PV Verified Rentals',
      subject: 'Your referral has been received!',
      body: `
<p>Hi ${currentUser?.full_name || 'there'},</p>
<p>Thank you for your referral! We've received your submission for <strong>${form.client_name}</strong> and our team will be in touch shortly.</p>
            <p>If the transaction closes successfully, you'll earn a <strong>15% referral fee</strong> on the commission.</p>
<p style="color:#888;font-size:12px;margin-top:24px">PV Verified Rentals · Puerto Vallarta</p>
      `.trim(),
    }).catch(() => { });

    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-10">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Referral Submitted!</h2>
            <p className="text-muted-foreground mb-2">
              We've received your referral for <strong>{form.client_name}</strong>.
            </p>
            <p className="text-muted-foreground mb-6">
              If the deal closes, you can earn upto <strong className="text-green-600">15% referral fee</strong> on our commission. We'll keep you updated every step of the way.
            </p>
            <Button onClick={() => { setForm(INITIAL); setSubmitted(false); }}>
              Submit Another Referral
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-14 text-center">
          <Badge className="mb-4 bg-primary/10 text-primary border-0 text-sm px-4 py-1">Referral Program</Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Earn a <span className="text-primary">15% Referral Fee</span>
          </h1>
          {currentUser?.role === 'agent' && (
            <p className="text-sm font-semibold text-primary mb-4">
              Agents will pay 10% fees on their commission + 16% IVA on that fees to Pvverified
            </p>
          )}
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Know someone buying or selling property in Puerto Vallarta? Refer them to us and earn 15% of our commission when the deal closes — open to agents and the public alike.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: Users, title: 'Refer a Client', desc: 'Fill out the form below with your contact details and your client\'s information.' },
            { icon: Handshake, title: 'We Do the Work', desc: 'Our team contacts your client and handles the entire buying or selling process.' },
            { icon: DollarSign, title: 'Earn 15%', desc: 'When the deal closes, you can receive 15% of our commission — automatically.' },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Unique referral links */}
        {currentUser && (
          (() => {
            const isAgent = currentUser.role === 'agent';
            const listingPath = selectedListing ? `/listings/${selectedListing}` : '/listings';
            const userCode = currentUser?.referral_code || currentUser?.id || '';
            const referralUrl = isAgent
              ? `${window.location.origin}${listingPath}?agent_ref=${userCode}`
              : `${window.location.origin}${listingPath}?ref=${userCode}`;

            const hasStripeConnected = currentUser?.stripe_connect_id && currentUser?.stripe_onboarding_complete;

            return (
              <Card className="mb-10 border-primary/20 bg-primary/5">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Your Referral Link</h3>
                  </div>

                  {!hasStripeConnected ? (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-semibold leading-relaxed">
                      ⚠️ You must connect your bank account first to generate and share your referral link.
                      Please go to your <Link
                        to={
                          currentUser.role === 'agent'
                            ? '/agent-dashboard'
                            : currentUser.role === 'owner'
                              ? '/owner-dashboard'
                              : '/dashboard'
                        }
                        className="underline text-red-900 hover:text-red-950 font-bold"
                      >
                        Dashboard
                      </Link> (payments / settings section) and complete the Stripe Connect integration.
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          Link to (optional — leave blank for all listings)
                        </label>

                        {/* Searchable Custom Dropdown Trigger */}
                        <button
                          type="button"
                          onClick={() => setDropdownOpen(!dropdownOpen)}
                          className="w-full h-10 px-3 border rounded-md bg-white text-left text-sm flex items-center justify-between shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <span>
                            {selectedListing
                              ? agentListings.find(l => l.id === selectedListing)?.title || 'Selected Listing'
                              : 'All Listings'}
                          </span>
                          <span className="text-muted-foreground text-xs font-semibold">▼</span>
                        </button>

                        {dropdownOpen && (
                          <div className="absolute left-0 right-0 mt-1 border border-input rounded-md bg-white p-2 shadow-lg z-20">
                            <input
                              type="text"
                              className="w-full h-8 px-2 text-xs border rounded mb-2 focus:outline-none focus:ring-1 focus:ring-primary"
                              placeholder="Type to search properties..."
                              value={propertySearchText}
                              onChange={e => setPropertySearchText(e.target.value)}
                            />
                            <div
                              className="max-h-60 overflow-y-auto space-y-1"
                              onScroll={e => {
                                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                                // Check if user scrolled to the bottom (within 10px threshold) and we are not already loading
                                if (!isLoadingMore && scrollHeight - scrollTop <= clientHeight + 10) {
                                  const query = debouncedSearch.toLowerCase().trim();
                                  const filtered = agentListings.filter(l =>
                                    l.title.toLowerCase().includes(query) ||
                                    (l.neighborhood && l.neighborhood.toLowerCase().includes(query))
                                  );
                                  if (filtered.length > visibleCount) {
                                    setIsLoadingMore(true);
                                    setTimeout(() => {
                                      setVisibleCount(prev => prev + 10);
                                      setIsLoadingMore(false);
                                    }, 500);
                                  }
                                }
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedListing('');
                                  setDropdownOpen(false);
                                }}
                                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${!selectedListing ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted'}`}
                              >
                                All Listings
                              </button>
                              {(() => {
                                const query = debouncedSearch.toLowerCase().trim();
                                const filtered = agentListings.filter(l =>
                                  l.title.toLowerCase().includes(query) ||
                                  (l.neighborhood && l.neighborhood.toLowerCase().includes(query))
                                );
                                const paginated = filtered.slice(0, visibleCount);

                                return (
                                  <>
                                    {paginated.map(l => (
                                      <button
                                        key={l.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedListing(l.id);
                                          setDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${selectedListing === l.id ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted'}`}
                                      >
                                        {l.title}
                                      </button>
                                    ))}
                                    {filtered.length === 0 && (
                                      <div className="text-center text-xs text-muted-foreground py-2">No matching properties found</div>
                                    )}
                                    {isLoadingMore && (
                                      <div className="flex items-center justify-center py-2 gap-1 text-xs text-muted-foreground">
                                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                        Loading...
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        Share this link. When clients open your link and register or request bookings, their referral is automatically tracked to your account.
                      </p>

                      <div className="flex gap-2">
                        <Input
                          value={referralUrl}
                          readOnly
                          className="bg-white"
                        />
                        <Button
                          onClick={() => {
                            navigator.clipboard.writeText(referralUrl);
                            toast.success('Referral link copied to clipboard!');
                          }}
                          variant="default"
                        >
                          Copy Link
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })()
        )}


        <Card>
          <CardHeader>
            <CardTitle>Submit a Referral</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              Your info
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Your Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Your Name</label>
                    <Input value={currentUser?.full_name || ''} disabled className="bg-muted" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Your Email</label>
                    <Input value={currentUser?.email || ''} disabled className="bg-muted" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Your WhatsApp / Phone</label>
                    <Input value={currentUser?.phone_number || ''} disabled className="bg-muted" />
                  </div>
                </div>
              </div>

              Client info
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Client Information</h3>

                Buyer / Seller toggle
                <div className="flex gap-2 mb-3">
                  {['buyer', 'seller'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('referral_type', t)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${form.referral_type === t
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-input hover:bg-muted'
                        }`}
                    >
                      {t === 'buyer' ? '🏠 Buyer' : '💰 Seller'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Client Name *</label>
                    <Input value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="John Doe" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Client Email</label>
                    <Input type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)} placeholder="john@example.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Client Phone / WhatsApp</label>
                    <Input value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="+52 322 ..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      {form.referral_type === 'buyer' ? 'Budget (USD)' : 'Estimated Value (USD)'}
                    </label>
                    <Input type="number" value={form.estimated_value_usd} onChange={e => set('estimated_value_usd', e.target.value)} placeholder="500000" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1 block">
                      {form.referral_type === 'buyer' ? 'Desired property details' : 'Property address / description'}
                    </label>
                    <Textarea value={form.property_description} onChange={e => set('property_description', e.target.value)} placeholder={form.referral_type === 'buyer' ? 'e.g. 3BR condo in Zona Romántica, ocean view preferred...' : 'e.g. 2BR condo at Amapas 300, PV...'} className="h-20" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Additional Notes</label>
                    <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Anything else we should know..." className="h-20" />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={loading} className="w-full h-12 text-base">
                  {loading ? 'Submitting...' : 'Submit Referral & Earn 15%'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

      </div>

      {/* Show login prompt if not authenticated */}
      {!authChecked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        </div>
      )}
      {authChecked && !user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-8 text-center border border-slate-100 relative">
            <Link
              to="/"
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </Link>
            <h2 className="text-2xl font-bold mb-2">Want to Refer Someone?</h2>
            <p className="text-muted-foreground mb-6">
              Create an account or sign in to get your unique referral links and start earning 15% commission.
            </p>
            <button
              onClick={login}
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              Create an account / Sign In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}