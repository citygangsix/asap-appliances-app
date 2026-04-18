begin;

truncate table public.job_timeline_events cascade;
truncate table public.technician_payout_invoice_links cascade;
truncate table public.technician_payouts cascade;
truncate table public.communications cascade;
truncate table public.invoices cascade;
truncate table public.jobs cascade;
truncate table public.technicians cascade;
truncate table public.customers cascade;

insert into public.customers (
  customer_id, name, primary_phone, secondary_phone, email, city, service_area, customer_segment,
  communication_status, last_contact_at, lifetime_value, notes, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000101', 'Renee Walker', '(214) 555-0112', null, 'renee.walker@example.com', 'Plano', 'North Dallas', 'Repeat customer', 'awaiting_callback', '2026-04-16T10:07:00Z', 1860, null, now(), now()),
  ('00000000-0000-0000-0000-000000000102', 'Julian Brooks', '(469) 555-0148', null, 'julian.brooks@example.com', 'Frisco', 'Plano / Frisco', 'Warranty referral', 'clear', '2026-04-16T09:55:00Z', 720, null, now(), now()),
  ('00000000-0000-0000-0000-000000000103', 'Bianca Flores', '(972) 555-0107', null, 'bianca.flores@example.com', 'Dallas', 'Central Dallas', 'New customer', 'unresolved', '2026-04-16T10:37:00Z', 310, null, now(), now()),
  ('00000000-0000-0000-0000-000000000104', 'Sanjay Patel', '(817) 555-0132', null, 'sanjay.patel@example.com', 'Arlington', 'Arlington', 'Maintenance plan', 'unread_message', '2026-04-16T10:12:00Z', 2240, null, now(), now()),
  ('00000000-0000-0000-0000-000000000105', 'Kelly Warren', '(214) 555-0159', null, 'kelly.warren@example.com', 'Irving', 'Irving / Las Colinas', 'Repeat customer', 'unresolved', '2026-04-16T10:06:00Z', 1480, null, now(), now()),
  ('00000000-0000-0000-0000-000000000106', 'Nadia Hart', '(469) 555-0163', null, 'nadia.hart@example.com', 'McKinney', 'North Dallas', 'New customer', 'clear', '2026-04-16T10:22:00Z', 540, null, now(), now());

insert into public.technicians (
  tech_id, name, primary_phone, email, service_area, skills, availability_notes, status_today,
  jobs_completed_this_week, callback_rate_percent, payout_total, gas_reimbursement_total, score, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000201', 'Miguel Santos', '(214) 555-2001', 'miguel.santos@example.com', 'North Dallas', '{"Refrigeration","LG","Samsung"}', 'Open after 3:00 PM', 'en_route', 19, 3.1, 2980, 162, 94, now(), now()),
  ('00000000-0000-0000-0000-000000000202', 'Andre Lewis', '(214) 555-2002', 'andre.lewis@example.com', 'Plano / Frisco', '{"Laundry","Whirlpool","Speed Queen"}', 'Booked until 5:30 PM', 'onsite', 23, 1.9, 3240, 184, 97, now(), now()),
  ('00000000-0000-0000-0000-000000000203', 'Kevin Tran', '(214) 555-2003', 'kevin.tran@example.com', 'Irving / Las Colinas', '{"Cooking","Bosch","GE"}', 'Available now', 'unassigned', 15, 4.7, 2410, 138, 88, now(), now()),
  ('00000000-0000-0000-0000-000000000204', 'Chris Bowman', '(214) 555-2004', 'chris.bowman@example.com', 'Arlington', '{"Dishwashers","Kitchenaid","Electrolux"}', 'Return visit at 2:15 PM', 'late', 17, 2.6, 2760, 149, 91, now(), now());

insert into public.jobs (
  job_id, customer_id, tech_id, appliance_label, appliance_brand, issue_summary, service_address,
  scheduled_start_at, eta_at, eta_window_text, en_route_at, onsite_at, completed_at, canceled_at,
  return_requested_at, return_scheduled_at, lifecycle_status, dispatch_status, payment_status, parts_status,
  communication_status, customer_updated, priority, lateness_minutes, internal_notes, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 'Samsung French Door Refrigerator', 'Samsung', 'Fresh food section warm, fan noise', '4821 Cedar Crest Dr, Plano', '2026-04-16T09:30:00Z', '2026-04-16T09:42:00Z', null, '2026-04-16T09:19:00Z', null, null, null, null, null, 'en_route', 'confirmed', 'parts_due', 'awaiting_payment', 'awaiting_callback', true, 'high', null, 'Quoted evap fan motor and sensor. Customer asked for callback on warranty coverage.', now(), now()),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000202', 'Whirlpool Washer', 'Whirlpool', 'Stops mid-cycle and leaves water in drum', '119 Oak Hollow Ln, Frisco', '2026-04-16T10:15:00Z', null, 'Onsite', null, '2026-04-16T09:41:00Z', null, null, null, null, 'onsite', 'assigned', 'labor_due', 'none_needed', 'clear', true, 'normal', null, 'Drain pump obstruction cleared. Labor invoice ready after final cycle test.', now(), now()),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000103', null, 'GE Oven', 'GE', 'Not heating past 250 degrees', '8711 Meadow Run, Dallas', '2026-04-16T11:00:00Z', null, 'Not set', null, null, null, null, null, null, 'scheduled', 'unassigned', 'none_due', 'quoted', 'unresolved', false, 'high', null, 'Customer requested afternoon visit if possible. Quote sent for bake element.', now(), now()),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000204', 'Bosch Dishwasher', 'Bosch', 'E15 leak code recurring', '2208 Stonegate Ct, Arlington', '2026-04-16T13:15:00Z', null, '26 min late', null, null, null, null, '2026-04-15T16:45:00Z', '2026-04-16T13:15:00Z', 'return_scheduled', 'late', 'partial', 'shipped', 'unread_message', false, 'escalated', 26, 'Customer texted twice. Float switch and seal arriving today.', now(), now()),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000203', 'LG Dryer', 'LG', 'No heat, loud vibration', '603 Beacon Hill Rd, Irving', '2026-04-16T14:00:00Z', '2026-04-16T14:00:00Z', null, null, null, null, null, null, null, 'scheduled', 'assigned', 'failed', 'ready_to_order', 'unresolved', true, 'high', null, 'Parts payment link failed twice. Needs customer reauthorization.', now(), now()),
  ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000201', 'Frigidaire Ice Maker', 'Frigidaire', 'Not producing ice after filter change', '751 Prairie Wind, McKinney', '2026-04-16T15:30:00Z', null, 'Waiting dispatch', null, null, null, null, null, null, 'scheduled', 'escalated', 'parts_paid', 'ordered', 'clear', true, 'escalated', null, 'Window is tight because customer leaves at 5:00 PM. Dispatch decision needed now.', now(), now());

