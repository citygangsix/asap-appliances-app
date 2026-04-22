begin;

alter table public.communications
  add column if not exists call_highlights text,
  add column if not exists call_summary_sections jsonb,
  add column if not exists transcription_status text,
  add column if not exists transcription_error text,
  add column if not exists transcribed_at timestamptz;

alter table public.communications
  drop constraint if exists communications_transcription_status_check;

alter table public.communications
  add constraint communications_transcription_status_check
  check (
    transcription_status is null
    or transcription_status in ('pending', 'completed', 'failed')
  );

alter table public.unmatched_inbound_communications
  add column if not exists call_highlights text,
  add column if not exists call_summary_sections jsonb,
  add column if not exists transcription_status text,
  add column if not exists transcription_error text,
  add column if not exists transcribed_at timestamptz;

alter table public.unmatched_inbound_communications
  drop constraint if exists unmatched_inbound_transcription_status_check;

alter table public.unmatched_inbound_communications
  add constraint unmatched_inbound_transcription_status_check
  check (
    transcription_status is null
    or transcription_status in ('pending', 'completed', 'failed')
  );

alter table public.twilio_voice_recordings
  add column if not exists transcript_text text,
  add column if not exists call_headline text,
  add column if not exists call_highlights text,
  add column if not exists call_summary_sections jsonb,
  add column if not exists transcription_status text,
  add column if not exists transcription_error text,
  add column if not exists transcribed_at timestamptz;

alter table public.twilio_voice_recordings
  drop constraint if exists twilio_voice_recordings_transcription_status_check;

alter table public.twilio_voice_recordings
  add constraint twilio_voice_recordings_transcription_status_check
  check (
    transcription_status is null
    or transcription_status in ('pending', 'completed', 'failed')
  );

create index if not exists communications_transcription_status_idx
  on public.communications (transcription_status)
  where communication_channel = 'call';

create index if not exists unmatched_inbound_transcription_status_idx
  on public.unmatched_inbound_communications (transcription_status)
  where communication_channel = 'call';

commit;
