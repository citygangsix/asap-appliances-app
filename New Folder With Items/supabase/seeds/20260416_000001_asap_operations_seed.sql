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
  ('00000000-0000-0000-0000-000000000101', 'Renee Walker', '(352) 555-0112', null, 'renee.walker@example.com', 'Ocala', 'Marion County', 'Repeat customer', 'clear', '2026-04-16T10:07:00Z', 1860, null, now(), now()),
  ('00000000-0000-0000-0000-000000000102', 'Julian Brooks', '(727) 555-0148', null, 'julian.brooks@example.com', 'Holiday', 'Pasco County', 'Warranty referral', 'clear', '2026-04-16T09:55:00Z', 720, null, now(), now()),
  ('00000000-0000-0000-0000-000000000103', 'Bianca Flores', '(305) 555-0107', null, 'bianca.flores@example.com', 'Miami', 'Miami-Dade County', 'New customer', 'clear', '2026-04-16T10:37:00Z', 310, null, now(), now()),
  ('00000000-0000-0000-0000-000000000104', 'Sanjay Patel', '(954) 555-0132', null, 'sanjay.patel@example.com', 'Fort Lauderdale', 'Broward County', 'Maintenance plan', 'clear', '2026-04-16T10:12:00Z', 2240, null, now(), now()),
  ('00000000-0000-0000-0000-000000000105', 'Kelly Warren', '(727) 555-0159', null, 'kelly.warren@example.com', 'St. Petersburg', 'Pinellas County', 'Repeat customer', 'clear', '2026-04-16T10:06:00Z', 1480, null, now(), now()),
  ('00000000-0000-0000-0000-000000000106', 'Nadia Hart', '(561) 555-0163', null, 'nadia.hart@example.com', 'Boca Raton', 'Palm Beach County', 'New customer', 'clear', '2026-04-16T10:22:00Z', 540, null, now(), now());

