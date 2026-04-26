import { scheduleTwilioRecordingRecovery } from "./twilioRecordingRecovery.js";

const RECOVERY_TRIGGER_STATUSES = new Set(["answered", "completed"]);

export async function handleBrowserCallStatusCallback(payload = {}) {
  const callStatus = String(payload.CallStatus || "").toLowerCase();
  const shouldScheduleRecovery = RECOVERY_TRIGGER_STATUSES.has(callStatus);
  const recoverySchedule = shouldScheduleRecovery
    ? scheduleTwilioRecordingRecovery({
        reason: `browser-call-status:${callStatus}`,
      })
    : null;

  console.log("[twilio-browser-call:status]", {
    callSid: payload.CallSid || null,
    parentCallSid: payload.ParentCallSid || null,
    callStatus: payload.CallStatus || null,
    direction: payload.Direction || null,
    from: payload.From || null,
    to: payload.To || null,
    recoveryTriggerStatus: shouldScheduleRecovery,
    scheduledRecordingRecovery: Boolean(recoverySchedule?.scheduled),
  });

  return {
    ok: true,
    status: 200,
    recoveryTriggerStatus: shouldScheduleRecovery,
    scheduledRecordingRecovery: Boolean(recoverySchedule?.scheduled),
    recoveryTimersScheduled: recoverySchedule?.scheduled || 0,
    message: shouldScheduleRecovery
      ? "Browser call status accepted; recording recovery scheduled."
      : "Browser call status accepted.",
  };
}
