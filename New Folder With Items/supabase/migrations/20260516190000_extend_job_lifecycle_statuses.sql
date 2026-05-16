-- Extend job lifecycle states so closed diagnostic-only and pending repair work can be stored explicitly.

alter type public.job_lifecycle_status add value if not exists 'pending_installation';
alter type public.job_lifecycle_status add value if not exists 'pending_repair';
alter type public.job_lifecycle_status add value if not exists 'declined';
alter type public.job_lifecycle_status add value if not exists 'diagnostic_paid_declined_repair';
alter type public.job_lifecycle_status add value if not exists 'closed';
alter type public.job_lifecycle_status add value if not exists 'no_work_needed';
alter type public.job_lifecycle_status add value if not exists 'paid_closed';
