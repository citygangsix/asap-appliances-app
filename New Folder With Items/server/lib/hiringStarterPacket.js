import { sendOutboundSms } from "./twilioOutboundNotifications.js";

const STARTER_PACKET_PATH = "/starter-packets/ASAP_Appliance_Technician_Starter_Packet.pdf";

function normalizeOptionalString(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function buildStarterPacketUrl(config) {
  return `${config.webhookBaseUrl}${STARTER_PACKET_PATH}`;
}

function hasStarterPacketSend(candidateRecord) {
  const starterPacket = candidateRecord?.raw_analysis?.starterPacket;
  return Boolean(starterPacket?.sentAt || starterPacket?.providerMessageSid);
}

function buildStarterPacketBody(candidateRecord, packetUrl) {
  const firstName = normalizeOptionalString(candidateRecord?.name)?.split(/\s+/u)[0] || "there";

  return [
    `Hi ${firstName}, welcome to ASAP Appliance.`,
    "Here is your technician starter packet:",
    packetUrl,
    "Please review it before your first job and reply here with any questions.",
  ].join(" ");
}

export async function sendStarterPacketToHiredCandidate(client, config, candidateRecord, technicianRecord) {
  const candidatePhone = normalizeOptionalString(candidateRecord?.primary_phone);

  if (!candidateRecord?.candidate_id || !technicianRecord?.tech_id) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_candidate_or_technician",
      message: "Starter packet send requires a linked hired candidate and technician.",
    };
  }

  if (!candidatePhone) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_candidate_phone",
      message: "Starter packet skipped because candidate phone is missing.",
    };
  }

  if (hasStarterPacketSend(candidateRecord)) {
    return {
      ok: true,
      skipped: true,
      reason: "already_sent",
      message: "Starter packet was already sent to this candidate.",
    };
  }

  const packetUrl = buildStarterPacketUrl(config);
  const smsResult = await sendOutboundSms({
    toNumber: candidatePhone,
    body: buildStarterPacketBody(candidateRecord, packetUrl),
    label: "hiring-starter-packet",
  });
  const sentAt = new Date().toISOString();
  const rawAnalysis = {
    ...(candidateRecord.raw_analysis || {}),
    starterPacket: {
      sentAt,
      packetUrl,
      toNumber: candidatePhone,
      providerMessageSid: smsResult.providerMessageSid || null,
      technicianId: technicianRecord.tech_id,
      status: smsResult.ok ? "sent" : "failed",
      channel: "sms",
    },
  };

  const updateResult = await client
    .from("hiring_candidates")
    .update({ raw_analysis: rawAnalysis })
    .eq("candidate_id", candidateRecord.candidate_id)
    .select("*")
    .single();

  if (updateResult.error) {
    throw new Error(`hiringCandidates.starterPacketLog: ${updateResult.error.message}`);
  }

  return {
    ok: true,
    skipped: false,
    reason: "sent",
    message: "Starter packet SMS sent and logged.",
    candidate: updateResult.data,
    providerMessageSid: smsResult.providerMessageSid || null,
    packetUrl,
  };
}
