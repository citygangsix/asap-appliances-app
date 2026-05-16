begin;

alter table public.technicians
  add column if not exists service_zip_codes text[] not null default '{}';

alter table public.jobs
  add column if not exists dispatch_confirmation_requested_at timestamptz,
  add column if not exists dispatch_confirmation_received_at timestamptz,
  add column if not exists dispatch_response_minutes integer check (dispatch_response_minutes is null or dispatch_response_minutes >= 0),
  add column if not exists technician_confirmation_response text,
  add column if not exists payment_collected_before_tech_left boolean;

insert into public.technicians (
  tech_id,
  name,
  primary_phone,
  email,
  service_area,
  service_zip_codes,
  skills,
  availability_notes,
  status_today,
  jobs_completed_this_week,
  callback_rate_percent,
  payout_total,
  gas_reimbursement_total,
  score
) values
  (
    '00000000-0000-0000-0000-000000000205',
    'Christian Services Ocala',
    '239-595-2555',
    null,
    'Ocala / Marion County',
    ARRAY[
      '32702','32113','32134','32179','32182','32183','32192','32195','32617','32664','32681',
      '32686','34420','34421','34430','34431','34432','34470','34471','34472','34473','34474',
      '34475','34476','34477','34478','34479','34480','34481','34482','34483','34488','34489',
      '34491','34492'
    ]::text[],
    ARRAY['Refrigeration','Laundry','Cooking']::text[],
    'Florida coverage by ZIP',
    'unassigned',
    0,
    0,
    0,
    0,
    90
  ),
  (
    '00000000-0000-0000-0000-000000000206',
    'Steven Knapp',
    '727-916-2787',
    null,
    'Holiday / Tampa Bay',
    ARRAY[
      '33510','33511','33523','33525','33527','33534','33540','33541','33542','33543','33544',
      '33545','33547','33548','33549','33556','33558','33559','33563','33565','33566','33567',
      '33569','33570','33572','33573','33576','33578','33579','33584','33592','33594','33596',
      '33597','33598','33602','33603','33604','33605','33606','33607','33609','33610','33611',
      '33612','33613','33614','33615','33616','33617','33618','33619','33621','33624','33625',
      '33626','33629','33634','33635','33637','33647','33701','33702','33703','33704','33705',
      '33706','33707','33708','33709','33710','33711','33712','33713','33714','33715','33716',
      '33730','33755','33756','33759','33760','33761','33762','33763','33764','33765','33767',
      '33770','33771','33772','33773','33774','33776','33777','33778','33781','33782','33785',
      '33786','34601','34602','34604','34606','34607','34608','34609','34610','34613','34614',
      '34637','34638','34639','34652','34653','34654','34655','34667','34668','34669','34677',
      '34683','34684','34685','34688','34689','34690','34691','34695','34698'
    ]::text[],
    ARRAY['St. Pete','Tampa','Hillsborough County','Hernando County']::text[],
    'Florida coverage by ZIP',
    'unassigned',
    0,
    0,
    0,
    0,
    92
  ),
  (
    '00000000-0000-0000-0000-000000000207',
    'James G.',
    '786-294-7044',
    null,
    'Hialeah / Miami and Broward',
    ARRAY[
      '33004','33009','33010','33012','33013','33014','33015','33016','33018','33019','33020',
      '33021','33023','33024','33025','33026','33027','33028','33029','33030','33031','33032',
      '33033','33034','33035','33054','33055','33056','33060','33062','33063','33064','33065',
      '33066','33067','33068','33069','33071','33073','33076','33109','33122','33125','33126',
      '33127','33128','33129','33130','33131','33132','33133','33134','33135','33136','33137',
      '33138','33139','33140','33141','33142','33143','33144','33145','33146','33147','33149',
      '33150','33154','33155','33156','33157','33158','33160','33161','33162','33165','33166',
      '33167','33168','33169','33170','33172','33173','33174','33175','33176','33177','33178',
      '33179','33180','33181','33182','33183','33184','33185','33186','33187','33189','33190',
      '33193','33194','33196','33301','33304','33305','33306','33308','33309','33311','33312',
      '33313','33314','33315','33316','33317','33319','33321','33322','33323','33324','33325',
      '33326','33327','33328','33330','33331','33332','33334','33351','33441','33442'
    ]::text[],
    ARRAY['Miami','Broward County']::text[],
    'Florida coverage by ZIP',
    'unassigned',
    0,
    0,
    0,
    0,
    89
  ),
  (
    '00000000-0000-0000-0000-000000000208',
    'Dexter',
    '954-288-6688',
    null,
    'Fort Lauderdale / Broward County',
    ARRAY[
      '33004','33009','33019','33020','33021','33023','33024','33025','33026','33027','33028',
      '33029','33060','33062','33063','33064','33065','33066','33067','33068','33069','33071',
      '33073','33076','33301','33304','33305','33306','33308','33309','33311','33312','33313',
      '33314','33315','33316','33317','33319','33321','33322','33323','33324','33325','33326',
      '33327','33328','33330','33331','33332','33334','33351','33441','33442'
    ]::text[],
    ARRAY['Fort Lauderdale','Broward County']::text[],
    'Florida coverage by ZIP',
    'unassigned',
    0,
    0,
    0,
    0,
    93
  )
on conflict (tech_id) do update set
  name = excluded.name,
  primary_phone = excluded.primary_phone,
  email = excluded.email,
  service_area = excluded.service_area,
  service_zip_codes = excluded.service_zip_codes,
  skills = excluded.skills,
  availability_notes = excluded.availability_notes,
  status_today = excluded.status_today,
  jobs_completed_this_week = excluded.jobs_completed_this_week,
  callback_rate_percent = excluded.callback_rate_percent,
  payout_total = excluded.payout_total,
  gas_reimbursement_total = excluded.gas_reimbursement_total,
  score = excluded.score,
  updated_at = timezone('utc', now());

commit;
