const HIRING_CANDIDATE_COLUMNS = `
  candidate_id,
  name,
  primary_phone,
  email,
  source,
  stage,
  trade,
  city,
  service_area,
  structured_start_date,
  availability_summary,
  availability_days,
  availability_time_preferences,
  payout_expectation_summary,
  experience_summary,
  next_step,
  call_highlights,
  transcript_text,
  linked_communication_id,
  provider_call_sid,
  promoted_tech_id,
  promoted_at,
  raw_analysis,
  last_contact_at,
  created_at,
  updated_at
`;

export async function listHiringCandidateRows(client) {
  const result = await client
    .from("hiring_candidates")
    .select(HIRING_CANDIDATE_COLUMNS)
    .order("last_contact_at", { ascending: false });

  if (result.error) {
    throw new Error(`hiringCandidates.apiList: ${result.error.message}`);
  }

  return result.data || [];
}
