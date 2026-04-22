begin;

create table if not exists public.twilio_voice_recordings (
  recording_id uuid primary key default gen_random_uuid(),
  linked_communication_id uuid references public.communications(communication_id) on delete set null,
  provider_name text not null default 'twilio',
  provider_account_sid text,
  provider_call_sid text,
  provider_parent_call_sid text,
  provider_recording_sid text not null,
  recording_status text,
  recording_source text,
  recording_track text,
  recording_channels integer,
  recording_duration_seconds integer,
  recording_url text,
  raw_payload jsonb not null default '{}'::jsonb,
  callback_received_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (recording_channels is null or recording_channels > 0),
  check (recording_duration_seconds is null or recording_duration_seconds >= 0)
);

comment on table public.twilio_voice_recordings is
  'Stores Twilio recording-status callback metadata for recorded inbound voice forwards and outbound click-to-call bridges.';

create unique index if not exists twilio_voice_recordings_provider_recording_sid_uidx
  on public.twilio_voice_recordings (provider_recording_sid);

create index if not exists twilio_voice_recordings_provider_call_sid_idx
  on public.twilio_voice_recordings (provider_call_sid);

create index if not exists twilio_voice_recordings_linked_communication_idx
  on public.twilio_voice_recordings (linked_communication_id);

drop trigger if exists set_twilio_voice_recordings_updated_at on public.twilio_voice_recordings;
create trigger set_twilio_voice_recordings_updated_at
before update on public.twilio_voice_recordings
for each row
execute function public.set_updated_at();

commit;
