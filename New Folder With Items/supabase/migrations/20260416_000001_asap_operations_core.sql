-- ASAP Operations CRM
-- Core relational schema for Supabase/Postgres.
-- Frontend remains mock-first; this file prepares normalized database objects only.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

do $$
begin
  create type public.job_lifecycle_status as enum (
    'new',
    'scheduled',
    'en_route',
    'onsite',
    'paused',
    'return_scheduled',
    'completed',
    'canceled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.job_dispatch_status as enum (
    'unassigned',
    'assigned',
    'confirmed',
    'late',
    'escalated'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.job_payment_status as enum (
    'none_due',
    'parts_due',
    'parts_paid',
    'labor_due',
    'labor_paid',
    'partial',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.job_parts_status as enum (
    'none_needed',
    'quoted',
    'awaiting_payment',
    'ready_to_order',
    'ordered',
    'shipped',
    'delivered',
    'installed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.communication_status as enum (
    'clear',
    'awaiting_callback',
    'unread_message',
    'unresolved'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.communication_channel as enum (
    'text',
    'call'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.communication_direction as enum (
    'inbound',
    'outbound'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.invoice_type as enum (
    'parts_deposit',
    'labor',
    'parts_and_labor',
    'parts_payment'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.invoice_payment_status as enum (
    'draft',
    'open',
    'partial',
    'paid',
    'failed',
    'void'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.job_priority as enum (
    'normal',
    'high',
    'escalated'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.technician_status_today as enum (
    'unassigned',
    'en_route',
    'onsite',
    'late'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.timeline_actor_type as enum (
    'assistant',
    'technician',
    'dispatch',
    'system',
    'customer'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.timeline_event_type as enum (
    'job_created',
    'scheduled',
    'tech_assigned',
    'dispatch_updated',
    'communication_logged',
    'eta_updated',
    'en_route',
    'onsite',
    'parts_requested',
    'parts_ordered',
    'payment_requested',
    'payment_received',
    'return_scheduled',
    'completed',
    'canceled',
    'note_added'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payout_status as enum (
    'ready',
    'pending',
    'partial',
    'retry'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.customers (
  customer_id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_phone text not null,
  secondary_phone text,
  email text,
  city text not null,
  service_area text not null,
  customer_segment text not null,
  communication_status public.communication_status not null default 'clear',
  last_contact_at timestamptz,
  lifetime_value numeric(12, 2) not null default 0 check (lifetime_value >= 0),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.customers is
  'CRM customer accounts. Maps frontend Customer to canonical contact, service area, and communication state fields; lastContactLabel should be derived from last_contact_at.';

create table if not exists public.technicians (
  tech_id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_phone text,
  email text,
  service_area text not null,
  skills text[] not null default '{}',
  availability_notes text,
  status_today public.technician_status_today not null default 'unassigned',
  jobs_completed_this_week integer not null default 0 check (jobs_completed_this_week >= 0),
  callback_rate_percent numeric(5, 2) not null default 0 check (callback_rate_percent >= 0 and callback_rate_percent <= 100),
  payout_total numeric(12, 2) not null default 0 check (payout_total >= 0),
  gas_reimbursement_total numeric(12, 2) not null default 0 check (gas_reimbursement_total >= 0),
  score integer not null default 0 check (score >= 0 and score <= 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.technicians is
  'Technician roster and scorecard metrics. Maps frontend Technician; availabilityLabel should be derived from or backed by availability_notes until a fuller scheduling model exists.';

create table if not exists public.jobs (
  job_id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(customer_id) on delete restrict,
  tech_id uuid references public.technicians(tech_id) on delete set null,
  appliance_label text not null,
  appliance_brand text,
  issue_summary text not null,
  service_address text not null,
  scheduled_start_at timestamptz not null,
  eta_at timestamptz,
  eta_window_text text,
  en_route_at timestamptz,
  onsite_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  return_requested_at timestamptz,
  return_scheduled_at timestamptz,
  lifecycle_status public.job_lifecycle_status not null default 'new',
  dispatch_status public.job_dispatch_status not null default 'unassigned',
  payment_status public.job_payment_status not null default 'none_due',
  parts_status public.job_parts_status not null default 'none_needed',
  communication_status public.communication_status not null default 'clear',
  customer_updated boolean not null default false,
  priority public.job_priority not null default 'normal',
  lateness_minutes integer check (lateness_minutes is null or lateness_minutes >= 0),
  internal_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.jobs is
  'Service jobs and operational state machine. Maps frontend Job; scheduledStartLabel and etaLabel must be derived from canonical timestamptz fields scheduled_start_at and eta_at, with eta_window_text only as an optional human override.';

create table if not exists public.invoices (
  invoice_id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  job_id uuid not null references public.jobs(job_id) on delete restrict,
  servicing_tech_id uuid references public.technicians(tech_id) on delete set null,
  invoice_type public.invoice_type not null,
  payment_status public.invoice_payment_status not null default 'open',
  issued_on date not null,
  due_on date,
  paid_at timestamptz,
  currency_code char(3) not null default 'USD',
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  collected_amount numeric(12, 2) not null default 0 check (collected_amount >= 0),
  outstanding_balance numeric(12, 2) not null check (outstanding_balance >= 0),
  processor_reference text,
  payment_failed_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (collected_amount <= total_amount),
  check (outstanding_balance = total_amount - collected_amount),
  check (due_on is null or due_on >= issued_on)
);

comment on table public.invoices is
  'Billable records for a job. Maps frontend Invoice, but normalized so invoices belong to jobs rather than storing both job_id and customer_id; job_id is intentionally required because detached invoices are not part of the current domain model.';

create table if not exists public.communications (
  communication_id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(customer_id) on delete restrict,
  job_id uuid references public.jobs(job_id) on delete set null,
  invoice_id uuid references public.invoices(invoice_id) on delete set null,
  communication_channel public.communication_channel not null,
  direction public.communication_direction not null,
  communication_status public.communication_status not null default 'clear',
  preview_text text not null,
  transcript_text text,
  extracted_event_summary text,
  from_number text,
  to_number text,
  provider_name text,
  provider_message_sid text,
  provider_call_sid text,
  occurred_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (provider_message_sid is null or communication_channel = 'text'),
  check (provider_call_sid is null or communication_channel = 'call'),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

comment on table public.communications is
  'Customer communication log for calls and texts. Maps frontend Communication; linkedJobId becomes nullable job_id so unmatched calls and texts can exist before triage, and communication timestamps should come from occurred_at or started_at instead of display labels.';

create table if not exists public.technician_payouts (
  payout_id uuid primary key default gen_random_uuid(),
  tech_id uuid not null references public.technicians(tech_id) on delete restrict,
  payout_number text unique,
  period_start date not null,
  period_end date not null,
  payout_status public.payout_status not null default 'pending',
  gross_amount numeric(12, 2) not null default 0 check (gross_amount >= 0),
  gas_reimbursement_amount numeric(12, 2) not null default 0 check (gas_reimbursement_amount >= 0),
  adjustment_amount numeric(12, 2) not null default 0,
  net_amount numeric(12, 2) generated always as (
    gross_amount + gas_reimbursement_amount + adjustment_amount
  ) stored,
  note text,
  scheduled_for timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (period_end >= period_start)
);

comment on table public.technician_payouts is
  'Technician payout batches. Maps frontend TechnicianPayout summary records; linked invoices are normalized through technician_payout_invoice_links instead of storing invoiceIds arrays.';

create table if not exists public.technician_payout_invoice_links (
  payout_id uuid not null references public.technician_payouts(payout_id) on delete cascade,
  invoice_id uuid not null references public.invoices(invoice_id) on delete restrict,
  allocated_amount numeric(12, 2) not null check (allocated_amount > 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (payout_id, invoice_id)
);

comment on table public.technician_payout_invoice_links is
  'Join table linking payout batches to the invoices that funded them. Replaces the denormalized frontend invoiceIds array with relational rows.';

create table if not exists public.job_timeline_events (
  event_id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(job_id) on delete cascade,
  actor_type public.timeline_actor_type not null,
  actor_label text not null,
  event_type public.timeline_event_type not null,
  event_at timestamptz not null,
  summary text not null,
  details text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.job_timeline_events is
  'Immutable operational event log for each job. Maps frontend JobTimelineEvent; eventAtLabel should be derived from event_at and event_type is a closed enum so new event types require an explicit migration instead of ad hoc junk values.';

create index if not exists customers_name_idx on public.customers (name);
create index if not exists customers_primary_phone_idx on public.customers (primary_phone);
create index if not exists customers_communication_status_idx on public.customers (communication_status);
create index if not exists customers_last_contact_at_idx on public.customers (last_contact_at desc);

create index if not exists technicians_name_idx on public.technicians (name);
create index if not exists technicians_status_today_idx on public.technicians (status_today);
create index if not exists technicians_service_area_idx on public.technicians (service_area);
create index if not exists technicians_skills_gin_idx on public.technicians using gin (skills);

create index if not exists jobs_customer_id_idx on public.jobs (customer_id);
create index if not exists jobs_tech_id_idx on public.jobs (tech_id);
create index if not exists jobs_scheduled_start_at_idx on public.jobs (scheduled_start_at);
create index if not exists jobs_lifecycle_dispatch_idx on public.jobs (lifecycle_status, dispatch_status);
create index if not exists jobs_payment_parts_idx on public.jobs (payment_status, parts_status);
create index if not exists jobs_communication_status_idx on public.jobs (communication_status);
create index if not exists jobs_priority_idx on public.jobs (priority);

create index if not exists invoices_job_id_idx on public.invoices (job_id);
create index if not exists invoices_servicing_tech_id_idx on public.invoices (servicing_tech_id);
create index if not exists invoices_payment_status_idx on public.invoices (payment_status);
create index if not exists invoices_invoice_type_idx on public.invoices (invoice_type);
create index if not exists invoices_due_on_idx on public.invoices (due_on);
create index if not exists invoices_issued_on_idx on public.invoices (issued_on);

create index if not exists communications_customer_id_occurred_at_idx on public.communications (customer_id, occurred_at desc);
create index if not exists communications_job_id_occurred_at_idx on public.communications (job_id, occurred_at desc);
create index if not exists communications_invoice_id_idx on public.communications (invoice_id);
create index if not exists communications_status_idx on public.communications (communication_status);
create index if not exists communications_channel_idx on public.communications (communication_channel);
create unique index if not exists communications_provider_message_sid_uidx
  on public.communications (provider_message_sid)
  where provider_message_sid is not null;
create unique index if not exists communications_provider_call_sid_uidx
  on public.communications (provider_call_sid)
  where provider_call_sid is not null;

create index if not exists technician_payouts_tech_id_idx on public.technician_payouts (tech_id);
create index if not exists technician_payouts_status_idx on public.technician_payouts (payout_status);
create index if not exists technician_payouts_period_idx on public.technician_payouts (period_start, period_end);
create index if not exists technician_payouts_paid_at_idx on public.technician_payouts (paid_at);

create index if not exists technician_payout_invoice_links_invoice_id_idx
  on public.technician_payout_invoice_links (invoice_id);

create index if not exists job_timeline_events_job_id_event_at_idx
  on public.job_timeline_events (job_id, event_at desc);
create index if not exists job_timeline_events_actor_type_idx on public.job_timeline_events (actor_type);
create index if not exists job_timeline_events_event_type_idx on public.job_timeline_events (event_type);

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

drop trigger if exists set_technicians_updated_at on public.technicians;
create trigger set_technicians_updated_at
before update on public.technicians
for each row
execute function public.set_updated_at();

drop trigger if exists set_jobs_updated_at on public.jobs;
create trigger set_jobs_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

drop trigger if exists set_communications_updated_at on public.communications;
create trigger set_communications_updated_at
before update on public.communications
for each row
execute function public.set_updated_at();

drop trigger if exists set_technician_payouts_updated_at on public.technician_payouts;
create trigger set_technician_payouts_updated_at
before update on public.technician_payouts
for each row
execute function public.set_updated_at();

create or replace view public.revenue_summary_daily as
select
  i.issued_on as summary_date,
  sum(i.total_amount) as invoiced_amount,
  sum(i.collected_amount) as collected_amount,
  sum(i.outstanding_balance) as outstanding_amount
from public.invoices i
group by i.issued_on;

comment on view public.revenue_summary_daily is
  'Computed revenue summary view. Replaces a stored revenue_summaries table; frontend RevenueSummary records should be derived from invoice aggregates or reporting views like this one.';

commit;