insert into public.invoices (
  invoice_id, invoice_number, job_id, servicing_tech_id, invoice_type, payment_status, issued_on, due_on,
  paid_at, currency_code, total_amount, collected_amount, outstanding_balance, processor_reference,
  payment_failed_at, notes, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000401', 'INV-2042', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'parts_deposit', 'open', '2026-04-16', '2026-04-16', null, 'USD', 420, 0, 420, null, null, null, now(), now()),
  ('00000000-0000-0000-0000-000000000402', 'INV-2048', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000202', 'labor', 'open', '2026-04-16', '2026-04-16', null, 'USD', 285, 0, 285, null, null, null, now(), now()),
  ('00000000-0000-0000-0000-000000000403', 'INV-2055', '00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000204', 'parts_and_labor', 'partial', '2026-04-15', '2026-04-16', null, 'USD', 610, 260, 350, null, null, null, now(), now()),
  ('00000000-0000-0000-0000-000000000404', 'INV-2059', '00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000203', 'parts_deposit', 'failed', '2026-04-16', '2026-04-16', null, 'USD', 390, 0, 390, null, '2026-04-16T10:06:00Z', null, now(), now()),
  ('00000000-0000-0000-0000-000000000405', 'INV-2063', '00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000201', 'parts_payment', 'paid', '2026-04-15', '2026-04-17', '2026-04-15T16:30:00Z', 'USD', 540, 540, 0, null, null, null, now(), now());

insert into public.communications (
  communication_id, customer_id, job_id, invoice_id, communication_channel, direction, communication_status,
  preview_text, transcript_text, extracted_event_summary, from_number, to_number, provider_name,
  provider_message_sid, provider_call_sid, occurred_at, started_at, ended_at, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000401', 'text', 'inbound', 'unresolved', 'Can someone explain if the part is covered under warranty?', 'Customer asked if the evap fan is under warranty. Assistant promised callback after checking model serial coverage.', 'Customer approved part pending warranty clarification', '(214) 555-0112', '(214) 555-1000', 'twilio', null, null, '2026-04-16T10:07:00Z', null, null, now(), now()),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000403', 'call', 'inbound', 'awaiting_callback', 'Customer upset that ETA slipped beyond promised window.', 'Caller wants firm return time because water leak is recurring. Asked if seal shipment arrived.', 'ETA changed and customer requested escalation', '(817) 555-0132', '(214) 555-1000', 'twilio', null, null, '2026-04-16T10:12:00Z', '2026-04-16T10:12:00Z', '2026-04-16T10:19:00Z', now(), now()),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000404', 'text', 'inbound', 'unresolved', 'Payment link keeps failing when I submit card.', 'Customer attempted parts payment twice and both attempts failed. Requested alternate invoice route.', 'Parts payment failed and manual invoice may be needed', '(214) 555-0159', '(214) 555-1000', 'twilio', null, null, '2026-04-16T10:06:00Z', null, null, now(), now()),
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000103', null, null, 'call', 'inbound', 'clear', 'Asked for later technician arrival after 1 PM.', 'Customer can only be home after lunch. No technical change, but schedule preference updated.', 'Availability window changed to afternoon', '(972) 555-0107', '(214) 555-1000', 'twilio', null, null, '2026-04-16T10:37:00Z', '2026-04-16T10:37:00Z', '2026-04-16T10:42:00Z', now(), now());

insert into public.technician_payouts (
  payout_id, tech_id, payout_number, period_start, period_end, payout_status, gross_amount,
  gas_reimbursement_amount, adjustment_amount, note, scheduled_for, paid_at, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000201', 'PAYOUT-1', '2026-04-15', '2026-04-16', 'ready', 420, 0, 0, 'Ready', '2026-04-16T18:00:00Z', '2026-04-16T18:30:00Z', now(), now()),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000202', 'PAYOUT-2', '2026-04-15', '2026-04-16', 'pending', 285, 0, 0, 'Pending labor capture', '2026-04-16T18:00:00Z', null, now(), now()),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000204', 'PAYOUT-3', '2026-04-15', '2026-04-16', 'partial', 260, 0, 0, 'Partial collection', '2026-04-16T18:00:00Z', null, now(), now()),
  ('00000000-0000-0000-0000-000000000604', '00000000-0000-0000-0000-000000000203', 'PAYOUT-4', '2026-04-15', '2026-04-16', 'retry', 203, 0, 0, 'Payment retry', '2026-04-16T18:00:00Z', null, now(), now());

insert into public.technician_payout_invoice_links (
  payout_id, invoice_id, allocated_amount, created_at
) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000401', 210, now()),
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000405', 210, now()),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000402', 285, now()),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000403', 260, now()),
  ('00000000-0000-0000-0000-000000000604', '00000000-0000-0000-0000-000000000404', 203, now());

insert into public.job_timeline_events (
  event_id, job_id, actor_type, actor_label, event_type, event_at, summary, details, metadata, created_at
) values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000301', 'assistant', 'Office assistant', 'parts_requested', '2026-04-16T09:08:00Z', 'Parts quote sent', 'Evap fan motor and sensor quote delivered to customer by text.', '{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000301', 'technician', 'Miguel Santos', 'en_route', '2026-04-16T09:19:00Z', 'Technician en route', 'ETA confirmed at 12 minutes with customer updated.', '{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000302', 'technician', 'Andre Lewis', 'onsite', '2026-04-16T09:41:00Z', 'Technician onsite', 'Drain pump obstruction cleared and final test cycle started.', '{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-000000000303', 'customer', 'Bianca Flores', 'scheduled', '2026-04-16T10:37:00Z', 'Customer requested afternoon window', 'Customer can only be home after 1 PM and asked for callback before assignment.', '{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000000705', '00000000-0000-0000-0000-000000000304', 'dispatch', 'Dispatch board', 'dispatch_updated', '2026-04-16T10:12:00Z', 'Return visit flagged late', 'Seal shipment timing pushed ETA beyond the promised window.', '{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000000706', '00000000-0000-0000-0000-000000000305', 'system', 'Payments', 'payment_requested', '2026-04-16T10:06:00Z', 'Card authorization failed', 'Parts deposit failed twice and the customer requested an alternate invoice route.', '{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000000707', '00000000-0000-0000-0000-000000000306', 'dispatch', 'Dispatch board', 'dispatch_updated', '2026-04-16T10:22:00Z', 'Tight service window escalated', 'Customer leaves at 5 PM, so dispatch needs to lock the route now.', '{}'::jsonb, now());

commit;