insert into public.technicians (
  tech_id, name, primary_phone, email, service_area, service_zip_codes, skills, availability_notes, status_today,
  jobs_completed_this_week, callback_rate_percent, payout_total, gas_reimbursement_total, score, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000205', 'Christian Services Ocala', '239-595-2555', null, 'Ocala / Marion County', ARRAY['32702','32113','32134','32179','32182','32183','32192','32195','32617','32664','32681','32686','34420','34421','34430','34431','34432','34470','34471','34472','34473','34474','34475','34476','34477','34478','34479','34480','34481','34482','34483','34488','34489','34491','34492']::text[], '{"Refrigeration","Laundry","Cooking"}', 'Florida coverage by ZIP', 'en_route', 19, 3.1, 2980, 162, 90, now(), now()),
  ('00000000-0000-0000-0000-000000000206', 'Steven Knapp', '727-916-2787', null, 'Holiday / Tampa Bay', ARRAY['33510','33511','33523','33525','33527','33534','33540','33541','33542','33543','33544','33545','33547','33548','33549','33556','33558','33559','33563','33565','33566','33567','33569','33570','33572','33573','33576','33578','33579','33584','33592','33594','33596','33597','33598','33602','33603','33604','33605','33606','33607','33609','33610','33611','33612','33613','33614','33615','33616','33617','33618','33619','33621','33624','33625','33626','33629','33634','33635','33637','33647','33701','33702','33703','33704','33705','33706','33707','33708','33709','33710','33711','33712','33713','33714','33715','33716','33730','33755','33756','33759','33760','33761','33762','33763','33764','33765','33767','33770','33771','33772','33773','33774','33776','33777','33778','33781','33782','33785','33786','34601','34602','34604','34606','34607','34608','34609','34610','34613','34614','34637','34638','34639','34652','34653','34654','34655','34667','34668','34669','34677','34683','34684','34685','34688','34689','34690','34691','34695','34698']::text[], '{"St. Pete","Tampa","Hillsborough County","Hernando County"}', 'Florida coverage by ZIP', 'onsite', 23, 1.9, 3240, 184, 92, now(), now()),
  ('00000000-0000-0000-0000-000000000207', 'James G.', '786-294-7044', null, 'Hialeah / Miami and Broward', ARRAY['33004','33009','33010','33012','33013','33014','33015','33016','33018','33019','33020','33021','33023','33024','33025','33026','33027','33028','33029','33030','33031','33032','33033','33034','33035','33054','33055','33056','33060','33062','33063','33064','33065','33066','33067','33068','33069','33071','33073','33076','33109','33122','33125','33126','33127','33128','33129','33130','33131','33132','33133','33134','33135','33136','33137','33138','33139','33140','33141','33142','33143','33144','33145','33146','33147','33149','33150','33154','33155','33156','33157','33158','33160','33161','33162','33165','33166','33167','33168','33169','33170','33172','33173','33174','33175','33176','33177','33178','33179','33180','33181','33182','33183','33184','33185','33186','33187','33189','33190','33193','33194','33196','33301','33304','33305','33306','33308','33309','33311','33312','33313','33314','33315','33316','33317','33319','33321','33322','33323','33324','33325','33326','33327','33328','33330','33331','33332','33334','33351','33441','33442']::text[], '{"Miami","Broward County"}', 'Florida coverage by ZIP', 'unassigned', 15, 4.7, 2410, 138, 89, now(), now()),
  ('00000000-0000-0000-0000-000000000208', 'Dexter', '954-288-6688', null, 'Fort Lauderdale / Broward County', ARRAY['33004','33009','33019','33020','33021','33023','33024','33025','33026','33027','33028','33029','33060','33062','33063','33064','33065','33066','33067','33068','33069','33071','33073','33076','33301','33304','33305','33306','33308','33309','33311','33312','33313','33314','33315','33316','33317','33319','33321','33322','33323','33324','33325','33326','33327','33328','33330','33331','33332','33334','33351','33441','33442']::text[], '{"Fort Lauderdale","Broward County"}', 'Florida coverage by ZIP', 'late', 17, 2.6, 2760, 149, 93, now(), now());

insert into public.jobs (
  job_id, customer_id, tech_id, appliance_label, appliance_brand, issue_summary, service_address,
  scheduled_start_at, eta_at, eta_window_text, en_route_at, onsite_at, completed_at, canceled_at,
  return_requested_at, return_scheduled_at, lifecycle_status, dispatch_status, payment_status, parts_status,
  communication_status, customer_updated, priority, lateness_minutes, internal_notes, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000205', 'Samsung French Door Refrigerator', 'Samsung', 'Fresh food section warm, fan noise', '4821 Cedar Crest Dr, Ocala, FL 34470', '2026-04-16T09:30:00Z', '2026-04-16T09:42:00Z', null, '2026-04-16T09:19:00Z', null, '2026-04-16T10:45:00Z', null, null, null, 'completed', 'confirmed', 'parts_paid', 'installed', 'clear', true, 'normal', null, 'Past customer. Repair was completed and the invoice was closed.', now(), now()),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000206', 'Whirlpool Washer', 'Whirlpool', 'Stops mid-cycle and leaves water in drum', '119 Oak Hollow Ln, Holiday, FL 34691', '2026-04-16T10:15:00Z', null, 'Completed', null, '2026-04-16T09:41:00Z', '2026-04-16T11:10:00Z', null, null, null, 'completed', 'confirmed', 'labor_paid', 'none_needed', 'clear', true, 'normal', null, 'Diagnostic was paid and the customer declined additional repair work.', now(), now()),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000103', null, 'GE Oven', 'GE', 'Not heating past 250 degrees', '8711 Meadow Run, Miami, FL 33142', '2026-04-16T11:00:00Z', null, 'Completed', null, null, '2026-04-16T12:05:00Z', null, null, null, 'completed', 'unassigned', 'labor_paid', 'quoted', 'clear', true, 'normal', null, 'Diagnostic was paid. Customer did not move forward with the quoted oven repair.', now(), now()),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000208', 'Bosch Dishwasher', 'Bosch', 'E15 leak code recurring', '2208 Stonegate Ct, Fort Lauderdale, FL 33301', '2026-04-16T13:15:00Z', null, 'Completed', null, null, '2026-04-16T14:30:00Z', null, null, '2026-04-16T13:15:00Z', 'completed', 'confirmed', 'labor_paid', 'installed', 'clear', true, 'normal', null, 'Return visit was completed and the customer account is closed.', now(), now()),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000207', 'LG Dryer', 'LG', 'No heat, loud vibration', '603 Beacon Hill Rd, St. Petersburg, FL 33701', '2026-04-16T14:00:00Z', '2026-04-16T14:00:00Z', 'Completed', null, null, '2026-04-16T15:15:00Z', null, null, null, 'completed', 'confirmed', 'labor_paid', 'none_needed', 'clear', true, 'normal', null, 'Diagnostic was paid and the customer declined the repair estimate.', now(), now()),
  ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000205', 'Frigidaire Ice Maker', 'Frigidaire', 'Not producing ice after filter change', '751 Prairie Wind, Boca Raton, FL 33432', '2026-04-16T15:30:00Z', null, 'Completed', null, null, '2026-04-16T16:20:00Z', null, null, null, 'completed', 'confirmed', 'parts_paid', 'installed', 'clear', true, 'normal', null, 'Parts were installed and the invoice was paid. Keep as past customer history only.', now(), now());

