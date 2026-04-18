begin;

create table if not exists public.unmatched_inbound_communications (
  unmatched_communication_id uuid primary key default gen_random_uuid(),
  communication_channel public.communication_channel not null,
  direction public.communication_direction not null default 'inbound',
  communication_status public.communication_status not null,
  match_status text not null,
  resolution_status text not null default 'pending',
  from_number text,
  to_number text,
  preview_text text not null,
  transcript_text text,
  provider_name text not null default 'twilio',
  provider_message_sid text,
  provider_call_sid text,
  raw_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  ended_at timestamptz,
  linked_customer_id uuid references public.customers(customer_id) on delete set null,
  linked_job_id uuid references public.jobs(job_id) on delete set null,
  linked_communication_id uuid references public.communications(communication_id) on delete set null,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (match_status in ('missing_phone', 'not_found', 'ambiguous')),
  check (resolution_status in ('pending', 'linked', 'ignored')),
  check (provider_message_sid is null or communication_channel = 'text'),
  check (provider_call_sid is null or communication_channel = 'call'),
  check (ended_at is null or started_at is null or ended_at >= started_at),
  check (
    (resolution_status = 'pending' and resolved_at is null)
    or (resolution_status in ('linked', 'ignored') and resolved_at is not null)
  ),
  check (
    resolution_status <> 'linked'
    or (linked_customer_id is not null and linked_communication_id is not null)
  )
);

comment on table public.unmatched_inbound_communications is
  'Holding queue for inbound Twilio calls and texts that cannot be written to communications because no unique customer match exists yet. Keeps the raw inbound event reviewable until office staff link it to a real customer.';

create index if not exists unmatched_inbound_resolution_status_occurred_at_idx
  on public.unmatched_inbound_communications (resolution_status, occurred_at desc);

create index if not exists unmatched_inbound_match_status_idx
  on public.unmatched_inbound_communications (match_status);

create index if not exists unmatched_inbound_linked_customer_idx
  on public.unmatched_inbound_communications (linked_customer_id);

create unique index if not exists unmatched_inbound_provider_message_sid_uidx
  on public.unmatched_inbound_communications (provider_message_sid)
  where provider_message_sid is not null;

create unique index if not exists unmatched_inbound_provider_call_sid_uidx
  on public.unmatched_inbound_communications (provider_call_sid)
  where provider_call_sid is not null;

drop trigger if exists set_unmatched_inbound_updated_at on public.unmatched_inbound_communications;
create trigger set_unmatched_inbound_updated_at
before update on public.unmatched_inbound_communications
for each row
execute function public.set_updated_at();

commit;
