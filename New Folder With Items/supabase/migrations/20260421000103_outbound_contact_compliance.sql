alter table public.customers
  add column if not exists sms_opted_out_at timestamptz,
  add column if not exists voice_opted_out_at timestamptz,
  add column if not exists auto_contact_cooldown_until timestamptz;

create table if not exists public.outbound_contact_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(customer_id) on delete set null,
  communication_id uuid references public.communications(communication_id) on delete set null,
  trigger_source text not null,
  is_automated boolean not null default false,
  attempt_channel public.communication_channel not null,
  customer_number text not null,
  provider_call_sid text,
  provider_parent_call_sid text,
  provider_message_sid text,
  outcome text not null,
  outcome_detail text,
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  cooldown_applied_until timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (provider_message_sid is null or attempt_channel = 'text'),
  check (
    (provider_call_sid is null and provider_parent_call_sid is null)
    or attempt_channel = 'call'
  )
);

create index if not exists outbound_contact_attempts_customer_requested_idx
  on public.outbound_contact_attempts (customer_id, requested_at desc);

create index if not exists outbound_contact_attempts_number_requested_idx
  on public.outbound_contact_attempts (customer_number, requested_at desc);

create unique index if not exists outbound_contact_attempts_provider_message_sid_uidx
  on public.outbound_contact_attempts (provider_message_sid)
  where provider_message_sid is not null;

create trigger set_outbound_contact_attempts_updated_at
before update on public.outbound_contact_attempts
for each row
execute function public.set_updated_at();
