create table public.agent_referrals (
  id uuid not null,
  referral_code text not null,
  type text null default 'rental'::text,
  listing_id text null,
  listing_title text null,
  referred_name text null,
  referred_email text null,
  referred_phone text null,
  status text null default 'pending'::text,
  commission_pct numeric null default 10,
  commission_amount numeric null,
  notes text null,
  source text null default 'link'::text,
  created_date timestamp with time zone null default now(),
  agent_id uuid null,
  constraint agent_referrals_pkey primary key (id)
) TABLESPACE pg_default;








create table public.agent_reviews (
  id uuid not null,
  rating numeric not null,
  comment text null,
  created_date timestamp with time zone null default now(),
  agent_id uuid null,
  reviewer_id uuid null,
  constraint agent_reviews_pkey primary key (id),
  constraint unique_review_per_agent unique (reviewer_id, agent_id)
) TABLESPACE pg_default;






create table public.audit_logs (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  action text not null,
  entity_type text null,
  entity_id text null,
  created_at timestamp with time zone null default now(),
  constraint audit_logs_pkey primary key (id),
  constraint audit_logs_user_id_fkey foreign KEY (user_id) references profiles (id) on update CASCADE on delete set null
) TABLESPACE pg_default;





create table public.bookings (
  id uuid not null default gen_random_uuid (),
  move_in_date date not null,
  lease_duration_months integer null default 12,
  monthly_budget_mxn numeric null,
  message text null,
  status text null default 'pending'::text,
  created_date timestamp without time zone null default now(),
  updated_date timestamp without time zone null default now(),
  listing_id uuid null,
  renter_id uuid not null default gen_random_uuid (),
  owner_id uuid not null default gen_random_uuid (),
  agent_id uuid null,
  referral_code text null,
  lease_status text null default 'pending'::text,
  lease_pdf_url text null,
  agreement_conditions jsonb null,
  end_lease boolean not null default false,
  constraint bookings_pkey primary key (id),
  constraint bookings_agent_id_fkey foreign KEY (agent_id) references profiles (id),
  constraint bookings_listing_id_fkey foreign KEY (listing_id) references listings (id),
  constraint bookings_owner_id_fkey foreign KEY (owner_id) references profiles (id) on delete CASCADE,
  constraint bookings_renter_id_fkey foreign KEY (renter_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger audit_bookings_trigger
after INSERT
or DELETE
or
update on bookings for EACH row
execute FUNCTION log_table_change ();








create table public.favorites (
  id uuid not null,
  listing_id text not null,
  created_date timestamp with time zone null default now(),
  user_id uuid not null,
  constraint favorites_pkey primary key (user_id, listing_id)
) TABLESPACE pg_default;








create table public.inquiries (
  id uuid not null,
  listing_id uuid not null,
  listing_title text null,
  message text null,
  status text null default 'new'::text,
  created_date timestamp with time zone null default now(),
  agent_id uuid null,
  listing_owner_id uuid null,
  tenant_id uuid null,
  constraint inquiries_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_inquiries_listing_owner_id on public.inquiries using btree (listing_owner_id) TABLESPACE pg_default;







create table public.inquiry_replies (
  id uuid not null default gen_random_uuid (),
  inquiry_id uuid not null,
  sender_id uuid not null,
  sender_name text not null,
  sender_role text not null,
  message text not null,
  created_date timestamp with time zone not null default now(),
  recipient_type text null default 'both'::text,
  constraint inquiry_replies_pkey primary key (id),
  constraint inquiry_replies_inquiry_id_fkey foreign KEY (inquiry_id) references inquiries (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_inquiry_replies_inquiry_id on public.inquiry_replies using btree (inquiry_id) TABLESPACE pg_default;

create index IF not exists idx_inquiry_replies_recipient_type on public.inquiry_replies using btree (recipient_type) TABLESPACE pg_default;







create table public.listings (
  title text not null,
  description text null,
  price_usd numeric not null,
  price_mxn numeric null,
  bedrooms numeric not null,
  bathrooms numeric not null,
  furnished text null,
  pet_friendly boolean null default false,
  rental_type text null,
  neighborhood text not null,
  address text null,
  latitude numeric null,
  longitude numeric null,
  photos jsonb null default '[]'::jsonb,
  video_url text null,
  availability_date date null,
  lease_terms text null,
  deposit_amount numeric null,
  whatsapp text null,
  contact_email text null,
  status text null default 'pending'::text,
  is_verified boolean null default false,
  is_featured boolean null default false,
  last_verified_date timestamp with time zone null,
  views numeric null default 0,
  owner_email text null,
  owner_name text null,
  created_date timestamp with time zone null default now(),
  id uuid not null default gen_random_uuid (),
  agent_email text null,
  agent_phone text null,
  agent_name text null,
  owner_phone text null,
  blocked_dates jsonb null default '[]'::jsonb,
  constraint listings_pkey primary key (id)
) TABLESPACE pg_default;






create table public.notifications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  title text not null,
  message text not null,
  type text not null default 'general'::text,
  is_read boolean not null default false,
  created_at timestamp with time zone null default now(),
  constraint notifications_pkey primary key (id),
  constraint notifications_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_notifications_user_id on public.notifications using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_notifications_created_at on public.notifications using btree (created_at) TABLESPACE pg_default;





create table public.payments (
  id uuid not null default gen_random_uuid (),
  booking_id uuid null,
  payee_stripe_connect_id text null,
  amount_centavos integer null,
  amount_mxn numeric null,
  currency text null,
  stripe_event_id text null,
  stripe_session_id text null,
  stripe_payment_intent_id text null,
  created_date timestamp without time zone null default now(),
  listing_id uuid null,
  payer_id uuid null,
  payee_id uuid null,
  payout_status text null default 'pending'::text,
  payout_transfer_id text null,
  payout_error text null,
  payment_type text null,
  constraint payments_pkey primary key (id),
  constraint payments_booking_id_fkey foreign KEY (booking_id) references bookings (id),
  constraint payments_listing_id_fkey foreign KEY (listing_id) references listings (id)
) TABLESPACE pg_default;

create index IF not exists idx_payments_booking_id on public.payments using btree (booking_id) TABLESPACE pg_default;

create index IF not exists idx_payments_payee_id on public.payments using btree (payee_id) TABLESPACE pg_default;

create index IF not exists idx_payments_payer_id on public.payments using btree (payer_id) TABLESPACE pg_default;

create index IF not exists idx_payments_payout_status on public.payments using btree (payout_status) TABLESPACE pg_default;

create trigger audit_payments_trigger
after INSERT
or DELETE
or
update on payments for EACH row
execute FUNCTION log_table_change ();







create table public.platform_earnings (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  booking_id uuid null,
  amount_centavos integer not null,
  amount_mxn numeric not null,
  currency text not null default 'USD'::text,
  payout_status text null,
  payout_error text null,
  created_date timestamp with time zone not null default now(),
  constraint platform_earnings_pkey primary key (id),
  constraint platform_earnings_booking_id_fkey foreign KEY (booking_id) references bookings (id),
  constraint platform_earnings_user_id_fkey foreign KEY (user_id) references profiles (id)
) TABLESPACE pg_default;

create index IF not exists idx_platform_earnings_booking on public.platform_earnings using btree (booking_id) TABLESPACE pg_default;

create index IF not exists idx_platform_earnings_user on public.platform_earnings using btree (user_id) TABLESPACE pg_default;








create table public.profiles (
  id uuid not null,
  email text not null,
  full_name text null,
  role text null default 'renter'::text,
  google_id text null,
  photo_url text null,
  id_verified boolean null default false,
  created_date timestamp with time zone null default now(),
  last_login timestamp with time zone null,
  stripe_connect_id text null,
  stripe_onboarding_complete boolean not null default false,
  phone_number text null,
  referral_code text null,
  signatures text[] null default '{}'::text[],
  reset_otp text null,
  reset_otp_expires_at timestamp with time zone null,
  constraint profiles_pkey primary key (id),
  constraint profiles_email_key unique (email),
  constraint profiles_phone_number_key unique (phone_number)
) TABLESPACE pg_default;







create table public.property_reviews (
  id uuid not null,
  listing_id uuid not null,
  listing_title text null,
  rating numeric not null,
  comment text null,
  verified_tenant boolean null default true,
  created_date timestamp with time zone null default now(),
  reviewer_id uuid null,
  constraint property_reviews_pkey primary key (id),
  constraint unique_property_review unique (reviewer_id, listing_id)
) TABLESPACE pg_default;








create table public.referral_payments (
  id uuid not null default gen_random_uuid (),
  referral_id uuid not null,
  booking_id uuid not null,
  payer_id uuid not null,
  referrer_id uuid not null,
  amount_centavos integer not null,
  amount_mxn numeric not null,
  currency text not null default 'USD'::text,
  payout_status text not null default 'pending'::text,
  payout_transfer_id text null,
  payout_error text null,
  paid_date timestamp with time zone null,
  created_date timestamp with time zone null default now(),
  constraint referral_payments_pkey primary key (id),
  constraint referral_payments_booking_id_fkey foreign KEY (booking_id) references bookings (id) on delete CASCADE,
  constraint referral_payments_payer_id_fkey foreign KEY (payer_id) references profiles (id),
  constraint referral_payments_referrer_id_fkey foreign KEY (referrer_id) references profiles (id)
) TABLESPACE pg_default;

create index IF not exists idx_referral_payments_booking on public.referral_payments using btree (booking_id) TABLESPACE pg_default;

create index IF not exists idx_referral_payments_referrer on public.referral_payments using btree (referrer_id) TABLESPACE pg_default;

create index IF not exists idx_referral_payments_status on public.referral_payments using btree (payout_status) TABLESPACE pg_default;





create table public.sale_referrals (
  id uuid not null,
  client_name text not null,
  client_email text null,
  client_phone text null,
  referral_type text null default 'buyer'::text,
  property_description text null,
  estimated_value_usd numeric null,
  notes text null,
  status text null default 'pending'::text,
  commission_pct numeric null default 15,
  commission_amount numeric null,
  sale_price_mxn numeric null,
  admin_notes text null,
  paid_date timestamp with time zone null,
  created_date timestamp with time zone null default now(),
  referrer_id uuid not null default gen_random_uuid (),
  constraint sale_referrals_pkey primary key (id),
  constraint sale_referrals_referrer_id_fkey foreign KEY (referrer_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;





create table public.subscriptions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  plan text not null,
  status text not null default 'active'::text,
  current_period_end timestamp with time zone null,
  featured_listing_ids jsonb not null default '[]'::jsonb,
  created_date timestamp with time zone null default now(),
  last_payment_date timestamp with time zone null default now(),
  amount_centavos integer not null default 0,
  amount numeric not null default 0,
  constraint subscriptions_pkey primary key (id),
  constraint subscriptions_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists subscriptions_user_id_idx on public.subscriptions using btree (user_id) TABLESPACE pg_default;

create trigger audit_subscriptions_trigger
after INSERT
or DELETE
or
update on subscriptions for EACH row
execute FUNCTION log_table_change ();






create table public.user_push_subscriptions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone null default now(),
  constraint user_push_subscriptions_pkey primary key (id),
  constraint user_push_subscriptions_endpoint_unique unique (endpoint),
  constraint user_push_subscriptions_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_push_subscriptions_user_id on public.user_push_subscriptions using btree (user_id) TABLESPACE pg_default;







create table public.verifications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  profile_photo text null,
  id_document_url text null,
  employment_proof_url text null,
  veriff_session_id text null,
  veriff_session_url text null,
  created_date timestamp with time zone null default now(),
  updated_date timestamp with time zone null default now(),
  monthly_income numeric null,
  employer_name text null,
  id_verification text null,
  employment_verification text null,
  bank_statement_verification text null,
  belvo_link_id text null,
  belvo_institution_id text null,
  total_income numeric null,
  total_expenses numeric null,
  fiscal_year numeric null,
  financial_currency text null,
  financial_document_type text null,
  identity_documents json null,
  bank_documents json null,
  property_documents jsonb null,
  constraint tenant_verifications_pkey primary key (id),
  constraint tenant_verifications_user_id_key unique (user_id),
  constraint tenant_verifications_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;


-- Paid owner/renter conversations. Apply this block in Supabase SQL Editor.
create table if not exists public.chat_messages (
  id uuid not null default gen_random_uuid(),
  booking_id uuid not null,
  sender_id uuid not null,
  message text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint chat_messages_pkey primary key (id),
  constraint chat_messages_booking_id_fkey foreign key (booking_id)
    references public.bookings (id) on delete cascade,
  constraint chat_messages_sender_id_fkey foreign key (sender_id)
    references public.profiles (id) on delete cascade,
  constraint chat_messages_message_not_blank check (char_length(trim(message)) > 0),
  constraint chat_messages_message_length check (char_length(message) <= 4000)
) tablespace pg_default;

create index if not exists idx_chat_messages_booking_created
  on public.chat_messages (booking_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "Paid booking participants can read chat" on public.chat_messages;
create policy "Paid booking participants can read chat"
  on public.chat_messages for select
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = chat_messages.booking_id
        and b.status = 'confirmed'
        and (b.renter_id = auth.uid() or b.owner_id = auth.uid())
    )
  );

drop policy if exists "Paid booking participants can send chat" on public.chat_messages;
create policy "Paid booking participants can send chat"
  on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.bookings b
      where b.id = chat_messages.booking_id
        and b.status = 'confirmed'
        and (b.renter_id = auth.uid() or b.owner_id = auth.uid())
    )
  );

drop policy if exists "Senders can update their chat" on public.chat_messages;
create policy "Senders can update their chat"
  on public.chat_messages for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

drop policy if exists "Senders can delete their chat" on public.chat_messages;
create policy "Senders can delete their chat"
  on public.chat_messages for delete
  using (sender_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;

-- Allow owners and renters to load each other's verification profile photo
-- only after the booking has been paid and confirmed.
drop policy if exists "Confirmed booking participants can view verifications" on public.verifications;
create policy "Confirmed booking participants can view verifications"
  on public.verifications for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.status = 'confirmed'
        and (
          (b.owner_id = auth.uid() and b.renter_id = verifications.user_id)
          or (b.renter_id = auth.uid() and b.owner_id = verifications.user_id)
        )
    )
  );