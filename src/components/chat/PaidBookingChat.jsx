import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Send, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const isPaidBooking = (booking) => (
  booking?.status === 'confirmed' ||
  booking?.payment_status === 'paid' ||
  booking?.paid === true
);

const formatMessageDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const hour = date.getHours() % 12 || 12;
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const meridiem = date.getHours() >= 12 ? 'pm' : 'am';

  return `${day} ${month}, ${hour}:${minutes} ${meridiem}`;
};

export default function PaidBookingChat({ bookings = [], listings = [], currentUser }) {
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [participantProfiles, setParticipantProfiles] = useState({});
  const [participantPhotos, setParticipantPhotos] = useState({});
  const messagesEndRef = useRef(null);

  const listingMap = useMemo(() => Object.fromEntries(listings.map((listing) => [listing.id, listing])), [listings]);
  const paidBookings = useMemo(() => bookings.filter(isPaidBooking), [bookings]);
  const selectedBooking = paidBookings.find((booking) => booking.id === selectedBookingId) || paidBookings[0];
  const activeBookingId = selectedBooking?.id || '';

  useEffect(() => {
    const participantIds = [...new Set(paidBookings
      .map((booking) => currentUser?.role === 'owner' ? booking.renter_id : booking.owner_id)
      .filter(Boolean))];

    if (participantIds.length === 0) {
      setParticipantProfiles({});
      setParticipantPhotos({});
      return undefined;
    }

    let cancelled = false;
    Promise.all([
      supabase.from('profiles').select('id, full_name, email').in('id', participantIds),
      supabase.from('verifications').select('user_id, profile_photo').in('user_id', participantIds),
    ]).then(([profilesResult, verificationsResult]) => {
      if (cancelled) return;
      if (profilesResult.error) {
        toast.error(`Unable to load chat participants: ${profilesResult.error.message}`);
      } else {
        setParticipantProfiles(Object.fromEntries((profilesResult.data || []).map((profile) => [profile.id, profile])));
      }
      if (verificationsResult.error) {
        toast.error(`Unable to load profile photos: ${verificationsResult.error.message}`);
      } else {
        setParticipantPhotos(Object.fromEntries(
          (verificationsResult.data || [])
            .filter((verification) => verification.profile_photo)
            .map((verification) => [verification.user_id, verification.profile_photo])
        ));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.role, paidBookings]);

  useEffect(() => {
    if (activeBookingId && activeBookingId !== selectedBookingId) {
      setSelectedBookingId(activeBookingId);
    }
  }, [activeBookingId, selectedBookingId]);

  useEffect(() => {
    if (!activeBookingId) {
      setMessages([]);
      return undefined;
    }

    let cancelled = false;
    const loadMessages = async () => {
      setLoadingMessages(true);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('booking_id', activeBookingId)
        .order('created_at', { ascending: true });

      if (!cancelled) {
        if (error) {
          toast.error(`Unable to load messages: ${error.message}`);
        } else {
          setMessages(data || []);
        }
        setLoadingMessages(false);
      }
    };

    loadMessages();
    const channel = supabase
      .channel(`paid-booking-chat-${activeBookingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `booking_id=eq.${activeBookingId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((current) => current.some((message) => message.id === payload.new.id)
              ? current
              : [...current, payload.new]);
          } else if (payload.eventType === 'DELETE') {
            setMessages((current) => current.filter((message) => message.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setMessages((current) => current.map((message) => message.id === payload.new.id ? payload.new : message));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeBookingId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !activeBookingId || !currentUser?.id || sending) return;

    setSending(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        booking_id: activeBookingId,
        sender_id: currentUser.id,
        message,
      })
      .select()
      .single();

    if (error) {
      toast.error(`Unable to send message: ${error.message}`);
    } else {
      setDraft('');
      setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data]);
    }
    setSending(false);
  };

  if (paidBookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-20 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary shadow-sm ring-1 ring-slate-200">
          <MessageSquare className="h-6 w-6" />
        </div>
        <p className="font-semibold text-slate-900">Your messages will appear here</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Once a booking is confirmed, you can start a direct conversation about the property.</p>
      </div>
    );
  }

  const listing = listingMap[selectedBooking?.listing_id];
  const participantId = currentUser?.role === 'owner' ? selectedBooking?.renter_id : selectedBooking?.owner_id;
  const participantProfile = participantProfiles[participantId];
  const participantPhoto = participantPhotos[participantId];
  const otherPartyName = currentUser?.role === 'owner'
    ? (participantProfile?.full_name || selectedBooking?.renter_name || participantProfile?.email || 'Renter')
    : (participantProfile?.full_name || selectedBooking?.owner_name || participantProfile?.email || 'Owner');

  return (
    <div className="grid min-h-[560px] grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)] md:grid-cols-[280px_1fr]">
      <aside className="border-b bg-slate-50/80 p-4 md:border-b-0 md:border-r">
        <div className="mb-4 flex items-center justify-between px-1">
          <div>
            <p className="text-sm font-bold tracking-tight text-slate-900">Messages</p>
            <p className="mt-0.5 text-xs text-slate-500">Your property conversations</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-primary shadow-sm ring-1 ring-slate-200">
            <MessageSquare className="h-4 w-4" />
          </div>
        </div>
        <div className="space-y-2">
          {paidBookings.map((booking) => {
            const bookingListing = listingMap[booking.listing_id];
            const active = booking.id === activeBookingId;
            return (
              <button
                key={booking.id}
                type="button"
                onClick={() => setSelectedBookingId(booking.id)}
                className={`w-full rounded-2xl border p-3 text-left transition-all ${active ? 'border-primary/40 bg-white shadow-sm ring-1 ring-primary/10' : 'border-transparent bg-white/70 hover:border-slate-200 hover:bg-white'}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary ring-1 ring-primary/10">
                    {(() => {
                      const id = currentUser?.role === 'owner' ? booking.renter_id : booking.owner_id;
                      return participantPhotos[id]
                        ? <img src={participantPhotos[id]} alt="" className="h-full w-full object-cover" />
                        : <User className="h-4 w-4" />;
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {(() => {
                        const id = currentUser?.role === 'owner' ? booking.renter_id : booking.owner_id;
                        const profile = participantProfiles[id];
                        return currentUser?.role === 'owner'
                          ? (profile?.full_name || booking.renter_name || profile?.email || 'Renter')
                          : (profile?.full_name || booking.owner_name || profile?.email || 'Owner');
                      })()}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {bookingListing?.title || booking.listing_title || 'Property'}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
            {participantPhoto ? (
              <img src={participantPhoto} alt="" className="h-full w-full object-cover" />
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-slate-900">{otherPartyName}</p>
            <p className="truncate text-xs text-slate-500">
              {listing?.title || selectedBooking?.listing_title || 'Property'}
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.06),_transparent_38%),#f8fafc] p-5">
          {loadingMessages ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading messages</div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary shadow-sm ring-1 ring-slate-200">
                <MessageSquare className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Start the conversation</p>
              <p className="mt-1 text-xs text-slate-500">Send a message about this property.</p>
            </div>
          ) : messages.map((item) => {
            const mine = item.sender_id === currentUser?.id;
            return (
              <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'}`}>
                  <p className="whitespace-pre-wrap break-words">{item.message}</p>
                  <p className={`mt-1 text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {formatMessageDate(item.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-200 bg-white p-4">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Write a message..."
            rows={2}
            maxLength={4000}
            className="min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
          />
          <Button type="submit" size="icon" disabled={!draft.trim() || sending} aria-label="Send message" title="Send message">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </section>
    </div>
  );
}
