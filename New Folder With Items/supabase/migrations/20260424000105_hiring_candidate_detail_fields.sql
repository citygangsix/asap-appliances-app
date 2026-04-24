begin;

alter table public.hiring_candidates
  add column if not exists current_job_status text,
  add column if not exists tools_status text,
  add column if not exists vehicle_status text,
  add column if not exists tools_vehicle_summary text,
  add column if not exists appliance_experience_summary text,
  add column if not exists other_work_experience_summary text;

comment on column public.hiring_candidates.current_job_status is
  'What the candidate said about current employment, side work, notice needed, or availability around an existing job.';

comment on column public.hiring_candidates.tools_status is
  'yes/no/unclear status for whether the candidate has their own tools, as extracted from hiring calls.';

comment on column public.hiring_candidates.vehicle_status is
  'yes/no/unclear status for whether the candidate has a reliable vehicle, as extracted from hiring calls.';

comment on column public.hiring_candidates.tools_vehicle_summary is
  'Short summary of tools, vehicle, transportation, mileage, and field-readiness details.';

comment on column public.hiring_candidates.appliance_experience_summary is
  'Specific experience with appliance repair work such as refrigeration, laundry, cooking, sealed systems, diagnostics, warranty, or out-of-warranty repairs.';

comment on column public.hiring_candidates.other_work_experience_summary is
  'Other useful experience mentioned in the call, including AC, HVAC, electrical, installs, sales, warranty networks, dispatch, or unrelated trades.';

commit;
