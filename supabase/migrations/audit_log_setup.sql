create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  created_at timestamp with time zone default now(),
  constraint audit_logs_user_id_fkey foreign key (user_id) references public.profiles(id) on update cascade on delete set null
);

-- Ensure correct foreign key cascading if the table already exists
alter table public.audit_logs drop constraint if exists audit_logs_user_id_fkey;
alter table public.audit_logs 
  add constraint audit_logs_user_id_fkey 
  foreign key (user_id) 
  references public.profiles(id) 
  on update cascade 
  on delete set null;

-- Enable RLS on audit_logs
alter table public.audit_logs enable row level security;

-- Policy to allow inserts from anyone (anonymous or authenticated)
create policy "Allow insert for everyone" on public.audit_logs
  for insert
  with check (true);

-- Policy to allow admins to view all audit logs
create policy "Allow select for admins only" on public.audit_logs
  for select
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Create generic trigger function to log changes automatically
create or replace function public.log_table_change()
returns trigger as $$
declare
  v_user_id uuid;
  v_action text;
  v_entity_id text;
begin
  -- Skip logging deletes for subscriptions (internal cleanup/upsert noise)
  if TG_TABLE_NAME = 'subscriptions' and TG_OP = 'DELETE' then
    return OLD;
  end if;

  -- Get active user ID from Supabase auth context
  v_user_id := auth.uid();
  
  -- Fallback to the user/owner of the record if auth.uid() is null (e.g. system webhooks)
  if v_user_id is null then
    if TG_TABLE_NAME = 'subscriptions' then
      if TG_OP = 'DELETE' then
        v_user_id := OLD.user_id;
      else
        v_user_id := NEW.user_id;
      end if;
    elsif TG_TABLE_NAME = 'profiles' then
      if TG_OP = 'DELETE' then
        v_user_id := OLD.id;
      else
        v_user_id := NEW.id;
      end if;
    elsif TG_TABLE_NAME = 'payments' then
      if TG_OP = 'DELETE' then
        v_user_id := OLD.payer_id;
      else
        v_user_id := NEW.payer_id;
      end if;
    elsif TG_TABLE_NAME = 'bookings' then
      if TG_OP = 'DELETE' then
        v_user_id := OLD.renter_id;
      else
        v_user_id := NEW.renter_id;
      end if;
    elsif TG_TABLE_NAME = 'listings' then
      if TG_OP = 'DELETE' then
        v_user_id := OLD.owner_id;
      else
        v_user_id := NEW.owner_id;
      end if;
    end if;
  end if;

  -- Determine action, state, and ID
  if TG_OP = 'INSERT' then
    v_action := 'CREATE_' || upper(TG_TABLE_NAME);
    v_entity_id := coalesce(NEW.id::text, '');
  elsif TG_OP = 'UPDATE' then
    v_action := 'UPDATE_' || upper(TG_TABLE_NAME);
    v_entity_id := coalesce(NEW.id::text, OLD.id::text, '');
  elsif TG_OP = 'DELETE' then
    v_action := 'DELETE_' || upper(TG_TABLE_NAME);
    v_entity_id := coalesce(OLD.id::text, '');
  end if;

  -- Insert the audit log entry
  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id
  ) values (
    v_user_id,
    v_action,
    TG_TABLE_NAME,
    v_entity_id
  );

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$ language plpgsql security definer;

-- Drop triggers if they already exist to make script re-runnable
drop trigger if exists audit_listings_trigger on public.listings;
drop trigger if exists audit_bookings_trigger on public.bookings;
drop trigger if exists audit_profiles_trigger on public.profiles;
drop trigger if exists audit_payments_trigger on public.payments;
drop trigger if exists audit_subscriptions_trigger on public.subscriptions;

-- Bind trigger function to tables
create trigger audit_listings_trigger
  after insert or update or delete on public.listings
  for each row execute function public.log_table_change();

create trigger audit_bookings_trigger
  after insert or update or delete on public.bookings
  for each row execute function public.log_table_change();

create trigger audit_profiles_trigger
  after insert or update or delete on public.profiles
  for each row execute function public.log_table_change();

create trigger audit_payments_trigger
  after insert or update or delete on public.payments
  for each row execute function public.log_table_change();

create trigger audit_subscriptions_trigger
  after insert or update or delete on public.subscriptions
  for each row execute function public.log_table_change();
