-- Uni Boost schema for Supabase.
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- After it succeeds:
-- 1. Authentication → Users → Add user. Use the email and password the admin will type into the dashboard.
-- 2. Copy that user's UUID and run:
--      insert into public.ub_admins (user_id) values ('PASTE-THE-USER-UUID');
-- 3. On Vercel, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
--    Do not set NEXT_PUBLIC_PREVIEW on Vercel. That flag is only for local sample data.
--
-- The public site can call get_public, book, get_mine, and the other student functions.
-- It cannot read pins, payment receipts, class links, or student emails from get_public.
-- Admin functions require the signed-in user to be listed in ub_admins.

create extension if not exists pgcrypto with schema extensions;

-- ---------- tables ----------
create table if not exists public.ub_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.ub_settings (
  id text primary key,
  body jsonb not null default '{}'::jsonb
);

create table if not exists public.ub_instructors (
  id text primary key,
  body jsonb not null default '{}'::jsonb,
  pin_hash text
);

create table if not exists public.ub_categories (
  id text primary key,
  body jsonb not null default '{}'::jsonb
);

create table if not exists public.ub_courses (
  id text primary key,
  body jsonb not null default '{}'::jsonb
);

create table if not exists public.ub_slots (
  id text primary key,
  inst_id text not null references public.ub_instructors (id) on delete cascade,
  slot_date date not null,
  slot_time text not null,
  body jsonb not null default '{}'::jsonb,
  unique (inst_id, slot_date, slot_time)
);

create table if not exists public.ub_bookings (
  id bigint generated always as identity primary key,
  slot_id text not null references public.ub_slots (id) on delete cascade,
  phone_norm text not null,
  kind text not null default '',
  seats integer not null default 1,
  pin_hash text,
  body jsonb not null default '{}'::jsonb,
  unique (slot_id, phone_norm)
);

create table if not exists public.ub_requests (
  id bigint generated always as identity primary key,
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ub_pin_attempts (
  key text primary key,
  fails integer not null default 0,
  locked_until timestamptz
);

create table if not exists public.ub_notify_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  body jsonb not null default '{}'::jsonb
);

create index if not exists ub_slots_inst_idx on public.ub_slots (inst_id, slot_date, slot_time);
create index if not exists ub_bookings_phone_idx on public.ub_bookings (phone_norm);
create index if not exists ub_requests_created_idx on public.ub_requests (created_at desc);

insert into public.ub_settings (id, body)
values ('main', jsonb_build_object(
  'leadMin', 30, 'durMin', 90, 'recHours', 72, 'currency', 'EGP',
  'instapayId', '', 'instapayName', '', 'instapayLink', '', 'payNote', '',
  'promoPoints', 10, 'groupMode', ''
))
on conflict (id) do nothing;

alter table public.ub_admins enable row level security;
alter table public.ub_settings enable row level security;
alter table public.ub_instructors enable row level security;
alter table public.ub_categories enable row level security;
alter table public.ub_courses enable row level security;
alter table public.ub_slots enable row level security;
alter table public.ub_bookings enable row level security;
alter table public.ub_requests enable row level security;
alter table public.ub_pin_attempts enable row level security;
alter table public.ub_notify_log enable row level security;

revoke all on public.ub_admins, public.ub_settings, public.ub_instructors, public.ub_categories,
  public.ub_courses, public.ub_slots, public.ub_bookings, public.ub_requests,
  public.ub_pin_attempts, public.ub_notify_log from anon, authenticated;

-- ---------- helpers ----------
create or replace function public.ub_phone(p text)
returns text
language sql
immutable
as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10);
$$;

create or replace function public.ub_num(j jsonb, k text)
returns numeric
language sql
immutable
as $$
  select case
    when j is null or k is null or not (j ? k) then null
    when coalesce(j->>k, '') ~ '^-?[0-9]+(\.[0-9]+)?$' then (j->>k)::numeric
    else null
  end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.ub_admins where user_id = auth.uid());
$$;

create or replace function public.ub_require_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
end;
$$;

create or replace function public.ub_settings_main()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'leadMin', 30, 'durMin', 90, 'recHours', 72, 'currency', 'EGP',
    'instapayId', '', 'instapayName', '', 'instapayLink', '', 'payNote', '',
    'promoPoints', 10, 'groupMode', ''
  ) || coalesce((select body - 'id' - 'pin' from public.ub_settings where id = 'main'), '{}'::jsonb);
$$;

