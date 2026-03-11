-- LivAround2 — Checkout Verification Schema

-- User profiles
create table public.user_profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  avatar_url text,
  role text not null check (role in ('guest', 'host', 'cleaner')),
  checkout_score numeric(3,2) default 5.00,
  checkout_count integer default 0,
  created_at timestamptz default now()
);

-- Properties
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references public.user_profiles(id) on delete cascade not null,
  name text not null,
  address text not null,
  city text not null,
  cover_image_url text,
  created_at timestamptz default now()
);

-- Bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade not null,
  guest_id uuid references public.user_profiles(id) not null,
  host_id uuid references public.user_profiles(id) not null,
  check_in date not null,
  check_out date not null,
  status text default 'confirmed' check (status in ('confirmed', 'checked_in', 'checked_out', 'cancelled')),
  created_at timestamptz default now()
);

-- Checkout verifications
create table public.checkout_verifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade not null unique,

  -- Guest submission
  guest_video_url text,
  guest_submitted_at timestamptz,
  guest_location_lat numeric(10,7),
  guest_location_lng numeric(10,7),

  -- Host/cleaner submission
  host_video_url text,
  host_submitted_at timestamptz,
  host_location_lat numeric(10,7),
  host_location_lng numeric(10,7),
  cleaner_id uuid references public.user_profiles(id),

  -- Ratings (submitted by host/cleaner)
  overall_score numeric(2,1) check (overall_score between 1 and 5),
  cleanliness_score numeric(2,1) check (cleanliness_score between 1 and 5),
  damage_reported boolean default false,
  damage_notes text,
  host_notes text,

  status text default 'pending_guest' check (
    status in ('pending_guest', 'guest_submitted', 'pending_host', 'completed', 'disputed')
  ),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Storage buckets (run in Supabase dashboard)
-- insert into storage.buckets (id, name, public) values ('checkout-videos', 'checkout-videos', false);

-- RLS Policies

alter table public.user_profiles enable row level security;
alter table public.properties enable row level security;
alter table public.bookings enable row level security;
alter table public.checkout_verifications enable row level security;

-- Profiles: users can read all, edit own
create policy "Profiles are publicly readable" on public.user_profiles for select using (true);
create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.user_profiles for insert with check (auth.uid() = id);

-- Properties: public read, host can manage
create policy "Properties are publicly readable" on public.properties for select using (true);
create policy "Hosts can manage own properties" on public.properties for all using (auth.uid() = host_id);

-- Bookings: guest and host can view their own
create policy "Booking participants can view" on public.bookings for select
  using (auth.uid() = guest_id or auth.uid() = host_id);
create policy "Hosts can create bookings" on public.bookings for insert
  with check (auth.uid() = host_id);

-- Checkout verifications: participants can view
create policy "Checkout participants can view" on public.checkout_verifications for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
      and (b.guest_id = auth.uid() or b.host_id = auth.uid())
    )
    or cleaner_id = auth.uid()
  );

create policy "Checkout participants can update" on public.checkout_verifications for update
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
      and (b.guest_id = auth.uid() or b.host_id = auth.uid())
    )
    or cleaner_id = auth.uid()
  );

create policy "Hosts can create checkout verifications" on public.checkout_verifications for insert
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.host_id = auth.uid()
    )
  );

-- Function: update checkout_score on user after each completed verification
create or replace function update_guest_checkout_score()
returns trigger as $$
begin
  if new.status = 'completed' and new.overall_score is not null then
    update public.user_profiles
    set
      checkout_score = (
        (checkout_score * checkout_count + new.overall_score) / (checkout_count + 1)
      ),
      checkout_count = checkout_count + 1
    where id = (
      select guest_id from public.bookings where id = new.booking_id
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_checkout_completed
  after update on public.checkout_verifications
  for each row
  when (old.status is distinct from new.status)
  execute function update_guest_checkout_score();
