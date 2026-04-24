import { getTwilioServerConfig } from "./supabaseAdmin.js";
import {
  isCallIntelligenceConfigured,
  transcribeAndAnalyzeTwilioRecording,
} from "./callIntelligence.js";
import { upsertHiringCandidateFromCall } from "./hiringCandidates.js";

function readOptionalInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function findCommunicationByCallSid(client, callSid) {
  if (!callSid) {
    return null;
  }

  const result = await client
    .from("communications")
    .select("*")
    .eq("provider_call_sid", callSid)
    .maybeSingle();

  if (result.error) {
    throw new Error(`communications.lookupByProviderCallSid: ${result.error.message}`);
  }

  return result.data || null;
}

async function findPendingUnmatchedInboundByCallSid(client, callSid) {
  if (!callSid) {
    return null;
  }

  const result = await client
    .from("unmatched_inbound_communications")
    .select("*")
    .eq("provider_call_sid", callSid)
    .eq("resolution_status", "pending")
    .maybeSingle();

  if (result.error) {
    throw new Error(`unmatchedInbound.lookupByProviderCallSid: ${result.error.message}`);
  }

  return result.data || null;
}

async function findExistingRecordingBySid(client, recordingSid) {
  const result = await client
    .from("twilio_voice_recordings")
    .select("*")
    .eq("provider_recording_sid", recordingSid)
    .maybeSingle();

  if (result.error) {
    throw new Error(`twilioVoiceRecordings.lookupByProviderRecordingSid: ${result.error.message}`);
  }

  return result.data || null;
}

function buildRecordingPayload(payload, linkedCommunicationId, intelligence = null) {
  return {
    linked_communication_id: linkedCommunicationId,
    provider_name: "twilio",
    provider_account_sid: payload.AccountSid || null,
    provider_call_sid: payload.CallSid || null,
    provider_parent_call_sid: payload.ParentCallSid || null,
    provider_recording_sid: payload.RecordingSid,
    recording_status: payload.RecordingStatus || null,
    recording_source: payload.RecordingSource || null,
    recording_track: payload.RecordingTrack || null,
    recording_channels: readOptionalInteger(payload.RecordingChannels),
    recording_duration_seconds: readOptionalInteger(payload.RecordingDuration),
    recording_url: payload.RecordingUrl || null,
    transcript_text: intelligence?.transcriptText || null,
    call_headline: intelligence?.headline || null,
    call_highlights: intelligence?.callHighlights || null,
    call_summary_sections: intelligence?.callSummarySections || null,
    transcription_status: intelligence?.transcriptionStatus || null,
    transcription_error: intelligence?.transcriptionError || null,
    transcribed_at: intelligence?.transcribedAt || null,
    raw_payload: payload,
    callback_received_at: new Date().toISOString(),
  };
}

function shouldAttemptTranscription(payload) {
  return (
    String(payload.RecordingStatus || "").toLowerCase() === "completed" &&
    Boolean(payload.RecordingSid && payload.RecordingUrl)
  );
}

function buildTranscriptionFailure(error) {
  return {
    transcriptText: null,
    headline: null,
    callHighlights: null,
    callSummarySections: null,
    transcriptionStatus: "failed",
    transcriptionError: error?.message || "Transcription failed.",
    transcribedAt: null,
  };
}

function readStoredRecordingIntelligence(recording) {
  if (!recording || !recording.transcription_status) {
    return null;
  }

  return {
    transcriptText: recording.transcript_text || null,
    headline: recording.call_headline || null,
    callHighlights: recording.call_highlights || null,
    callSummarySections: recording.call_summary_sections || null,
    transcriptionStatus: recording.transcription_status || null,
    transcriptionError: recording.transcription_error || null,
    transcribedAt: recording.transcribed_at || null,
  };
}

function buildCommunicationUpdate(intelligence, existingRow = null) {
  return {
    preview_text:
      intelligence?.headline ||
      existingRow?.preview_text ||
      existingRow?.extracted_event_summary ||
      "Customer call recorded.",
    transcript_text: intelligence?.transcriptText || existingRow?.transcript_text || null,
    call_highlights: intelligence?.callHighlights || existingRow?.call_highlights || null,
    call_summary_sections:
      intelligence?.callSummarySections || existingRow?.call_summary_sections || null,
    transcription_status: intelligence?.transcriptionStatus || existingRow?.transcription_status || null,
    transcription_error: intelligence?.transcriptionError || null,
    transcribed_at: intelligence?.transcribedAt || existingRow?.transcribed_at || null,
    extracted_event_summary:
      intelligence?.headline || existingRow?.extracted_event_summary || null,
  };
}

function buildUnmatchedInboundUpdate(intelligence, existingRow = null) {
  return {
    preview_text:
      intelligence?.headline || existingRow?.preview_text || "Customer call recorded.",
    transcript_text: intelligence?.transcriptText || existingRow?.transcript_text || null,
    call_highlights: intelligence?.callHighlights || existingRow?.call_highlights || null,
    call_summary_sections:
      intelligence?.callSummarySections || existingRow?.call_summary_sections || null,
    transcription_status: intelligence?.transcriptionStatus || existingRow?.transcription_status || null,
    transcription_error: intelligence?.transcriptionError || null,
    transcribed_at: intelligence?.transcribedAt || existingRow?.transcribed_at || null,
  };
}

async function updateCommunicationRecord(client, communicationId, payload) {
  const result = await client
    .from("communications")
    .update(payload)
    .eq("communication_id", communicationId)
    .select("*")
    .single();

  if (result.error) {
    throw new Error(`communications.updateTranscription: ${result.error.message}`);
  }

  return result.data;
}