create or replace function public.ub_taken(p_slot text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.ub_bookings b where b.slot_id = p_slot and b.kind = 'single')
      then coalesce((select nullif(s.body->>'cap', '')::int from public.ub_slots s where s.id = p_slot), 10)
    else coalesce((select sum(greatest(b.seats, 1))::int from public.ub_bookings b where b.slot_id = p_slot), 0)
  end;
$$;

-- Instructor PINs are 4 or more digits. Student access codes are 6 to 10.
create or replace function public.ub_pin_ok(p_key text, p_hash text, p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  att public.ub_pin_attempts%rowtype;
  n integer;
  student boolean := left(coalesce(p_key, ''), 4) = 'stu:';
begin
  if student and coalesce(p_pin, '') !~ '^[0-9]{6,10}$' then
    return 'nopin';
  end if;
  if not student and coalesce(p_pin, '') !~ '^[0-9]{4,10}$' then
    return 'badpin';
  end if;
  select * into att from public.ub_pin_attempts where key = p_key;
  if att.locked_until is not null and att.locked_until > now() then
    return 'locked';
  end if;
  if coalesce(p_hash, '') = '' then
    return 'legacy';
  end if;
  if extensions.crypt(p_pin, p_hash) = p_hash then
    delete from public.ub_pin_attempts where key = p_key;
    return '';
  end if;
  insert into public.ub_pin_attempts as a (key, fails, locked_until)
  values (p_key, 1, null)
  on conflict (key) do update
    set fails = public.ub_pin_attempts.fails + 1,
        locked_until = case when public.ub_pin_attempts.fails + 1 >= 8 then now() + interval '15 minutes' else null end;
  select fails into n from public.ub_pin_attempts where key = p_key;
  if n >= 8 then
    return 'locked';
  end if;
  return 'badpin';
end;
$$;

create or replace function public.ub_public_instructor(j jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(j, '{}'::jsonb) - 'pin' - 'hasPin' - 'password';
$$;

create or replace function public.ub_public_slot(s public.ub_slots)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', s.id,
    'instId', s.inst_id,
    'date', to_char(s.slot_date, 'YYYY-MM-DD'),
    'time', s.slot_time,
    'mode', coalesce(s.body->>'mode', 'Online'),
    'course', coalesce(s.body->>'course', 'Class'),
    'cap', coalesce(nullif(s.body->>'cap', '')::int, 10),
    'dur', public.ub_num(s.body, 'dur'),
    'leadMin', public.ub_num(s.body, 'leadMin'),
    'center', nullif(s.body->>'center', ''),
    'loc', nullif(s.body->>'loc', ''),
    'booked', public.ub_taken(s.id)
  ));
$$;

create or replace function public.ub_full_slot(s public.ub_slots)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.ub_public_slot(s)
    || jsonb_build_object(
      'link', coalesce(s.body->>'link', ''),
      'materials', coalesce(s.body->'materials', '[]'::jsonb),
      'rec', s.body->'rec',
      'bookings', coalesce((
        select jsonb_agg((b.body - 'pin') order by b.id)
        from public.ub_bookings b where b.slot_id = s.id
      ), '[]'::jsonb)
    );
$$;

create or replace function public.ub_catalog()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'cats', coalesce((select jsonb_agg(body - 'pin' order by body->>'name') from public.ub_categories), '[]'::jsonb),
    'courses', coalesce((select jsonb_agg(body - 'pin' order by body->>'name') from public.ub_courses), '[]'::jsonb)
  );
$$;

-- ---------- public reads and student actions ----------
create or replace function public.get_public()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'settings', public.ub_settings_main(),
    'instructors', coalesce((
      select jsonb_agg(public.ub_public_instructor(body) order by body->>'name')
      from public.ub_instructors
    ), '[]'::jsonb),
    'catalog', public.ub_catalog(),
    'slots', coalesce((
      select jsonb_agg(public.ub_public_slot(s) order by s.slot_date, s.slot_time)
      from public.ub_slots s
    ), '[]'::jsonb),
    'requests', '[]'::jsonb
  );
$$;

create or replace function public.validate_promo(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object('ok', true, 'name', i.body->>'name')
    from public.ub_instructors i
    where upper(regexp_replace(coalesce(i.body->>'promo', ''), '\s', '', 'g'))
      = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'))
      and regexp_replace(coalesce(p_code, ''), '\s', '', 'g') <> ''
    limit 1
  ), jsonb_build_object('ok', false));
$$;