insert into public.invoices (
  invoice_id, invoice_number, job_id, servicing_tech_id, invoice_type, payment_status, issued_on, due_on,
  paid_at, currency_code, total_amount, collected_amount, outstanding_balance, processor_reference,
  payment_failed_at, notes, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000401', 'INV-2042', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000205', 'parts_deposit', 'paid', '2026-04-16', '2026-04-16', '2026-04-16T10:45:00Z', 'USD', 420, 420, 0, null, null, null, now(), now()),
  ('00000000-0000-0000-0000-000000000402', 'INV-2048', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000206', 'labor', 'paid', '2026-04-16', '2026-04-16', '2026-04-16T11:10:00Z', 'USD', 285, 285, 0, null, null, null, now(), now()),
  ('00000000-0000-0000-0000-000000000406', 'INV-2051', '00000000-0000-0000-0000-000000000303', null, 'labor', 'paid', '2026-04-16', '2026-04-16', '2026-04-16T12:05:00Z', 'USD', 125, 125, 0, null, null, 'Diagnostic paid; repair declined.', now(), now()),
  ('00000000-0000-0000-0000-000000000403', 'INV-2055', '00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000208', 'parts_and_labor', 'paid', '2026-04-15', '2026-04-16', '2026-04-16T14:30:00Z', 'USD', 610, 610, 0, null, null, null, now(), now()),
  ('00000000-0000-0000-0000-000000000404', 'INV-2059', '00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000207', 'labor', 'paid', '2026-04-16', '2026-04-16', '2026-04-16T15:15:00Z', 'USD', 125, 125, 0, null, null, 'Diagnostic paid; repair declined.', now(), now()),
  ('00000000-0000-0000-0000-000000000405', 'INV-2063', '00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000205', 'parts_payment', 'paid', '2026-04-15', '2026-04-17', '2026-04-15T16:30:00Z', 'USD', 540, 540, 0, null, null, null, now(), now());

insert into public.communications (
  communication_id, customer_id, job_id, invoice_id, communication_channel, direction, communication_status,
  preview_text, transcript_text, extracted_event_summary, from_number, to_number, provider_name,
  provider_message_sid, provider_call_sid, occurred_at, started_at, ended_at, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000401', 'text', 'inbound', 'clear', 'Can someone explain if the part is covered under warranty?', 'Customer asked if the evap fan is under warranty. Assistant promised callback after checking model serial coverage.', 'Repair completed and invoice closed', '(352) 555-0112', '(352) 555-1000', 'twilio', null, null, '2026-04-16T10:07:00Z', null, null, now(), now()),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000403', 'call', 'inbound', 'clear', 'Customer upset that ETA slipped beyond promised window.', 'Caller wants firm return time because water leak is recurring. Asked if seal shipment arrived.', 'Return completed and invoice closed', '(954) 555-0132', '(954) 555-1000', 'twilio', null, null, '2026-04-16T10:12:00Z', '2026-04-16T10:12:00Z', '2026-04-16T10:19:00Z', now(), now()),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000404', 'text', 'inbound', 'clear', 'Payment link keeps failing when I submit card.', 'Customer attempted diagnostic payment and declined additional repair.', 'Diagnostic paid and repair declined', '(727) 555-0159', '(727) 555-1000', 'twilio', null, null, '2026-04-16T10:06:00Z', null, null, now(), now()),
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000406', 'call', 'inbound', 'clear', 'Diagnostic paid; customer declined oven repair.', 'Diagnostic was completed and paid. Customer declined the quoted oven repair.', 'Diagnostic-only job closed', '(305) 555-0107', '(305) 555-1000', 'twilio', null, null, '2026-04-16T10:37:00Z', '2026-04-16T10:37:00Z', '2026-04-16T10:42:00Z', now(), now());

insert into public.technician_payouts (
  payout_id, tech_id, payout_number, period_start, period_end, payout_status, gross_amount,
  gas_reimbursement_amount, adjustment_amount, note, scheduled_for, paid_at, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000205', 'PAYOUT-1', '2026-04-15', '2026-04-16', 'ready', 420, 0, 0, 'Ready', '2026-04-16T18:00:00Z', '2026-04-16T18:30:00Z', now(), now()),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000206', 'PAYOUT-2', '2026-04-15', '2026-04-16', 'pending', 285, 0, 0, 'Pending labor capture', '2026-04-16T18:00:00Z', null, now(), now()),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000208', 'PAYOUT-3', '2026-04-15', '2026-04-16', 'partial', 260, 0, 0, 'Partial collection', '2026-04-16T18:00:00Z', null, now(), now()),
  ('00000000-0000-0000-0000-000000000604', '00000000-0000-0000-0000-000000000207', 'PAYOUT-4', '2026-04-15', '2026-04-16', 'retry', 203, 0, 0, 'Payment retry', '2026-04-16T18:00:00Z', null, now(), now());

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
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000301', 'assistant', 'Office assistant', 'completed', '2026-04-16T10:45:00Z', 'Repair completed', 'Evap fan motor and sensor repair completed. Invoice paid and job closed.', '{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000301', 'technician', 'Christian Services Ocala', 'payment_received', '2026-04-16T10:45:00Z', 'Invoice closed', 'Customer paid the final invoice after completion.', '{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000302', 'technician', 'Steven Knapp', 'completed', '2026-04-16T11:10:00Z', 'Diagnostic closed', 'Diagnostic was paid and the customer declined additional repair work.', '{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-000000000303', 'customer', 'Bianca Flores', 'completed', '2026-04-16T12:05:00Z', 'Diagnostic-only job closed', 'Diagnostic was paid. Customer declined the quoted oven repair.', '{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000000705', '00000000-0000-0000-0000-000000000304', 'dispatch', 'Dispatch board', 'completed', '2026-04-16T14:30:00Z', 'Return visit completed', 'Replacement seal was installed and the customer account was closed.', '{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000000706', '00000000-0000-0000-0000-000000000305', 'system', 'Payments', 'completed', '2026-04-16T15:15:00Z', 'Diagnostic closed', 'Diagnostic was paid and the customer declined the dryer repair estimate.', '{}'::jsonb, now()),
  ('00000000-0000-0000-0000-000000000707', '00000000-0000-0000-0000-000000000306', 'dispatch', 'Dispatch board', 'completed', '2026-04-16T16:20:00Z', 'Parts installation completed', 'Ice maker part was installed and the invoice was paid.', '{}'::jsonb, now());

commit;
