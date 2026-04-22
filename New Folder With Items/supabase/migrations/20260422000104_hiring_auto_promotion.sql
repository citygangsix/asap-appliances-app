begin;

alter table public.hiring_candidates
  add column if not exists structured_start_date date,
  add column if not exists availability_days text[] not null default '{}',
  add column if not exists availability_time_preferences text[] not null default '{}',
  add column if not exists promoted_tech_id uuid references public.technicians(tech_id) on delete set null,
  add column if not exists promoted_at timestamptz;

alter table public.technicians
  add column if not exists hire_start_date date,
  add column if not exists availability_days text[] not null default '{}',
  add column if not exists availability_time_preferences text[] not null default '{}';

create index if not exists hiring_candidates_promoted_tech_id_idx
  on public.hiring_candidates (promoted_tech_id)
  where promoted_tech_id is not null;

commit;