create or replace function public.book(
  p_slot text,
  p_name text,
  p_phone text,
  p_email text,
  p_subject text,
  p_topic text,
  p_file text,
  p_fname text,
  p_kind text,
  p_seats integer,
  p_promo text,
  p_uni text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.ub_slots%rowtype;
  cfg jsonb := public.ub_settings_main();
  norm text := public.ub_phone(p_phone);
  existing_hash text;
  pin_state text;
  online boolean;
  kind text := '';
  seats integer := 1;
  cap integer;
  used integer;
  course jsonb;
  base numeric;
  single numeric;
  g24 numeric;
  g5 numeric;
  unit numeric;
  total numeric;
  code text := upper(regexp_replace(coalesce(p_promo, ''), '\s', '', 'g'));
  promo public.ub_instructors%rowtype;
  promo_id text := null;
  points numeric;
  pay jsonb;
  body jsonb;
  new_hash text;
begin
  if length(coalesce(trim(p_name), '')) < 2 then
    return jsonb_build_object('status', 'invalid');
  end if;
  if length(norm) < 7 then
    return jsonb_build_object('status', 'invalid');
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{6,10}$' then
    return jsonb_build_object('status', 'weakpin');
  end if;

  perform pg_advisory_xact_lock(hashtext(coalesce(p_slot, '')));

  select * into s from public.ub_slots where id = p_slot;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  if exists (select 1 from public.ub_bookings b where b.slot_id = s.id and b.phone_norm = norm) then
    return jsonb_build_object('status', 'dup');
  end if;

  select b.pin_hash into existing_hash
  from public.ub_bookings b
  where b.phone_norm = norm and coalesce(b.pin_hash, '') <> ''
  limit 1;
  if existing_hash is not null then
    pin_state := public.ub_pin_ok('stu:' || norm, existing_hash, p_pin);
    if pin_state <> '' then
      return jsonb_build_object('status', pin_state);
    end if;
  end if;

  online := coalesce(s.body->>'mode', 'Online') = 'Online' or coalesce(s.body->>'mode', '') = '';
  cap := coalesce(nullif(s.body->>'cap', '')::int, 10);
  used := public.ub_taken(s.id);
  if online and p_kind = 'single' then
    kind := 'single';
    seats := 1;
    if used > 0 then return jsonb_build_object('status', 'full'); end if;
  elsif online and p_kind = 'group' then
    kind := 'group';
    seats := coalesce(p_seats, 0);
    if seats < 2 then return jsonb_build_object('status', 'invalid'); end if;
    if used + seats > cap then return jsonb_build_object('status', 'full'); end if;
  else
    kind := '';
    seats := 1;
    if used >= cap then return jsonb_build_object('status', 'full'); end if;
  end if;

  points := coalesce(public.ub_num(cfg, 'promoPoints'), 10);
  if code <> '' then
    select * into promo from public.ub_instructors i
    where upper(regexp_replace(coalesce(i.body->>'promo', ''), '\s', '', 'g')) = code
    limit 1;
    if not found then
      return jsonb_build_object('status', 'badcode');
    end if;
    promo_id := promo.id;
    points := coalesce(public.ub_num(promo.body, 'pointsPer'), points);
  end if;

  select c.body into course
  from public.ub_courses c
  where lower(c.body->>'name') = lower(coalesce(nullif(p_subject, ''), s.body->>'course', ''))
     or lower(coalesce(c.body->>'tag', '')) = lower(coalesce(nullif(p_subject, ''), s.body->>'course', ''))
  order by case when lower(c.body->>'name') = lower(coalesce(nullif(p_subject, ''), s.body->>'course', '')) then 0 else 1 end
  limit 1;

  base := public.ub_num(course, 'price');
  single := coalesce(public.ub_num(course, 'priceSingle'), base);
  g24 := coalesce(public.ub_num(course, 'priceG24'), base);
  g5 := coalesce(public.ub_num(course, 'priceG5'), base);
  if kind = 'single' then
    unit := single; total := single;
  elsif kind = 'group' then
    unit := case when seats >= 5 then g5 else g24 end;
    total := case when unit is null then null when cfg->>'groupMode' = 'total' then unit else unit * seats end;
  else
    unit := coalesce(base, single, g24, g5);
    total := unit;
  end if;

  if total is not null and total > 0 then
    pay := jsonb_build_object('status', 'unpaid');
  else
    pay := null;
  end if;

  new_hash := extensions.crypt(p_pin, extensions.gen_salt('bf'));

  body := jsonb_strip_nulls(jsonb_build_object(
    'name', trim(p_name),
    'phone', trim(p_phone),
    'email', nullif(trim(coalesce(p_email, '')), ''),
    'university', nullif(trim(coalesce(p_uni, '')), ''),
    'subject', nullif(trim(coalesce(p_subject, '')), ''),
    'topic', nullif(trim(coalesce(p_topic, '')), ''),
    'kind', kind,
    'seats', seats,
    'unit', unit,
    'price', total,
    'cur', coalesce(nullif(cfg->>'currency', ''), 'EGP'),
    'promo', case when promo_id is not null then code else null end,
    'promoInst', promo_id,
    'promoPoints', case when promo_id is not null then points else null end,
    'pay', pay,
    'fileId', nullif(coalesce(p_file, ''), ''),
    'fileName', nullif(coalesce(p_fname, ''), ''),
    'at', to_jsonb(now())
  ));

  insert into public.ub_bookings (slot_id, phone_norm, kind, seats, pin_hash, body)
  values (s.id, norm, kind, seats, coalesce(existing_hash, new_hash), body);

  return jsonb_build_object('status', 'ok');
end;
$$;

create or replace function public.ub_student_slot(s public.ub_slots, b public.ub_bookings)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cfg jsonb := public.ub_settings_main();
  start_at timestamptz;
  dur integer;
  lead integer;
  paid boolean;
  link text;
  open_now boolean;
  rec jsonb;
  added timestamptz;
  hours integer;
  visible boolean;
begin
  start_at := (s.slot_date::text || ' ' || s.slot_time)::timestamp at time zone 'Africa/Cairo';
  dur := coalesce(public.ub_num(s.body, 'dur')::int, public.ub_num(cfg, 'durMin')::int, 90);
  lead := coalesce(public.ub_num(s.body, 'leadMin')::int, public.ub_num(cfg, 'leadMin')::int, 30);
  paid := b.body->'pay' is null or b.body#>>'{pay,status}' = 'paid';
  link := coalesce(s.body->>'link', '');
  open_now := now() >= start_at - make_interval(mins => lead)
    and now() <= start_at + make_interval(mins => dur + 15);
  rec := s.body->'rec';
  if rec is not null then
    begin
      added := nullif(rec->>'addedAt', '')::timestamptz;
    exception when others then
      added := null;
    end;
    hours := coalesce(public.ub_num(rec, 'hours')::int, 72);
    visible := added is not null and now() >= added and now() < added + make_interval(hours => hours);
    if not (paid and visible) then
      rec := rec - 'url' - 'fileId';
    end if;
  end if;
  return public.ub_public_slot(s) || jsonb_build_object(
    'link', case when paid and open_now then link else '' end,
    'hasLink', link <> '',
    'materials', coalesce(s.body->'materials', '[]'::jsonb),
    'rec', rec,
    'bookings', jsonb_build_array(b.body - 'pin'),
    'mine', b.body - 'pin'
  );
end;
$$;

create or replace function public.get_mine(p_phone text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text := public.ub_phone(p_phone);
  existing_hash text;
  pin_state text;
begin
  if length(norm) < 6 then
    return '[]'::jsonb;
  end if;
  if not exists (select 1 from public.ub_bookings b where b.phone_norm = norm) then
    return '[]'::jsonb;
  end if;
  select b.pin_hash into existing_hash
  from public.ub_bookings b
  where b.phone_norm = norm and coalesce(b.pin_hash, '') <> ''
  limit 1;
  if existing_hash is null then
    return jsonb_build_object('error', 'legacy');
  end if;
  pin_state := public.ub_pin_ok('stu:' || norm, existing_hash, p_pin);
  if pin_state <> '' then
    return jsonb_build_object('error', pin_state);
  end if;
  return coalesce((
    select jsonb_agg(public.ub_student_slot(s, b) order by s.slot_date, s.slot_time)
    from public.ub_bookings b
    join public.ub_slots s on s.id = b.slot_id
    where b.phone_norm = norm
  ), '[]'::jsonb);
end;
$$;

create or replace function public.my_slot_ids(p_phone text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mine jsonb := public.get_mine(p_phone, p_pin);
begin
  if jsonb_typeof(mine) <> 'array' then
    return '[]'::jsonb;
  end if;
  return coalesce((select jsonb_agg(x->>'id') from jsonb_array_elements(mine) x), '[]'::jsonb);
end;
$$;

create or replace function public.cancel_booking(p_slot text, p_phone text, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text := public.ub_phone(p_phone);
  existing_hash text;
  pin_state text;
begin
  select b.pin_hash into existing_hash
  from public.ub_bookings b
  where b.slot_id = p_slot and b.phone_norm = norm;
  if existing_hash is null and not exists (
    select 1 from public.ub_bookings b where b.slot_id = p_slot and b.phone_norm = norm
  ) then
    return;
  end if;
  pin_state := public.ub_pin_ok('stu:' || norm, existing_hash, p_pin);
  if pin_state <> '' then
    raise exception 'Wrong phone number or access code';
  end if;
  delete from public.ub_bookings b where b.slot_id = p_slot and b.phone_norm = norm;
end;
$$;

create or replace function public.submit_payment(
  p_slot text,
  p_phone text,
  p_ref text,
  p_file text,
  p_fname text,
  p_files jsonb,
  p_pin text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text := public.ub_phone(p_phone);
  row public.ub_bookings%rowtype;
  pin_state text;
  files jsonb;
begin
  select * into row from public.ub_bookings b where b.slot_id = p_slot and b.phone_norm = norm;
  if not found then
    return false;
  end if;
  pin_state := public.ub_pin_ok('stu:' || norm, row.pin_hash, p_pin);
  if pin_state <> '' then
    return false;
  end if;
  if length(regexp_replace(coalesce(p_ref, ''), '\D', '', 'g')) < 10 then
    return false;
  end if;
  files := case when jsonb_typeof(p_files) = 'array' then p_files else '[]'::jsonb end;
  if coalesce(p_file, '') <> '' and files = '[]'::jsonb then
    files := jsonb_build_array(jsonb_build_object('id', p_file, 'name', coalesce(nullif(p_fname, ''), 'Receipt')));
  end if;
  update public.ub_bookings b
  set body = b.body || jsonb_build_object('pay', jsonb_build_object(
    'status', 'pending',
    'ref', trim(p_ref),
    'fileId', nullif(coalesce(p_file, ''), ''),
    'fileName', nullif(coalesce(p_fname, ''), ''),
    'files', files,
    'at', to_jsonb(now())
  ))
  where b.id = row.id;
  return true;
end;
$$;

create or replace function public.submit_request(p_data jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  name text := trim(coalesce(p_data->>'name', ''));
  phone text := trim(coalesce(p_data->>'phone', ''));
  course text := trim(coalesce(p_data->>'course', ''));
  students integer := coalesce(public.ub_num(p_data, 'students')::int, 0);
  mode text := coalesce(p_data->>'mode', 'Either');
begin
  if length(name) < 2 or length(public.ub_phone(phone)) < 7 or length(course) < 2 then
    return false;
  end if;
  if students < 1 or students > 500 then
    return false;
  end if;
  if mode not in ('Online', 'Offline', 'Either') then
    mode := 'Either';
  end if;
  insert into public.ub_requests (body)
  values (jsonb_build_object(
    'kind', case when p_data->>'kind' = 'course' then 'course' else 'class' end,
    'name', name,
    'phone', phone,
    'email', trim(coalesce(p_data->>'email', '')),
    'course', course,
    'instId', coalesce(p_data->>'instId', ''),
    'students', students,
    'times', trim(coalesce(p_data->>'times', '')),
    'mode', mode,
    'note', trim(coalesce(p_data->>'note', '')),
    'status', 'new',
    'at', to_jsonb(now())
  ));
  return true;
end;
$$;

-- ---------- admin ----------
create or replace function public.admin_check()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin();
$$;

create or replace function public.admin_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ub_require_admin();
  return jsonb_build_object(
    'settings', public.ub_settings_main(),
    'notify', coalesce((select body - 'id' from public.ub_settings where id = 'notify'), '{}'::jsonb),
    'instructors', coalesce((
      select jsonb_agg(
        public.ub_public_instructor(i.body) || jsonb_build_object('hasPin', i.pin_hash is not null)
        order by i.body->>'name'
      )
      from public.ub_instructors i
    ), '[]'::jsonb),
    'catalog', public.ub_catalog(),
    'slots', coalesce((
      select jsonb_agg(public.ub_full_slot(s) order by s.slot_date, s.slot_time)
      from public.ub_slots s
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg((jsonb_build_object('id', r.id) || r.body) order by r.created_at desc)
      from public.ub_requests r
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_upsert(p_table text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  el jsonb;
  clean jsonb;
  rid text;
  new_hash text;
begin
  perform public.ub_require_admin();
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Expected a list of rows';
  end if;
  for el in select value from jsonb_array_elements(p_rows) as x(value)
  loop
    rid := nullif(el->>'id', '');
    if rid is null then
      continue;
    end if;
    if p_table = 'settings' then
      clean := el - 'id' - 'pin' - 'password';
      insert into public.ub_settings (id, body) values (rid, clean)
      on conflict (id) do update set body = public.ub_settings.body || excluded.body;
    elsif p_table = 'instructors' then
      new_hash := null;
      if coalesce(el->>'pin', '') <> '' then
        new_hash := extensions.crypt(el->>'pin', extensions.gen_salt('bf'));
      end if;
      clean := el - 'pin' - 'hasPin' - 'password';
      clean := clean || jsonb_build_object('id', rid);
      insert into public.ub_instructors (id, body, pin_hash)
      values (rid, clean, new_hash)
      on conflict (id) do update
        set body = public.ub_instructors.body || excluded.body,
            pin_hash = coalesce(excluded.pin_hash, public.ub_instructors.pin_hash);
    elsif p_table = 'cats' then
      clean := el - 'pin';
      clean := clean || jsonb_build_object('id', rid);
      insert into public.ub_categories (id, body) values (rid, clean)
      on conflict (id) do update set body = public.ub_categories.body || excluded.body;
    elsif p_table = 'courses' then
      clean := el - 'pin';
      clean := clean || jsonb_build_object('id', rid);
      insert into public.ub_courses (id, body) values (rid, clean)
      on conflict (id) do update set body = public.ub_courses.body || excluded.body;
    elsif p_table = 'slots' then
      if not exists (select 1 from public.ub_slots where id = rid) then
        if coalesce(el->>'instId', '') = '' or coalesce(el->>'date', '') = '' or coalesce(el->>'time', '') = '' then
          raise exception 'A new class needs an instructor, date, and time';
        end if;
        insert into public.ub_slots (id, inst_id, slot_date, slot_time, body)
        values (
          rid,
          el->>'instId',
          (el->>'date')::date,
          left(el->>'time', 5),
          (el - 'bookings' - 'booked' - 'hasLink' - 'pin')
        );
      else
        update public.ub_slots s
        set body = s.body || (el - 'bookings' - 'booked' - 'hasLink' - 'pin' - 'id'),
            inst_id = coalesce(nullif(el->>'instId', ''), s.inst_id),
            slot_date = case when el ? 'date' and coalesce(el->>'date', '') <> '' then (el->>'date')::date else s.slot_date end,
            slot_time = case when el ? 'time' and coalesce(el->>'time', '') <> '' then left(el->>'time', 5) else s.slot_time end
        where s.id = rid;
      end if;
    else
      raise exception 'Unknown table';
    end if;
  end loop;
end;
$$;

create or replace function public.admin_delete(p_table text, p_ids jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rid text;
begin
  perform public.ub_require_admin();
  for rid in select value #>> '{}' from jsonb_array_elements(coalesce(p_ids, '[]'::jsonb)) as x(value)
  loop
    if p_table = 'instructors' then
      delete from public.ub_instructors where id = rid;
    elsif p_table = 'slots' then
      delete from public.ub_slots where id = rid;
    elsif p_table = 'courses' then
      delete from public.ub_courses where id = rid;
    elsif p_table = 'cats' then
      delete from public.ub_categories where id = rid;
    else
      raise exception 'Unknown table';
    end if;
  end loop;
end;
$$;

create or replace function public.admin_set_pay(p_slot text, p_phone text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text := public.ub_phone(p_phone);
  status text := case when p_status in ('paid', 'unpaid', 'pending') then p_status else 'unpaid' end;
begin
  perform public.ub_require_admin();
  update public.ub_bookings b
  set body = b.body || jsonb_build_object('pay', coalesce(b.body->'pay', '{}'::jsonb) || jsonb_build_object(
    'status', status,
    'decidedAt', to_jsonb(now())
  ))
  where b.slot_id = p_slot and b.phone_norm = norm;
end;
$$;

create or replace function public.admin_set_request(p_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ub_require_admin();
  if p_status = 'deleted' then
    delete from public.ub_requests where id = p_id;
  else
    update public.ub_requests
    set body = body || jsonb_build_object('status', coalesce(nullif(p_status, ''), 'new'))
    where id = p_id;
  end if;
end;
$$;

create or replace function public.admin_set_student_pin(p_phone text, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  norm text := public.ub_phone(p_phone);
  new_hash text;
begin
  perform public.ub_require_admin();
  if coalesce(p_pin, '') !~ '^[0-9]{6,10}$' then
    return false;
  end if;
  new_hash := extensions.crypt(p_pin, extensions.gen_salt('bf'));
  update public.ub_bookings set pin_hash = new_hash where phone_norm = norm;
  if not found then
    return false;
  end if;
  delete from public.ub_pin_attempts where key = 'stu:' || norm;
  return true;
end;
$$;

create or replace function public.admin_test_notify()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row jsonb;
begin
  perform public.ub_require_admin();
  row := jsonb_build_object(
    'ok', true,
    'sent', false,
    'message', 'No email provider is connected. This attempt was saved in the log.'
  );
  insert into public.ub_notify_log (body) values (row);
  return row;
end;
$$;

create or replace function public.admin_notify_log()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ub_require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'at', created_at) || body order by created_at desc)
    from (select * from public.ub_notify_log order by created_at desc limit 30) q
  ), '[]'::jsonb);
end;
$$;

-- ---------- instructor ----------
create or replace function public.ub_promo_stats(p_inst text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with items as (
    select
      b.body->>'name' as name,
      coalesce(b.body->>'subject', s.body->>'course') as course,
      to_char(s.slot_date, 'YYYY-MM-DD') as date,
      coalesce(public.ub_num(b.body, 'promoPoints'), 0) as points,
      (b.body->'pay' is null or b.body#>>'{pay,status}' = 'paid') as confirmed,
      b.body->>'at' as at
    from public.ub_bookings b
    join public.ub_slots s on s.id = b.slot_id
    where b.body->>'promoInst' = p_inst
    order by b.id desc
    limit 60
  )
  select jsonb_build_object(
    'points', coalesce((select sum(points) from items where confirmed), 0),
    'count', coalesce((select count(*) from items where confirmed), 0),
    'pending', coalesce((select count(*) from items where not confirmed), 0),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'name', name, 'course', course, 'date', date, 'points', points, 'confirmed', confirmed, 'at', at
    )) from items), '[]'::jsonb)
  );
$$;

create or replace function public.inst_get(p_inst text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.ub_instructors%rowtype;
  pin_state text;
begin
  select * into i from public.ub_instructors where id = p_inst;
  if not found then
    return jsonb_build_object('error', 'badpin');
  end if;
  pin_state := public.ub_pin_ok('inst:' || i.id, i.pin_hash, p_pin);
  if pin_state <> '' then
    return jsonb_build_object('error', pin_state);
  end if;
  return jsonb_build_object(
    'settings', public.ub_settings_main(),
    'instructors', jsonb_build_array(public.ub_public_instructor(i.body)),
    'catalog', public.ub_catalog(),
    'slots', coalesce((
      select jsonb_agg(public.ub_full_slot(s) order by s.slot_date, s.slot_time)
      from public.ub_slots s where s.inst_id = i.id
    ), '[]'::jsonb),
    'requests', '[]'::jsonb,
    'me', jsonb_build_object(
      'promo', coalesce(i.body->>'promo', ''),
      'stats', public.ub_promo_stats(i.id)
    )
  );
end;
$$;

create or replace function public.inst_save_slot(p_inst text, p_pin text, p_slot text, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.ub_instructors%rowtype;
  pin_state text;
  clean jsonb;
begin
  select * into i from public.ub_instructors where id = p_inst;
  if not found then
    raise exception 'Not allowed';
  end if;
  pin_state := public.ub_pin_ok('inst:' || i.id, i.pin_hash, p_pin);
  if pin_state <> '' then
    raise exception 'Not allowed';
  end if;
  clean := jsonb_build_object();
  if p_patch ? 'link' then clean := clean || jsonb_build_object('link', coalesce(p_patch->>'link', '')); end if;
  if p_patch ? 'leadMin' then clean := clean || jsonb_build_object('leadMin', public.ub_num(p_patch, 'leadMin')); end if;
  if p_patch ? 'dur' then clean := clean || jsonb_build_object('dur', public.ub_num(p_patch, 'dur')); end if;
  if p_patch ? 'materials' then clean := clean || jsonb_build_object('materials', coalesce(p_patch->'materials', '[]'::jsonb)); end if;
  if p_patch ? 'rec' then clean := clean || jsonb_build_object('rec', p_patch->'rec'); end if;
  update public.ub_slots s
  set body = s.body || clean
  where s.id = p_slot and s.inst_id = i.id;
  if not found then
    raise exception 'Not allowed';
  end if;
end;
$$;

create or replace function public.inst_set_promo(p_inst text, p_pin text, p_promo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.ub_instructors%rowtype;
  pin_state text;
begin
  select * into i from public.ub_instructors where id = p_inst;
  if not found then
    raise exception 'Not allowed';
  end if;
  pin_state := public.ub_pin_ok('inst:' || i.id, i.pin_hash, p_pin);
  if pin_state <> '' then
    raise exception 'Not allowed';
  end if;
  update public.ub_instructors
  set body = body || jsonb_build_object('promo', left(trim(coalesce(p_promo, '')), 30))
  where id = i.id;
end;
$$;

-- ---------- permissions ----------
revoke all on function public.ub_phone(text) from public;
revoke all on function public.ub_num(jsonb, text) from public;
revoke all on function public.is_admin() from public;
revoke all on function public.ub_require_admin() from public;
revoke all on function public.ub_settings_main() from public;
revoke all on function public.ub_taken(text) from public;
revoke all on function public.ub_pin_ok(text, text, text) from public;
revoke all on function public.ub_public_instructor(jsonb) from public;
revoke all on function public.ub_public_slot(public.ub_slots) from public;
revoke all on function public.ub_full_slot(public.ub_slots) from public;
revoke all on function public.ub_catalog() from public;
revoke all on function public.ub_student_slot(public.ub_slots, public.ub_bookings) from public;
revoke all on function public.ub_promo_stats(text) from public;

revoke all on function public.get_public() from public;
revoke all on function public.validate_promo(text) from public;
revoke all on function public.book(text, text, text, text, text, text, text, text, text, integer, text, text, text) from public;
revoke all on function public.get_mine(text, text) from public;
revoke all on function public.my_slot_ids(text, text) from public;
revoke all on function public.cancel_booking(text, text, text) from public;
revoke all on function public.submit_payment(text, text, text, text, text, jsonb, text) from public;
revoke all on function public.submit_request(jsonb) from public;
revoke all on function public.admin_check() from public;
revoke all on function public.admin_get() from public;
revoke all on function public.admin_upsert(text, jsonb) from public;
revoke all on function public.admin_delete(text, jsonb) from public;
revoke all on function public.admin_set_pay(text, text, text) from public;
revoke all on function public.admin_set_request(bigint, text) from public;
revoke all on function public.admin_set_student_pin(text, text) from public;
revoke all on function public.admin_test_notify() from public;
revoke all on function public.admin_notify_log() from public;
revoke all on function public.inst_get(text, text) from public;
revoke all on function public.inst_save_slot(text, text, text, jsonb) from public;
revoke all on function public.inst_set_promo(text, text, text) from public;

grant execute on function public.get_public() to anon, authenticated;
grant execute on function public.validate_promo(text) to anon, authenticated;
grant execute on function public.book(text, text, text, text, text, text, text, text, text, integer, text, text, text) to anon, authenticated;
grant execute on function public.get_mine(text, text) to anon, authenticated;
grant execute on function public.my_slot_ids(text, text) to anon, authenticated;
grant execute on function public.cancel_booking(text, text, text) to anon, authenticated;
grant execute on function public.submit_payment(text, text, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.submit_request(jsonb) to anon, authenticated;
grant execute on function public.inst_get(text, text) to anon, authenticated;
grant execute on function public.inst_save_slot(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.inst_set_promo(text, text, text) to anon, authenticated;

grant execute on function public.admin_check() to authenticated;
grant execute on function public.admin_get() to authenticated;
grant execute on function public.admin_upsert(text, jsonb) to authenticated;
grant execute on function public.admin_delete(text, jsonb) to authenticated;
grant execute on function public.admin_set_pay(text, text, text) to authenticated;
grant execute on function public.admin_set_request(bigint, text) to authenticated;
grant execute on function public.admin_set_student_pin(text, text) to authenticated;
grant execute on function public.admin_test_notify() to authenticated;
grant execute on function public.admin_notify_log() to authenticated;

-- ---------- file storage ----------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('uploads', 'uploads', true, 10485760),
  ('receipts', 'receipts', false, 10485760)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists ub_upload_insert on storage.objects;
drop policy if exists ub_upload_read on storage.objects;
drop policy if exists ub_receipt_read on storage.objects;
drop policy if exists ub_storage_delete on storage.objects;

create policy ub_upload_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id in ('uploads', 'receipts'));

create policy ub_upload_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'uploads');

create policy ub_receipt_read on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.is_admin());

create policy ub_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('uploads', 'receipts') and public.is_admin());
