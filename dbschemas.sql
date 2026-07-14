create table public.agent_payments (
  id uuid not null default gen_random_uuid (),
  agent_id uuid not null,
  amount_cents integer not null,
  currency text null default 'usd'::text,
  plan text not null,
  stripe_session_id text null,
  stripe_payment_intent_id text null,
  status text null default 'succeeded'::text,
  created_date timestamp with time zone null default now(),
  constraint agent_payments_pkey primary key (id),
  constraint agent_payments_agent_id_fkey foreign KEY (agent_id) references profiles (id)
) TABLESPACE pg_default;

create index IF not exists idx_agent_payments_agent_id on public.agent_payments using btree (agent_id) TABLESPACE pg_default;

create index IF not exists idx_agent_payments_created_date on public.agent_payments using btree (created_date) TABLESPACE pg_default;






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
  id uuid not null default gen_random_uuid(),
  rating numeric not null,
  comment text null,
  created_date timestamp with time zone null default now(),
  agent_id uuid null,
  reviewer_id uuid null,
  constraint agent_reviews_pkey primary key (id),
  constraint agent_reviews_reviewer_id_fkey foreign KEY (reviewer_id) references profiles (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_agent_reviews_agent_id on public.agent_reviews using btree (agent_id) TABLESPACE pg_default;

create index IF not exists idx_agent_reviews_reviewer_id on public.agent_reviews using btree (reviewer_id) TABLESPACE pg_default;










create table public.agent_subscriptions (
  id uuid not null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  plan text not null,
  status text null default 'active'::text,
  current_period_end timestamp with time zone null,
  featured_listing_ids jsonb null default '[]'::jsonb,
  created_date timestamp with time zone null default now(),
  agent_id uuid null,
  constraint agent_subscriptions_pkey primary key (id)
) TABLESPACE pg_default;

create table public.subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  plan text not null,
  status text not null default 'active'::text,
  current_period_end timestamp with time zone null,
  featured_listing_ids jsonb not null default '[]'::jsonb,
  last_payment_date timestamp with time zone null default now(),
  created_date timestamp with time zone null default now(),
  constraint subscriptions_pkey primary key (id),
  constraint subscriptions_user_id_fkey foreign key (user_id) references profiles (id) on delete cascade
) TABLESPACE pg_default;

create unique index if not exists subscriptions_user_id_idx on public.subscriptions using btree (user_id) TABLESPACE pg_default;








create table public.booking_dates (
  id uuid not null,
  listing_id text not null,
  date date not null,
  type text not null,
  requester_name text null,
  requester_email text null,
  note text null,
  status text null default 'pending'::text,
  listing_owner_email text null,
  created_date timestamp with time zone null default now(),
  constraint booking_dates_pkey primary key (id)
) TABLESPACE pg_default;






