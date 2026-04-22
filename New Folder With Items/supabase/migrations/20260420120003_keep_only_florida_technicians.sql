begin;

delete from public.technician_payout_invoice_links
where payout_id in (
  select payout_id
  from public.technician_payouts
  where tech_id in (
    select tech_id
    from public.technicians
    where name not in ('Christian Services Ocala', 'Steven Knapp', 'James G.', 'Dexter')
  )
);

delete from public.technician_payouts
where tech_id in (
  select tech_id
  from public.technicians
  where name not in ('Christian Services Ocala', 'Steven Knapp', 'James G.', 'Dexter')
);

delete from public.technicians
where name not in ('Christian Services Ocala', 'Steven Knapp', 'James G.', 'Dexter');

commit;