async function updateUnmatchedInboundRecord(client, unmatchedCommunicationId, payload) {
  const result = await client
    .from("unmatched_inbound_communications")
    .update(payload)
    .eq("unmatched_communication_id", unmatchedCommunicationId)
    .select("*")
    .single();

  if (result.error) {
    throw new Error(`unmatchedInbound.updateTranscription: ${result.error.message}`);
  }

  return result.data;
}

async function syncRecordingIntelligenceToTargets(client, intelligence, targets) {
  if (!intelligence?.transcriptionStatus) {
    return {
      communication: targets.communication,
      unmatchedInbound: targets.unmatchedInbound,
    };
  }

  const [communication, unmatchedInbound] = await Promise.all([
    targets.communication
      ? updateCommunicationRecord(
          client,
          targets.communication.communication_id,
          buildCommunicationUpdate(intelligence, targets.communication),
        )
      : Promise.resolve(targets.communication),
    targets.unmatchedInbound
      ? updateUnmatchedInboundRecord(
          client,
          targets.unmatchedInbound.unmatched_communication_id,
          buildUnmatchedInboundUpdate(intelligence, targets.unmatchedInbound),
        )
      : Promise.resolve(targets.unmatchedInbound),
  ]);

  return {
    communication,
    unmatchedInbound,
  };
}

export async function findLatestRecordingIntelligenceByCallSid(client, callSid) {
  if (!callSid) {
    return null;
  }

  const result = await client
    .from("twilio_voice_recordings")
    .select(
      "provider_call_sid,provider_parent_call_sid,transcript_text,call_headline,call_highlights,call_summary_sections,transcription_status,transcription_error,transcribed_at,callback_received_at",
    )
    .or(`provider_call_sid.eq.${callSid},provider_parent_call_sid.eq.${callSid}`)
    .order("callback_received_at", { ascending: false })
    .limit(1);

  if (result.error) {
    throw new Error(`twilioVoiceRecordings.lookupByCallSid: ${result.error.message}`);
  }

  const recording = result.data?.[0] || null;
  return readStoredRecordingIntelligence(recording);
}

export async function persistRecordingStatusCallback(client, payload) {
  const recordingSid = payload.RecordingSid || null;

  if (!recordingSid) {
    return {
      ok: false,
      status: 400,
      reason: "missing_recording_sid",
      message: "RecordingSid is required.",
    };
  }

  const existingRecording = await findExistingRecordingBySid(client, recordingSid);
  const [linkedCommunication, parentLinkedCommunication, linkedUnmatched, parentLinkedUnmatched] =
    await Promise.all([
      findCommunicationByCallSid(client, payload.CallSid),
      findCommunicationByCallSid(client, payload.ParentCallSid),
      findPendingUnmatchedInboundByCallSid(client, payload.CallSid),
      findPendingUnmatchedInboundByCallSid(client, payload.ParentCallSid),
    ]);
  const targets = {
    communication: linkedCommunication || parentLinkedCommunication || null,
    unmatchedInbound: linkedUnmatched || parentLinkedUnmatched || null,
  };

  let intelligence = readStoredRecordingIntelligence(existingRecording);

  if (shouldAttemptTranscription(payload) && intelligence?.transcriptionStatus !== "completed") {
    if (isCallIntelligenceConfigured()) {
      try {
        const analyzedCall = await transcribeAndAnalyzeTwilioRecording(
          payload,
          getTwilioServerConfig(),
        );
        intelligence = {
          ...analyzedCall,
          transcriptionStatus: "completed",
          transcriptionError: null,
          transcribedAt: new Date().toISOString(),
        };
      } catch (error) {
        intelligence = buildTranscriptionFailure(error);
      }
    } else {
      intelligence = buildTranscriptionFailure(
        new Error("OPENAI_API_KEY is not configured on the webhook server."),
      );
    }
  }

  const result = await client
    .from("twilio_voice_recordings")
    .upsert(buildRecordingPayload(payload, targets.communication?.communication_id || null, intelligence), {
      onConflict: "provider_recording_sid",
    })
    .select("*")
    .single();

  if (result.error) {
    throw new Error(`twilioVoiceRecordings.upsert: ${result.error.message}`);
  }

  const syncedTargets = await syncRecordingIntelligenceToTargets(client, intelligence, targets);
  let hiringCandidate = null;
  let hiringCandidateError = null;
  let promotedTechnician = null;

  try {
    const hiringResult = await upsertHiringCandidateFromCall(client, payload, intelligence, {
      communication: syncedTargets.communication || targets.communication,
      unmatchedInbound: syncedTargets.unmatchedInbound || targets.unmatchedInbound,
      browserCallTo: payload.browserCallTo || null,
    });

    hiringCandidate = hiringResult.record || null;
    promotedTechnician = hiringResult.promotedTechnician || null;
  } catch (error) {
    hiringCandidateError = error?.message || "Hiring candidate sync failed.";
    console.error("[twilio-recordings][hiring-candidate-sync]", error);
  }

  return {
    ok: true,
    status: existingRecording ? 200 : 201,
    reason: existingRecording ? "updated" : "created",
    message: existingRecording
      ? "Twilio recording callback metadata updated."
      : "Twilio recording callback metadata stored.",
    record: result.data,
    communication: syncedTargets.communication || null,
    unmatchedInbound: syncedTargets.unmatchedInbound || null,
    hiringCandidate,
    promotedTechnician,
    hiringCandidateError,
  };
}