create table public.bookings (
  id uuid not null default gen_random_uuid (),
  move_in_date date not null,
  lease_duration_months integer null default 12,
  monthly_budget_usd numeric null,
  message text null,
  status text null default 'pending'::text,
  created_date timestamp without time zone null default now(),
  updated_date timestamp without time zone null default now(),
  listing_id uuid null,
  renter_id uuid not null default gen_random_uuid (),
  owner_id uuid not null default gen_random_uuid (),
  agent_id uuid null,
  referral_code text null,
  anvil_eid text null,
  lease_status text null default 'pending'::text,
  constraint bookings_pkey primary key (id),
  constraint bookings_agent_id_fkey foreign KEY (agent_id) references profiles (id),
  constraint bookings_listing_id_fkey foreign KEY (listing_id) references listings (id),
  constraint bookings_owner_id_fkey foreign KEY (owner_id) references profiles (id) on delete CASCADE,
  constraint bookings_renter_id_fkey foreign KEY (renter_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;






create table public.commission_payouts (
  id uuid not null,
  agent_email text not null,
  agent_name text null,
  referral_id text not null,
  referral_code text null,
  client_name text null,
  listing_title text null,
  commission_amount numeric not null,
  payment_method text null default 'bank_transfer'::text,
  payment_details text null,
  status text null default 'pending'::text,
  admin_notes text null,
  paid_date timestamp with time zone null,
  created_date timestamp with time zone null default now(),
  constraint commission_payouts_pkey primary key (id)
) TABLESPACE pg_default;









create table public.favorites (
  id uuid not null default gen_random_uuid(),
  listing_id text not null,
  user_id uuid null,
  created_date timestamp with time zone null default now(),
  constraint favorites_pkey primary key (id),
  constraint favorites_user_id_fkey foreign KEY (user_id) references profiles (id) on delete cascade
) TABLESPACE pg_default;

create index IF not exists idx_favorites_user_id on public.favorites using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_favorites_listing_id on public.favorites using btree (listing_id) TABLESPACE pg_default;









create table public.inquiries (
  id uuid not null,
  listing_id uuid not null,
  listing_title text null,
  name text not null,
  email text not null,
  whatsapp text null,
  budget numeric null,
  move_in_date date null,
  message text null,
  referral_code text null,
  status text null default 'new'::text,
  created_date timestamp with time zone null default now(),
  agent_id uuid null,
  listing_owner_id uuid null,
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

create index IF not exists idx_inquiry_replies_recipient_type on public.inquiry_replies using btree (recipient_type) TABLESPACE pg_default;

create index IF not exists idx_inquiry_replies_inquiry_id on public.inquiry_replies using btree (inquiry_id) TABLESPACE pg_default;




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
  constraint listings_pkey primary key (id)
) TABLESPACE pg_default;







create table public.payments (
  id uuid not null default gen_random_uuid (),
  booking_id uuid null,
  payee_stripe_connect_id text null,
  agent_id uuid null,
  amount_cents integer null,
  amount_usd numeric null,
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
  constraint payments_pkey primary key (id),
  constraint payments_booking_id_fkey foreign KEY (booking_id) references bookings (id),
  constraint payments_listing_id_fkey foreign KEY (listing_id) references listings (id)
) TABLESPACE pg_default;

create index IF not exists idx_payments_payout_status on public.payments using btree (payout_status) TABLESPACE pg_default;

create index IF not exists idx_payments_payer_id on public.payments using btree (payer_id) TABLESPACE pg_default;

create index IF not exists idx_payments_payee_id on public.payments using btree (payee_id) TABLESPACE pg_default;

create index IF not exists idx_payments_booking_id on public.payments using btree (booking_id) TABLESPACE pg_default;

create index IF not exists idx_payments_agent_id on public.payments using btree (agent_id) TABLESPACE pg_default;







create table public.profiles (
  id uuid not null,
  email text not null,
  password text null,
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
  reviewer_email text not null,
  reviewer_name text null,
  rating numeric not null,
  comment text null,
  verified_tenant boolean null default true,
  created_date timestamp with time zone null default now(),
  constraint property_reviews_pkey primary key (id)
) TABLESPACE pg_default;




create table public.referral_payments (
  id uuid not null default gen_random_uuid (),
  referral_id uuid not null,
  booking_id uuid not null,
  payer_id uuid not null,
  referrer_id uuid not null,
  amount_cents integer not null,
  amount_usd numeric not null,
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

create index IF not exists idx_referral_payments_status on public.referral_payments using btree (payout_status) TABLESPACE pg_default;

create index IF not exists idx_referral_payments_referrer on public.referral_payments using btree (referrer_id) TABLESPACE pg_default;

create index IF not exists idx_referral_payments_booking on public.referral_payments using btree (booking_id) TABLESPACE pg_default;








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
  sale_price_usd numeric null,
  admin_notes text null,
  paid_date timestamp with time zone null,
  created_date timestamp with time zone null default now(),
  referrer_id uuid not null default gen_random_uuid (),
  constraint sale_referrals_pkey primary key (id),
  constraint sale_referrals_referrer_id_fkey foreign KEY (referrer_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;









create table public.verifications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  id_document_url text not null,
  employment_proof_url text null,
  veriff_session_id text null,
  veriff_session_url text null,
  status text not null default 'new'::text,
  created_date timestamp with time zone null default now(),
  updated_date timestamp with time zone null default now(),
  powens_connection_id text null,
  powens_account_id text null,
  belvo_link_id text null,
  belvo_account_id text null,
  belvo_purpose text null,
  balance_amount numeric null default 0,
  monthly_income numeric null default 0,
  employer_name text null,
  bank_statement_verification text null default 'pending'::text,
  employment_verification text null default 'pending'::text,
  id_verification text null default 'new'::text,
  bank_name text null,
  account_last_4 text null,
  account_holder_name text null,
  account_type text null,
  currency text null default 'MXN'::text,
  verification_status text null default 'pending'::text,
  constraint verifications_pkey primary key (id),
  constraint verifications_user_id_key unique (user_id),
  constraint verifications_user_id_fkey foreign key (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;






