import { useMemo, useState } from "react";
import { PageScaffold } from "../components/layout/PageScaffold";
import { Badge, Card } from "../components/ui";
import {
  getLocalOperationsServerHeaders,
  getLocalOperationsServerUrl,
} from "../lib/config/localOperationsServer";

const DIAL_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
const AGENT_PHONE_PRESETS = [
  {
    id: "owner-1545",
    label: "561-564-1545",
    phone: "+15615641545",
  },
  {
    id: "assistant-1674",
    label: "561-878-1674",
    phone: "+15618781674",
  },
];

function onlyPhoneDigits(value) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function toE164(value) {
  if (/[*#]/u.test(value)) {
    return "";
  }

  const digits = onlyPhoneDigits(value);
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return "";
}

function formatUsPhone(value) {
  if (/[*#]/u.test(value)) {
    return value;
  }

  const digits = onlyPhoneDigits(value);
  const nationalDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (nationalDigits.length <= 3) {
    return nationalDigits;
  }

  if (nationalDigits.length <= 6) {
    return `(${nationalDigits.slice(0, 3)}) ${nationalDigits.slice(3)}`;
  }

  return `(${nationalDigits.slice(0, 3)}) ${nationalDigits.slice(3, 6)}-${nationalDigits.slice(6, 10)}`;
}

function getStatusTone(status) {
  if (status === "Sent") return "emerald";
  if (status === "Calling") return "blue";
  if (status === "Failed") return "rose";
  return "slate";
}

async function requestClickToCall(payload) {
  const response = await fetch(getLocalOperationsServerUrl("/api/twilio/outbound/calls"), {
    method: "POST",
    headers: getLocalOperationsServerHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  let responseJson = null;

  if (responseText) {
    try {
      responseJson = JSON.parse(responseText);
    } catch (error) {
      responseJson = null;
    }
  }

  if (!response.ok || !responseJson) {
    throw new Error(responseJson?.message || `Twilio call failed with status ${response.status}.`);
  }

  if (!responseJson.ok) {
    throw new Error(responseJson.message || "Twilio call failed.");
  }

  return responseJson;
}

export function PhonePage() {
  const [rawNumber, setRawNumber] = useState("");
  const [agentPhone, setAgentPhone] = useState(AGENT_PHONE_PRESETS[0].phone);
  const [status, setStatus] = useState("Ready");
  const [message, setMessage] = useState("Enter a customer number and start the Twilio bridge.");
  const formattedNumber = useMemo(() => formatUsPhone(rawNumber), [rawNumber]);
  const formattedAgentPhone = useMemo(() => formatUsPhone(agentPhone), [agentPhone]);
  const e164Number = useMemo(() => toE164(rawNumber), [rawNumber]);
  const e164AgentPhone = useMemo(() => toE164(agentPhone), [agentPhone]);
  const canCall = Boolean(e164Number && e164AgentPhone) && status !== "Calling";

  function appendDigit(value) {
    if (value === "*" || value === "#") {
      setRawNumber((current) => current + value);
      return;
    }

    setRawNumber((current) => onlyPhoneDigits(current + value));
  }

  function backspace() {
    setRawNumber((current) => current.slice(0, -1));
  }

  function clearNumber() {
    setRawNumber("");
    setStatus("Ready");
    setMessage("Ready for the next Twilio bridge call.");
  }

  async function startCall() {
    if (!canCall) {
      return;
    }

    setStatus("Calling");
    setMessage(`Calling ${formattedAgentPhone} first. Answer it to connect ${formattedNumber}.`);

    try {
      const result = await requestClickToCall({
        customerName: formattedNumber || e164Number,
        customerPhone: e164Number,
        agentPhone: e164AgentPhone,
        triggerSource: "manual_phone_dialer",
      });
      setStatus("Sent");
      setMessage(
        result.message
          ? `${result.message} Customer sees ${result.businessPhoneNumber || "the Twilio number"}.`
          : `Twilio is calling ${formattedAgentPhone}. Customer sees ${result.businessPhoneNumber || "the Twilio number"}.`,
      );
    } catch (error) {
      setStatus("Failed");
      setMessage(error.message);
    }
  }

  function resetCallState() {
    setStatus("Ready");
    setMessage("Ready for the next Twilio bridge call.");
  }

  return (
    <PageScaffold
      title="Phone"
      subtitle="Mobile-ready Twilio bridge dialing from the ASAP dashboard."
      contentClassName="bg-[#11141c] p-4 sm:p-6 lg:p-8"
    >
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,430px)_1fr]">
        <Card className="border-white/10 bg-[#1c1e26] p-4 text-white shadow-2xl shadow-black/20 sm:p-6">
          <div className="rounded-3xl border border-white/10 bg-[#10131b] p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Dialer
              </p>
              <Badge tone={getStatusTone(status)}>{status}</Badge>
            </div>
            <div className="mt-6 min-h-[88px] rounded-2xl border border-white/10 bg-black/30 px-4 py-5 text-right">
              <p className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
                {formattedNumber || "Enter number"}
              </p>
              <p className="mt-3 text-sm text-slate-500">{e164Number || "US numbers only"}</p>
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-300">
              Ring this phone first
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300"
                inputMode="tel"
                onChange={(event) => setAgentPhone(event.target.value)}
                placeholder="(561) 564-1545"
                type="tel"
                value={formattedAgentPhone}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {AGENT_PHONE_PRESETS.map((option) => (
                <button
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    e164AgentPhone === option.phone
                      ? "border-emerald-300 bg-emerald-400/15 text-emerald-100"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.09]"
                  }`}
                  key={option.id}
                  onClick={() => setAgentPhone(option.phone)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {DIAL_KEYS.map((key) => (
              <button
                className="min-h-[68px] rounded-2xl border border-white/10 bg-white/[0.06] text-2xl font-semibold text-white transition hover:bg-white/[0.11] active:scale-[0.98]"
                key={key}
                onClick={() => appendDigit(key)}
                type="button"
              >
                {key}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              className="min-h-[54px] rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-semibold text-slate-200 transition hover:bg-white/[0.11]"
              onClick={backspace}
              type="button"
            >
              Backspace
            </button>
            <button
              className="min-h-[54px] rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-semibold text-slate-200 transition hover:bg-white/[0.11]"
              onClick={clearNumber}
              type="button"
            >
              Clear
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              className="min-h-[60px] rounded-2xl bg-emerald-500 px-5 py-3 text-base font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              disabled={!canCall}
              onClick={startCall}
              type="button"
            >
              Call from Twilio
            </button>
            <button
              className="min-h-[60px] rounded-2xl bg-slate-700 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              disabled={status === "Ready" && !rawNumber}
              onClick={resetCallState}
              type="button"
            >
              Reset
            </button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-[#1c1e26] p-5 text-white sm:p-6">
            <p className="section-title">Call state</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {["Ready", "Calling", "Sent", "Failed"].map((state) => (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                    status === state
                      ? "border-indigo-400 bg-indigo-500/20 text-white"
                      : "border-white/10 bg-white/[0.04] text-slate-400"
                  }`}
                  key={state}
                >
                  {state}
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-300">{message}</p>
          </Card>

          <Card className="border-white/10 bg-[#1c1e26] p-5 text-white sm:p-6">
            <p className="section-title">Twilio bridge calling</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <p>
                This screen posts to <span className="font-semibold text-white">POST /api/twilio/outbound/calls</span>,
                then Twilio rings the selected phone before bridging the customer.
              </p>
              <p>
                The customer sees the configured Twilio business number, and the call can be recorded through the CRM callback path.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </PageScaffold>
  );
}
