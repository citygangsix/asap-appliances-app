import { useEffect, useMemo, useRef, useState } from "react";
import { PageScaffold } from "../components/layout/PageScaffold";
import { Badge, Card } from "../components/ui";
import { useAsyncValue } from "../hooks/useAsyncValue";
import {
  getLocalOperationsServerHeaders,
  getLocalOperationsServerUrl,
} from "../lib/config/localOperationsServer";
import { getOperationsRepository } from "../lib/repositories";

const DIAL_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
const DTMF_FREQUENCIES = {
  "1": [697, 1209],
  "2": [697, 1336],
  "3": [697, 1477],
  "4": [770, 1209],
  "5": [770, 1336],
  "6": [770, 1477],
  "7": [852, 1209],
  "8": [852, 1336],
  "9": [852, 1477],
  "*": [941, 1209],
  "0": [941, 1336],
  "#": [941, 1477],
};
const AGENT_PHONE_PRESETS = [
  {
    id: "assistant-1545",
    label: "561-564-1545",
    phone: "+15615641545",
  },
];

function onlyPhoneDigits(value) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function normalizePhoneLookup(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function findSavedCustomerByPhone(customers, phoneNumber) {
  const targetPhone = normalizePhoneLookup(phoneNumber);

  if (!targetPhone) {
    return null;
  }

  return (
    customers.find((customer) =>
      [customer.primaryPhone, customer.secondaryPhone]
        .map(normalizePhoneLookup)
        .some((phone) => phone && phone === targetPhone),
    ) || null
  );
}

function sanitizeDialValue(value) {
  return String(value).replace(/[^\d*#]/g, "").slice(0, 32);
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

function stopOscillator(oscillator) {
  try {
    oscillator.stop();
  } catch (error) {
    // Some browsers throw if an oscillator already reached its scheduled stop.
  }
}

function disconnectAudioNode(node) {
  try {
    node?.disconnect();
  } catch (error) {
    // A node can only be disconnected once.
  }
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
  const repository = getOperationsRepository();
  const [rawNumber, setRawNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [status, setStatus] = useState("Ready");
  const [message, setMessage] = useState("Enter a customer number and start the Twilio bridge.");
  const [customerRefreshNonce, setCustomerRefreshNonce] = useState(0);
  const audioContextRef = useRef(null);
  const activeToneRef = useRef(null);
  const ringingRef = useRef({ intervalId: null, burst: null });
  const customersQuery = useAsyncValue(
    () => repository.customers.list(),
    [repository, customerRefreshNonce],
  );
  const formattedNumber = useMemo(() => formatUsPhone(rawNumber), [rawNumber]);
  const formattedAgentPhone = useMemo(() => formatUsPhone(agentPhone), [agentPhone]);
  const e164Number = useMemo(() => toE164(rawNumber), [rawNumber]);
  const e164AgentPhone = useMemo(() => toE164(agentPhone), [agentPhone]);
  const trimmedCustomerName = customerName.trim();
  const customerDirectory = customersQuery.data || [];
  const matchedCustomer = useMemo(
    () => findSavedCustomerByPhone(customerDirectory, e164Number || rawNumber),
    [customerDirectory, e164Number, rawNumber],
  );
  const callCustomerName = matchedCustomer?.name || trimmedCustomerName;
  const callTargetLabel = callCustomerName || formattedNumber || e164Number || "No number entered";
  const canCall = Boolean(e164Number) && status !== "Calling";

  function getAudioContext() {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }

  function stopActiveTone() {
    if (!activeToneRef.current) {
      return;
    }

    window.clearTimeout(activeToneRef.current.timeoutId);
    activeToneRef.current.oscillators.forEach(stopOscillator);
    disconnectAudioNode(activeToneRef.current.gain);
    activeToneRef.current = null;
  }

  function playDtmfTone(key) {
    const frequencies = DTMF_FREQUENCIES[key];
    const audioContext = getAudioContext();

    if (!frequencies || !audioContext) {
      return;
    }

    stopActiveTone();

    const gain = audioContext.createGain();
    const oscillators = frequencies.map((frequency) => {
      const oscillator = audioContext.createOscillator();
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      oscillator.connect(gain);
      return oscillator;
    });
    const now = audioContext.currentTime;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    gain.connect(audioContext.destination);
    oscillators.forEach((oscillator) => {
      oscillator.start(now);
      oscillator.stop(now + 0.18);
    });

    const toneHandle = {
      gain,
      oscillators,
      timeoutId: null,
    };

    activeToneRef.current = toneHandle;
    toneHandle.timeoutId = window.setTimeout(() => {
      disconnectAudioNode(gain);

      if (activeToneRef.current === toneHandle) {
        activeToneRef.current = null;
      }
    }, 220);
  }

  function stopRingBurst() {
    if (!ringingRef.current.burst) {
      return;
    }

    window.clearTimeout(ringingRef.current.burst.timeoutId);
    ringingRef.current.burst.oscillators.forEach(stopOscillator);
    disconnectAudioNode(ringingRef.current.burst.gain);
    ringingRef.current.burst = null;
  }

  function stopRinging() {
    window.clearInterval(ringingRef.current.intervalId);
    stopRingBurst();
    ringingRef.current.intervalId = null;
  }

  function playRingBurst() {
    const audioContext = getAudioContext();

    if (!audioContext) {
      return;
    }

    stopRingBurst();

    const gain = audioContext.createGain();
    const oscillators = [440, 480].map((frequency) => {
      const oscillator = audioContext.createOscillator();
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      oscillator.connect(gain);
      return oscillator;
    });
    const now = audioContext.currentTime;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
    gain.gain.setValueAtTime(0.08, now + 0.72);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    gain.connect(audioContext.destination);
    oscillators.forEach((oscillator) => {
      oscillator.start(now);
      oscillator.stop(now + 0.92);
    });

    const burstHandle = {
      gain,
      oscillators,
      timeoutId: null,
    };

    ringingRef.current.burst = burstHandle;
    burstHandle.timeoutId = window.setTimeout(() => {
      disconnectAudioNode(gain);

      if (ringingRef.current.burst === burstHandle) {
        ringingRef.current.burst = null;
      }
    }, 1000);
  }

  function startRinging() {
    stopRinging();
    playRingBurst();
    ringingRef.current.intervalId = window.setInterval(playRingBurst, 3000);
  }

  function appendDigit(value) {
    playDtmfTone(value);
    setRawNumber((current) => sanitizeDialValue(current + value));
  }

  function backspace() {
    setRawNumber((current) => current.slice(0, -1));
  }

  function clearNumber() {
    stopRinging();
    setRawNumber("");
    setStatus("Ready");
    setMessage("Ready for the next Twilio bridge call.");
  }

  async function startCall() {
    if (!canCall) {
      return;
    }

    const selectedAgentPhone = e164AgentPhone || null;

    setStatus("Calling");
    startRinging();
    setMessage(
      selectedAgentPhone
        ? `Calling ${formatUsPhone(selectedAgentPhone)} first. Answer it to connect ${callTargetLabel}.`
        : `Calling the configured office phone first. Answer it to connect ${callTargetLabel}.`,
    );

    try {
      const shouldRefreshCustomersAfterCall = !matchedCustomer && Boolean(trimmedCustomerName);
      const result = await requestClickToCall({
        ...(matchedCustomer?.customerId ? { customerId: matchedCustomer.customerId } : {}),
        customerName: callCustomerName || formattedNumber || e164Number,
        customerPhone: e164Number,
        persistCustomerContact: !matchedCustomer && Boolean(trimmedCustomerName),
        ...(selectedAgentPhone ? { agentPhone: selectedAgentPhone } : {}),
        triggerSource: "manual_phone_dialer",
      });
      stopRinging();
      setStatus("Sent");
      if (
        shouldRefreshCustomersAfterCall ||
        ["created", "matched", "ambiguous"].includes(result.customerContactStatus)
      ) {
        repository.clearRuntimeCaches?.();
        setCustomerRefreshNonce((current) => current + 1);
      }
      setMessage(
        result.message
          ? `${result.message} Customer sees ${result.businessPhoneNumber || "the Twilio number"}.`
          : `Twilio is calling ${formatUsPhone(result.agentPhone || selectedAgentPhone || "") || "the configured phone"}. Customer sees ${result.businessPhoneNumber || "the Twilio number"}.`,
      );
    } catch (error) {
      stopRinging();
      setStatus("Failed");
      setMessage(error.message);
    }
  }

  function resetCallState() {
    stopRinging();
    setStatus("Ready");
    setMessage("Ready for the next Twilio bridge call.");
  }

  useEffect(() => {
    return () => {
      stopRinging();
      stopActiveTone();
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <PageScaffold
      title="Phone"
      subtitle="Default dashboard landing screen for the fastest Twilio bridge call."
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
            <label className="mt-6 block text-sm font-semibold text-slate-300">
              Customer number
              <input
                className="mt-2 min-h-[88px] w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-5 text-right text-3xl font-semibold tracking-normal text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300 sm:text-4xl"
                inputMode="tel"
                onChange={(event) => setRawNumber(sanitizeDialValue(event.target.value))}
                placeholder="Enter number"
                type="tel"
                value={formattedNumber}
              />
              <span className="mt-3 block text-right text-sm font-medium text-slate-500">
                {e164Number || "US numbers only"}
              </span>
            </label>
            {matchedCustomer ? (
              <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  Saved customer
                </p>
                <p className="mt-2 text-xl font-semibold text-white">{matchedCustomer.name}</p>
                <p className="mt-1 text-sm text-emerald-100/80">
                  {[matchedCustomer.primaryPhone, matchedCustomer.customerSegment].filter(Boolean).join(" · ")}
                </p>
              </div>
            ) : null}
            <label className="mt-4 block text-sm font-semibold text-slate-300">
              Customer name
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300 disabled:text-slate-400"
                disabled={Boolean(matchedCustomer)}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder={customersQuery.isLoading ? "Loading saved customers" : "Optional"}
                type="text"
                value={matchedCustomer ? matchedCustomer.name : customerName}
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-300">
              Ring this phone first
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300"
                inputMode="tel"
                onChange={(event) => setAgentPhone(event.target.value)}
                placeholder="Server default office phone"
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
              {status === "Calling" ? "Cancel" : "Reset"}
            </button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-[#1c1e26] p-5 text-white sm:p-6">
            <p className="section-title">Call state</p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Call target
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{callTargetLabel}</p>
              <p className="mt-1 text-sm text-slate-400">
                {matchedCustomer ? matchedCustomer.primaryPhone || e164Number : e164Number || formattedNumber}
              </p>
            </div>
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
                then Twilio rings the configured office phone, or the selected override, before bridging the customer.
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
