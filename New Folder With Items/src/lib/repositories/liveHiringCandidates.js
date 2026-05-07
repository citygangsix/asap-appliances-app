import { mapHiringCandidateRowToDomain } from "../../integrations/supabase/mappers/hiringCandidates";
import {
  getLocalOperationsServerHeaders,
  getLocalOperationsServerUrl,
} from "../config/localOperationsServer";

export async function requestLiveHiringCandidates() {
  const url = new URL(getLocalOperationsServerUrl("/api/hiring-candidates"));
  url.searchParams.set("t", String(Date.now()));

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: getLocalOperationsServerHeaders({
      Accept: "application/json",
    }),
  });
  const responseText = await response.text();
  const responseJson = responseText ? JSON.parse(responseText) : null;

  if (!response.ok || !responseJson?.ok) {
    throw new Error(
      responseJson?.message || `Live hiring candidates failed with status ${response.status}.`,
    );
  }

  return {
    candidates: (responseJson.candidates || []).map(mapHiringCandidateRowToDomain),
    fetchedAt: responseJson.fetchedAt || new Date().toISOString(),
  };
}
