begin;

create table if not exists public.hiring_candidates (
  candidate_id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_phone text,
  email text,
  source text,
  stage text not null default 'contacted',
  trade text,
  city text,
  service_area text,
  availability_summary text,
  payout_expectation_summary text,
  experience_summary text,
  next_step text,
  call_highlights text,
  transcript_text text,
  linked_communication_id uuid references public.communications(communication_id) on delete set null,
  provider_call_sid text,
  raw_analysis jsonb not null default '{}'::jsonb,
  last_contact_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    stage in (
      'contacted',
      'interviewed',
      'trial_scheduled',
      'documents_pending',
      'offered',
      'onboarded',
      'rejected'
    )
  )
);

comment on table public.hiring_candidates is
  'Recruiting CRM candidates captured from hiring conversations, including transcript highlights and structured availability, location, and payout details.';

create unique index if not exists hiring_candidates_primary_phone_uidx
  on public.hiring_candidates (primary_phone)
  where primary_phone is not null;

create unique index if not exists hiring_candidates_provider_call_sid_uidx
  on public.hiring_candidates (provider_call_sid)
  where provider_call_sid is not null;

create index if not exists hiring_candidates_last_contact_at_idx
  on public.hiring_candidates (last_contact_at desc);

drop trigger if exists set_hiring_candidates_updated_at on public.hiring_candidates;
create trigger set_hiring_candidates_updated_at
before update on public.hiring_candidates
for each row
execute function public.set_updated_at();

commit;
