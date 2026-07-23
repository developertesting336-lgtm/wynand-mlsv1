import React, { useState, useEffect, useRef } from 'react';

function getVideoEmbedUrl(url) {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  ShieldCheck, Bed, Bath, MapPin,
  ArrowLeft, ChevronLeft, ChevronRight, Dog, Sofa, Clock,
  Phone, Video, ExternalLink, Eye, Calendar, DollarSign, Star, Users, CheckCircle, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { NEIGHBORHOOD_LABELS, FURNISHED_OPTIONS, RENTAL_TYPES } from '@/lib/constants';
import InquiryForm from '../components/listings/InquiryForm';
import MobileCtaBar from '../components/listings/MobileCtaBar';
import ContactAgentForm from '../components/listings/ContactAgentForm';
import AvailabilityCalendar from '../components/listings/AvailabilityCalendar';
import RentCalculator from '../components/listings/RentCalculator';
import ReviewsSection from '../components/reviews/ReviewsSection';
import { ReviewAverageInline } from '../components/reviews/ReviewsSection';
import NeighborhoodAmenities from '../components/listings/NeighborhoodAmenities';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ListingDetail() {
  const listingId = window.location.pathname.split('/').pop();
  const refCode = new URLSearchParams(window.location.search).get('ref') || '';
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const touchStartX = useRef(null);
  
  // Use global auth context
  const { user, login, authChecked } = useAuth();

  // Disable scroll when user is not authenticated
  useEffect(() => {
    if (authChecked && !user) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [authChecked, user]);

  const { data: listing, isLoading } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: async () => {
      const items = await base44.entities.Listing.filter({ id: listingId });
      return items[0];
    },
  });

  // Fetch the listing owner's profile to determine role
  const { data: ownerProfile } = useQuery({
    queryKey: ['listing-owner-role', listing?.owner_email],
    queryFn: () =>
      listing?.owner_email
        ? base44.entities.User.filter({ email: listing.owner_email }).then(users => users[0] || null)
        : null,
    enabled: !!listing?.owner_email,
  });

  // Fetch the listing agent's profile if agent_email is provided
  const { data: agentProfile } = useQuery({
    queryKey: ['listing-agent-profile', listing?.agent_email],
    queryFn: () =>
      listing?.agent_email
        ? base44.entities.User.filter({ email: listing.agent_email }).then(users => users[0] || null)
        : null,
    enabled: !!listing?.agent_email,
  });

  const ownerRole = ownerProfile?.role || 'owner';
  // An agent is assigned if the listing has distinct agent fields
  const hasAssignedAgent = !!(listing?.agent_email || listing?.agent_name || listing?.agent_phone);
  const isAgent = ownerRole === 'agent';
  const contactLabel = isAgent ? 'Agent' : 'Owner';

  const { data: userBookings = [] } = useQuery({
    queryKey: ['user-bookings-detail', user?.id, listingId],
    queryFn: () => user?.id ? base44.entities.Booking.filter({ renter_id: user.id, listing_id: listingId }, '-created_date', 100) : Promise.resolve([]),
    enabled: !!user?.id && !!listingId,
  });

  // Load tenant verification status (identity & employment)
  const { data: tenantVerification = {} } = useQuery({
    queryKey: ['tenant-verification', user?.id],
    queryFn: () =>
      user?.id
        ? base44.entities.TenantVerification.filter({ user_id: user.id })
            .then(v => v[0] || {})
        : Promise.resolve({}),
    enabled: !!user?.id,
  });

  const hasBookingRequest = userBookings.length > 0;
  const bookingStatus = userBookings[0]?.status;

  const identityStatus = tenantVerification.id_verification || 'new';
  const employmentStatus = tenantVerification.employment_verification || 'new';
  const canBook = identityStatus === 'approved' && employmentStatus === 'approved';

  useEffect(() => {
    if (listing) {
      base44.entities.Listing.update(listing.id, { views: (listing.views || 0) + 1 }).catch(() => {});
    }
  }, [listing?.id]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Skeleton className="h-6 w-36 mb-4" />
        <Skeleton className="aspect-[16/9] w-full rounded-2xl mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-xl text-muted-foreground">Listing not found</p>
        <Link to="/listings">
          <Button variant="outline" className="mt-4 gap-2"><ArrowLeft className="w-4 h-4" /> Back to Listings</Button>
        </Link>
      </div>
    );
  }

  const photos = listing.photos?.length
    ? listing.photos
    : ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80'];
  const furnishedLabel = FURNISHED_OPTIONS.find(o => o.value === listing.furnished)?.label;
  const rentalLabel = RENTAL_TYPES.find(r => r.value === listing.rental_type)?.label;

  const prevPhoto = () => setCurrentPhoto(i => i === 0 ? photos.length - 1 : i - 1);
  const nextPhoto = () => setCurrentPhoto(i => i === photos.length - 1 ? 0 : i + 1);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? nextPhoto() : prevPhoto();
    touchStartX.current = null;
  };

  const features = [
    { icon: Bed, label: `${listing.bedrooms} Bedroom${listing.bedrooms !== 1 ? 's' : ''}` },
    { icon: Bath, label: `${listing.bathrooms} Bathroom${listing.bathrooms !== 1 ? 's' : ''}` },
    furnishedLabel && { icon: Sofa, label: furnishedLabel },
    listing.pet_friendly && { icon: Dog, label: 'Pet Friendly' },
    rentalLabel && { icon: Clock, label: rentalLabel },
  ].filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-28 lg:pb-8">
      {/* Back */}
      <Link
        to="/listings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Listings
      </Link>

      {/* Photo Gallery — swipeable on mobile */}
      <div
        className="relative rounded-2xl overflow-hidden bg-muted mb-6"
        style={{ aspectRatio: '16/9' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={photos[currentPhoto]}
          alt={listing.title}
          className="w-full h-full object-cover"
          draggable={false}
        />

        {/* Gradient overlay bottom */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

        {/* Nav arrows — larger touch targets */}
        {photos.length > 1 && (
          <>
            <button onClick={prevPhoto} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2.5 shadow-lg transition-colors active:scale-95" aria-label="Previous photo">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextPhoto} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2.5 shadow-lg transition-colors active:scale-95" aria-label="Next photo">
              <ChevronRight className="w-5 h-5" />
            </button>
            {/* Dot indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPhoto(i)}
                  className={`h-1.5 rounded-full transition-all ${i === currentPhoto ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Top badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {listing.is_verified && (
            <Badge className="bg-accent text-accent-foreground gap-1 shadow text-sm">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified
            </Badge>
          )}
          {listing.is_featured && (
            <Badge className="bg-yellow-400 text-yellow-900 gap-1 shadow text-sm">
              <Star className="w-3.5 h-3.5" /> Featured
            </Badge>
          )}
        </div>

        {/* Photo count */}
        {photos.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            {currentPhoto + 1} / {photos.length}
          </div>
        )}
      </div>

      {/* Thumbnail strip on desktop */}
      {photos.length > 1 && (
        <div className="hidden md:flex gap-2 mb-6 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button
              key={i}
              onClick={() => setCurrentPhoto(i)}
              className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${i === currentPhoto ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">

          {/* Title & price block */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">{listing.title}</h1>
              <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground text-sm">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>{NEIGHBORHOOD_LABELS[listing.neighborhood] || listing.neighborhood}</span>
                {listing.address && <span className="hidden sm:inline">· {listing.address}</span>}
              </div>
              <div className="mt-2">
                <NeighborhoodAmenities
                  neighborhood={listing.neighborhood}
                  neighborhoodLabel={NEIGHBORHOOD_LABELS[listing.neighborhood] || listing.neighborhood}
                />
              </div>
              <ReviewAverageInline listingId={listing.id} />
            </div>
            <div className="shrink-0">
              <div className="text-2xl md:text-3xl font-bold text-foreground">
                MXN ${listing.price_mxn?.toLocaleString() || listing.price_usd?.toLocaleString()}
                <span className="text-base font-normal text-muted-foreground">/mo</span>
              </div>
              {/* {listing.price_mxn && listing.price_usd && (
                <p className="text-xs text-muted-foreground text-right">USD ${listing.price_usd?.toLocaleString()}</p>
              )} */}
            </div>
          </div>

          {/* Feature chips */}
          <div className="flex flex-wrap gap-2">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-sm font-medium">
                <Icon className="w-4 h-4 text-muted-foreground" />
                {label}
              </div>
            ))}
          </div>

          {/* Booking status banner */}
          {hasBookingRequest && bookingStatus !== 'declined' && (
            <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
              bookingStatus === 'approved' 
                ? 'bg-green-50 border-green-200' 
                : bookingStatus === 'pending'
                ? 'bg-amber-50 border-amber-200'
                : bookingStatus === 'declined'
                ? 'bg-red-50 border-red-200'
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                bookingStatus === 'approved' ? 'bg-green-600' 
                : bookingStatus === 'pending' ? 'bg-amber-600'
                : bookingStatus === 'declined' ? 'bg-red-600'
                : 'bg-blue-600'
              }`} />
              <div className={`text-sm ${
                bookingStatus === 'approved' ? 'text-green-800' 
                : bookingStatus === 'pending' ? 'text-amber-800'
                : bookingStatus === 'declined' ? 'text-red-800'
                : 'text-blue-800'
              }`}>
                <p className="font-semibold">
                  {bookingStatus === 'approved' && '✓ Your booking has been approved!'}
                  {bookingStatus === 'pending' && '⏳ Booking request pending approval'}
                  {bookingStatus === 'confirmed' && '✓ Your booking is confirmed & paid'}
                  {bookingStatus === 'declined' && `✗ Your booking request was declined on ${
                    userBookings[0]?.updated_date 
                      ? format(new Date(userBookings[0].updated_date), 'MMMM d, yyyy') 
                      : 'a recent date'
                  }`}
                </p>
                {bookingStatus === 'approved' && <p className="text-xs mt-0.5">Head to your dashboard to complete payment.</p>}
                {bookingStatus === 'pending' && <p className="text-xs mt-0.5">The owner will review your request soon.</p>}
                {bookingStatus === 'declined' && (
                  <p className="text-xs mt-0.5">
                    You can submit a new booking request in the future by using the availability calendar or contacting the owner/agent.
                  </p>
                )}
              </div>
            </div>
          )}

          

            {/* Booking component when allowed */}
            {/* {canBook && (
              <div className="mt-4">
                <BookingForm listing={listing} user={user} refCode={refCode} />
              </div>
            )} */}

          {/* Referral banner */}
          {refCode && (
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 text-sm">
              <Users className="w-4 h-4 text-primary shrink-0" />
              <span>You were referred by an agent — your inquiry will be tracked to them.</span>
            </div>
          )}

          {/* Verification trust bar */}
          {listing.is_verified ? (
            <div className="flex items-center gap-3 bg-accent/10 border border-accent/20 rounded-xl px-4 py-3">
              <ShieldCheck className="w-5 h-5 text-accent shrink-0" />
              <div>
                <p className="text-sm font-semibold text-accent">Verified Property</p>
                {listing.last_verified_date && (
                  <p className="text-xs text-muted-foreground">
                    Confirmed on {format(new Date(listing.last_verified_date), 'MMM d, yyyy')} — listing is accurate and up to date
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {/* Views / urgency signal */}
          {listing.views > 10 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="w-4 h-4" />
              <span>{listing.views} people have viewed this listing</span>
            </div>
          )}

          {/* Description */}
          {listing.description && (
            <div>
              <h2 className="font-semibold text-lg mb-2">About This Property</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{listing.description}</p>
            </div>
          )}

          {/* Details grid */}
          <div>
            <h2 className="font-semibold text-lg mb-3">Property Details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {listing.availability_date && (
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Available</p>
                  <p className="font-semibold mt-1 text-sm">{format(new Date(listing.availability_date), 'MMM d, yyyy')}</p>
                </div>
              )}
              {listing.deposit_amount && (
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> Deposit (one-time)</p>
                  <p className="font-semibold mt-1 text-sm">MXN ${listing.deposit_amount?.toLocaleString()}</p>
                </div>
              )}
              {listing.lease_terms && (
                <div className="rounded-xl border bg-card p-4 col-span-2 sm:col-span-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Lease</p>
                  <p className="font-semibold mt-1 text-sm">
                    {isNaN(listing.lease_terms) ? listing.lease_terms : `${listing.lease_terms} ${Number(listing.lease_terms) === 1 ? 'Month' : 'Months'}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Rent Calculator */}
          <RentCalculator baseRent={listing.price_mxn || listing.price_usd} />

          {/* Availability Calendar — main column (mobile/tablet; desktop sees sidebar version) */}
          {/* <div>
            <h2 className="font-semibold text-lg mb-3">Availability</h2>
          <AvailabilityCalendar listing={listing} currentUser={user} refCode={refCode} />
          </div> */}

          {/* Video Walkthrough */}
          {listing.video_url && (() => {
            const embedUrl = getVideoEmbedUrl(listing.video_url);
            const isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(listing.video_url);
            return (
              <div>
                <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Video className="w-5 h-5 text-muted-foreground" /> Video Walkthrough
                </h2>
                {embedUrl ? (
                  <div className="rounded-2xl overflow-hidden border bg-black aspect-video shadow-md">
                    <iframe
                      src={embedUrl}
                      title="Property video tour"
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                  </div>
                ) : isDirectVideo ? (
                  <div className="rounded-2xl overflow-hidden border bg-black aspect-video shadow-md">
                    <video
                      src={listing.video_url}
                      controls
                      className="w-full h-full"
                      title="Property video tour"
                    />
                  </div>
                ) : (
                  <a href={listing.video_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="gap-2">
                      <Video className="w-4 h-4" /> Watch Video Tour
                      <ExternalLink className="w-3.5 h-3.5 ml-1 text-muted-foreground" />
                    </Button>
                  </a>
                )}
              </div>
            );
          })()}

          {/* Book Appointment Section */}
          {(!user || user?.role === 'renter') && (
            <BookAppointmentSection listing={listing} user={user} ownerProfile={ownerProfile} agentProfile={agentProfile} />
          )}

          {/* Reviews */}
          <ReviewsSection listingId={listing.id} />

          {/* Video & WhatsApp — desktop only (mobile has the CTA bar) */}
          <div className="flex flex-wrap gap-3">
            {/* {listing.whatsapp && (
              <a
                href={`https://wa.me/${listing.whatsapp.replace(/\D/g, '')}?text=Hi, I'm interested in ${encodeURIComponent(listing.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden lg:inline-flex"
              >
                <Button size="lg" className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                  <Phone className="w-4 h-4" /> Contact via WhatsApp
                </Button>
              </a>
            )} */}
          </div>
        </div>

        {/* Sidebar — desktop only */}
        <div className="hidden lg:block space-y-4">
          {/* Price summary */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="text-3xl font-bold">
              MXN ${listing.price_mxn?.toLocaleString() || listing.price_usd?.toLocaleString()}
              <span className="text-base font-normal text-muted-foreground">/mo</span>
            </div>
            {/* {listing.price_mxn && listing.price_usd && (
              <p className="text-sm text-muted-foreground">≈ USD ${listing.price_usd?.toLocaleString()}</p>
            )} */}
            {listing.deposit_amount && (
              <div>
                <p className="text-sm text-muted-foreground mt-1">Deposit (one-time): MXN ${listing.deposit_amount?.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1 p-2 bg-blue-50 rounded border border-blue-200">
                  ℹ️ On first booking, you'll pay: Deposit (one-time) + First Month Rent + Last Month Rent (Total: MXN ${(Number(listing.deposit_amount || 0) + (Number(listing.price_mxn || listing.price_usd || 0) * 2))?.toLocaleString()})
                </p>
              </div>
            )}
            {listing.availability_date && (
              <div className="flex items-center gap-1.5 text-sm text-accent mt-3 font-medium">
                <Calendar className="w-4 h-4" />
                Available {format(new Date(listing.availability_date), 'MMM d, yyyy')}
              </div>
            )}
          </div>

          {/* <RentCalculator baseRent={listing.price_usd} /> */}
          {/* Hide inquiry form and calendar for owners */}
          {user?.role !== 'owner' && (
            <>
              <AvailabilityCalendar listing={listing} currentUser={user} refCode={refCode} />
              {hasAssignedAgent ? (
                <ContactAgentForm listing={listing} ownerRole={ownerRole} refCode={refCode} />
              ) : (
                <InquiryForm listing={listing} ownerRole={ownerRole} refCode={refCode} />
              )}
            </>
          )}

          {/* {listing.whatsapp && (
            <a
              href={`https://wa.me/${listing.whatsapp.replace(/\D/g, '')}?text=Hi, I'm interested in ${encodeURIComponent(listing.title)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white mt-1">
                <Phone className="w-4 h-4" /> Contact via WhatsApp
              </Button>
            </a>
          )} */}
        </div>
      </div>

      {/* Mobile fixed CTA bar */}
      {canBook && (
        <MobileCtaBar listing={listing} ownerRole={ownerRole} refCode={refCode} userRole={user?.role} />
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
              You need to sign in to view listing details and contact agents.
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

function BookAppointmentSection({ listing, user, ownerProfile, agentProfile }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fetch user's existing appointments for this listing
  const { data: myAppointments = [], refetch } = useQuery({
    queryKey: ['my-appointments', user?.id, listing?.id],
    queryFn: async () => {
      if (!user?.id || !listing?.id) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('renter_id', user.id)
        .eq('listing_id', listing.id)
        .order('created_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!listing?.id,
  });

  const hasPendingAppointment = myAppointments.some(app => !app.owner_accepted);

  const handleBook = (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be signed in to book an appointment');
      return;
    }
    if (!selectedDate) {
      toast.error('Please select a date and time');
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmBook = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('appointments').insert({
        listing_id: listing.id,
        renter_id: user.id,
        owner_id: ownerProfile?.id || null,
        agent_id: agentProfile?.id || null,
        appointment_date: new Date(selectedDate).toISOString(),
      });

      if (error) throw error;

      toast.success('Appointment request submitted successfully!');
      setSelectedDate('');
      refetch();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to request appointment');
    } finally {
      setLoading(false);
      setShowConfirmModal(false);
    }
  };

  return (
    <div className="border rounded-2xl p-6 bg-card shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Calendar className="w-5 h-5" />
        <h3 className="font-bold text-lg text-slate-800">Book an Appointment</h3>
      </div>
      <p className="text-sm text-slate-500">
        Request a date and time to view this property. The owner or agent will review your request and confirm or suggest alternative slots.
      </p>

      {myAppointments.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Your Appointment Requests</h4>
          <div className="divide-y divide-slate-200">
            {myAppointments.map(app => (
              <div key={app.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {format(new Date(app.appointment_date), 'MMMM d, yyyy · h:mm a')}
                  </p>
                  <p className="text-xs text-slate-400">
                    Requested on {format(new Date(app.created_date), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  {app.owner_accepted ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Confirmed
                    </span>
                  ) : app.agent_scheduled_slots?.length > 0 ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                      Slots Suggested
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                      Pending Approval
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {user?.role === 'owner' ? (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 p-3 rounded-lg font-medium">
          ℹ️ You are the owner of this property. Renter requests will appear on your dashboard.
        </p>
      ) : (
        <form onSubmit={handleBook} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Select Preferred Date & Time</label>
            <input
              type="datetime-local"
              required
              disabled={hasPendingAppointment}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 transition-shadow focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <Button
            type="submit"
            disabled={loading || hasPendingAppointment}
            className="w-full bg-primary text-primary-foreground font-semibold h-11 rounded-xl flex items-center justify-center gap-2"
          >
            {loading ? 'Submitting...' : 'Request Appointment'}
          </Button>

          {hasPendingAppointment && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 p-2.5 rounded-lg font-medium text-center">
              ⚠️ You already have a pending viewing request for this property. You can request another once it is confirmed or updated by the host.
            </p>
          )}
        </form>
      )}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold">
              <AlertCircle className="w-5 h-5" /> Confirm Appointment Request
            </DialogTitle>
            <DialogDescription className="pt-2 text-slate-600 leading-relaxed text-sm">
              🛡️ <strong>Protected Lead Policy:</strong> Any tenant introduced through PV Verified Rentals is deemed a Protected Lead. If the owner enters into a lease with that tenant, or any person introduced by that tenant, during the protection period, the agreed commission and platform fee remain payable, regardless of whether the lease is completed through the platform or directly.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmBook}
              disabled={loading}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {loading ? 'Confirming...' : 'Confirm Appointment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}