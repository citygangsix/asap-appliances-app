import { Device } from "@twilio/voice-sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageScaffold } from "../components/layout/PageScaffold";
import { Badge, Card } from "../components/ui";
import { getLocalOperationsServerUrl } from "../lib/config/localOperationsServer";

const DIAL_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

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
  if (status === "Connected") return "emerald";
  if (status === "Dialing") return "blue";
  if (status === "Failed") return "rose";
  if (status === "Ended") return "amber";
  return "slate";
}

export function PhonePage() {
  const [rawNumber, setRawNumber] = useState("");
  const [status, setStatus] = useState("Ready");
  const [message, setMessage] = useState("Browser calling is ready for Twilio Voice SDK setup.");
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const deviceRef = useRef(null);
  const activeCallRef = useRef(null);
  const formattedNumber = useMemo(() => formatUsPhone(rawNumber), [rawNumber]);
  const e164Number = useMemo(() => toE164(rawNumber), [rawNumber]);
  const canCall = Boolean(e164Number) && status !== "Dialing" && status !== "Connected";

  useEffect(() => {
    return () => {
      activeCallRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  function attachCallEvents(call) {
    activeCallRef.current = call;

    call.on("accept", () => {
      setStatus("Connected");
      setMessage(`Connected to ${formattedNumber}.`);
    });

    call.on("disconnect", () => {
      activeCallRef.current = null;
      setStatus("Ended");
      setMessage("Call ended.");
    });

    call.on("cancel", () => {
      activeCallRef.current = null;
      setStatus("Ended");
      setMessage("Call canceled.");
    });

    call.on("reject", () => {
      activeCallRef.current = null;
      setStatus("Failed");
      setMessage("Call was rejected.");
    });

    call.on("error", (error) => {
      activeCallRef.current = null;
      setStatus("Failed");
      setMessage(error?.message || "Twilio Voice call failed.");
    });
  }

  async function fetchVoiceToken() {
    const response = await fetch(getLocalOperationsServerUrl("/api/twilio/voice-token"));
    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.ok === false || !result.token) {
      throw new Error(result.message || "Unable to get Twilio browser voice token.");
    }

    return result.token;
  }

  async function getVoiceDevice() {
    if (deviceRef.current) {
      return deviceRef.current;
    }

    const token = await fetchVoiceToken();
    const device = new Device(token, {
      closeProtection: true,
      logLevel: 1,
    });

    device.on("registered", () => {
      setIsDeviceReady(true);
    });

    device.on("unregistered", () => {
      setIsDeviceReady(false);
    });

    device.on("error", (error) => {
      setStatus("Failed");
      setMessage(error?.message || "Twilio Voice device failed.");
    });

    device.on("tokenWillExpire", async () => {
      try {
        device.updateToken(await fetchVoiceToken());
      } catch (error) {
        setStatus("Failed");
        setMessage(error?.message || "Unable to refresh Twilio Voice token.");
      }
    });

    await device.register();
    deviceRef.current = device;
    return device;
  }

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
    setMessage("Ready for the next outbound number.");
  }

  async function startCall() {
    if (!canCall) {
      return;
    }

    setStatus("Dialing");
    setMessage(`Dialing ${formattedNumber}.`);

    try {
      const response = await fetch(getLocalOperationsServerUrl("/api/twilio/browser-call"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: e164Number }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.ok === false) {
        throw new Error(result.message || "Browser call endpoint failed.");
      }

      const device = await getVoiceDevice();
      const call = await device.connect({
        params: {
          To: result.to,
        },
      });

      attachCallEvents(call);
      setMessage(result.message || `Dialing ${formattedNumber} through Twilio Voice.`);
    } catch (error) {
      setStatus("Failed");
      setMessage(error.message);
    }
  }

  async function hangUp() {
    activeCallRef.current?.disconnect();
    deviceRef.current?.disconnectAll();
    setStatus("Ended");
    setMessage("Call ended.");

    try {
      await fetch(getLocalOperationsServerUrl("/api/twilio/hangup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: e164Number || null }),
      });
    } catch (error) {
      setMessage("Call ended locally. Hangup endpoint is not active yet.");
    }
  }

  return (
    <PageScaffold
      title="Phone"
      subtitle="Mobile-ready dialing pad prepared for Twilio browser calling."
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
              Call
            </button>
            <button
              className="min-h-[60px] rounded-2xl bg-rose-500 px-5 py-3 text-base font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              disabled={status !== "Dialing" && status !== "Connected"}
              onClick={hangUp}
              type="button"
            >
              Hang Up
            </button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-[#1c1e26] p-5 text-white sm:p-6">
            <p className="section-title">Call state</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-5">
              {["Ready", "Dialing", "Connected", "Failed", "Ended"].map((state) => (
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
            <p className="section-title">Twilio browser calling</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <p>
                This screen posts to <span className="font-semibold text-white">POST /api/twilio/browser-call</span>,
                gets a short-lived token from <span className="font-semibold text-white">GET /api/twilio/voice-token</span>,
                then connects through the Twilio Voice SDK.
              </p>
              <p>
                Configure the TwiML App voice request URL to{" "}
                <span className="font-semibold text-white">/api/twilio/browser-call/twiml</span>.
                Twilio Account SID, Auth Token, API key secret, and TwiML App SID stay on the backend.
              </p>
              <p>Device status: {isDeviceReady ? "Ready" : "Not registered"}</p>
            </div>
          </Card>
        </div>
      </div>
    </PageScaffold>
  );
}
