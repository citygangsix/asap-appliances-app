import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageScaffold } from "../components/layout/PageScaffold";
import { Badge, Card } from "../components/ui";
import { useAsyncValue } from "../hooks/useAsyncValue";
import {
  getLocalOperationsServerHeaders,
  getLocalOperationsServerUrl,
} from "../lib/config/localOperationsServer";
import {
  buildContactDirectory,
  buildManualContactSummary,
  contactMatchesSearch,
  formatUsPhone,
  getContactTypeTitle,
  getContactTypeTone,
  normalizePhoneLookup,
  sanitizeDialValue,
  toE164,
} from "../lib/domain/contacts";
import { getOperationsRepository } from "../lib/repositories";
import { requestLiveHiringCandidates } from "../lib/repositories/liveHiringCandidates";

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
const CONTACT_TYPE_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "technician", label: "Technician" },
  { value: "candidate", label: "Candidate" },
];
const CONTACT_LIST_FILTERS = [
  { value: "all", label: "All" },
  { value: "customer", label: "Customers" },
  { value: "technician", label: "Technicians" },
  { value: "candidate", label: "Candidates" },
  { value: "review", label: "Review" },
];
const ACTIVE_CALLS_REFRESH_INTERVAL_MS = 5000;
const RECENT_CALLS_STORAGE_KEY = "asap-phone-recent-calls";
const MAX_RECENT_CALLS = 12;
const MAX_VISIBLE_CONTACTS = 80;
const SUMMARY_CARD_PEEK_WIDTH = 72;
const SMS_TEMPLATES = [
  {
    label: "Missed call",
    body: "Hi, this is ASAP Appliance. I just tried calling you. Please reply here when you are available.",
  },
  {
    label: "Hiring",
    body: "Hi, this is ASAP Appliance. Can you confirm your availability for appliance repair work?",
  },
  {
    label: "Candidate facts",
    body: "Hi, this is ASAP Appliance. Please send your current city, work experience, tools/vehicle status, and availability.",
  },
];
const CALL_CONTROL_BUTTONS = [
  { key: "audio", label: "Audio", icon: "speaker" },
  { key: "facetime", label: "FaceTime", icon: "video", disabled: true },
  { key: "mute", label: "Mute", icon: "mute" },
  { key: "more", label: "More", icon: "more" },
  { key: "end", label: "End", icon: "phone", danger: true },
  { key: "keypad", label: "Keypad", icon: "keypad" },
];

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

function findSavedTechnicianByPhone(technicians, phoneNumber) {
  const targetPhone = normalizePhoneLookup(phoneNumber);

  if (!targetPhone) {
    return null;
  }

  return (
    technicians.find((technician) => {
      const technicianPhone = normalizePhoneLookup(technician.primaryPhone);
      return technicianPhone && technicianPhone === targetPhone;
    }) || null
  );
}

function formatDateTimeLabel(isoValue) {
  if (!isoValue) {
    return "Just now";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(isoValue));
  } catch (error) {
    return "Recent";
  }
}

function readRecentCalls() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsedCalls = JSON.parse(window.localStorage.getItem(RECENT_CALLS_STORAGE_KEY) || "[]");
    return Array.isArray(parsedCalls)
      ? parsedCalls
          .filter((call) => call?.phone)
          .slice(0, MAX_RECENT_CALLS)
      : [];
  } catch (error) {
    return [];
  }
}

function writeRecentCalls(calls) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(RECENT_CALLS_STORAGE_KEY, JSON.stringify(calls));
  } catch (error) {
    // Local storage can be unavailable in private browser contexts.
  }
}

function getCallOutcomeTone(outcome) {
  if (outcome === "failed") {
    return "rose";
  }

  return "emerald";
}

function getStatusTone(status) {
  if (status === "Sent") return "emerald";
  if (status === "Calling") return "blue";
  if (status === "Sending") return "blue";
  if (status === "Failed") return "rose";
  return "slate";
}

function getProviderCallTone(status) {
  if (status === "in-progress") return "emerald";
  if (status === "ringing") return "blue";
  if (status === "queued" || status === "initiated") return "amber";
  return "slate";
}

function formatProviderCallStatus(status) {
  return String(status || "unknown").replace(/-/g, " ");
}

function formatCallDuration(startTime, durationSeconds) {
  const parsedDuration = Number(durationSeconds);

  if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
    return `${parsedDuration}s`;
  }

  const startedAt = startTime ? new Date(startTime) : null;

  if (!startedAt || Number.isNaN(startedAt.getTime())) {
    return "Live";
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function CallControlIcon({ type }) {
  if (type === "speaker") {
    return (
      <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 32 32">
        <path d="M5 13h5l8-6v18l-8-6H5z" fill="currentColor" />
        <path d="M22 11c1.6 1.3 2.5 3 2.5 5s-.9 3.7-2.5 5" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        <path d="M25.5 7.5C28 9.8 29.5 12.8 29.5 16s-1.5 6.2-4 8.5" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      </svg>
    );
  }

  if (type === "video") {
    return (
      <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 32 32">
        <rect fill="currentColor" height="16" rx="3" width="17" x="4" y="8" />
        <path d="m22 13 6-4v14l-6-4z" fill="currentColor" />
      </svg>
    );
  }

  if (type === "mute") {
    return (
      <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 32 32">
        <path d="M16 4a5 5 0 0 0-5 5v7a5 5 0 0 0 8.1 3.9M21 15.5V9a5 5 0 0 0-7.7-4.2" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        <path d="M7 15v1a9 9 0 0 0 14.4 7.2M25 15v1a9 9 0 0 1-1 4.1M16 25v3M11 28h10M5 5l22 22" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      </svg>
    );
  }

  if (type === "phone") {
    return (
      <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 32 32">
        <path d="M7 19c5.7-4 12.3-4 18 0 1.1.8 1.3 2.3.4 3.3l-1.8 2.1c-.8.9-2.2 1.1-3.2.4l-2.1-1.4a4.3 4.3 0 0 0-4.6 0l-2.1 1.4c-1 .7-2.4.5-3.2-.4l-1.8-2.1c-.9-1-.7-2.5.4-3.3Z" fill="currentColor" />
      </svg>
    );
  }

  if (type === "keypad") {
    return (
      <span aria-hidden="true" className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, index) => (
          <span className="h-2.5 w-2.5 rounded-full bg-current" key={index} />
        ))}
      </span>
    );
  }

  return (
    <span aria-hidden="true" className="flex gap-1">
      <span className="h-2.5 w-2.5 rounded-full bg-current" />
      <span className="h-2.5 w-2.5 rounded-full bg-current" />
      <span className="h-2.5 w-2.5 rounded-full bg-current" />
    </span>
  );
}

function InCallScreen({ targetName, targetPhone, status, onEnd, onShowKeypad }) {
  const statusText = status === "Sent" ? "Calling mobile..." : status === "Failed" ? "Call failed" : "Calling mobile...";
  const displayName = targetName || formatUsPhone(targetPhone) || targetPhone || "Unknown caller";

  return (
    <div className="min-h-[640px] rounded-3xl bg-gradient-to-b from-[#3c4555] to-[#232743] px-5 py-7 text-white sm:min-h-[680px] sm:px-7">
      <div className="flex items-center justify-between text-sm font-semibold text-white/85">
        <span>10:32</span>
        <div className="h-8 w-28 rounded-full bg-black" />
        <div className="flex items-center gap-2">
          <span className="tracking-[0.08em]">|||</span>
          <span className="h-4 w-7 rounded-full border border-white/60" />
        </div>
      </div>

      <div className="pt-28 text-center sm:pt-32">
        <p className="text-3xl font-bold text-white/55 sm:text-4xl">{statusText}</p>
        <p className="mt-4 break-words text-5xl font-bold leading-tight text-white sm:text-6xl">
          {displayName}
        </p>
        {targetName && targetPhone ? (
          <p className="mt-3 text-lg font-semibold text-white/55">
            {formatUsPhone(targetPhone) || targetPhone}
          </p>
        ) : null}
      </div>

      <div className="mt-52 grid grid-cols-3 gap-x-8 gap-y-8 sm:mt-60">
        {CALL_CONTROL_BUTTONS.map((control) => {
          const isEnd = control.key === "end";
          const buttonClass = isEnd
            ? "bg-red-600 text-white hover:bg-red-500"
            : "border border-white/25 bg-white/10 text-white hover:bg-white/15";

          return (
            <div className="text-center" key={control.key}>
              <button
                aria-label={control.label}
                className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full transition disabled:opacity-45 ${buttonClass}`}
                disabled={control.disabled}
                onClick={
                  isEnd
                    ? onEnd
                    : control.key === "keypad"
                      ? onShowKeypad
                      : undefined
                }
                type="button"
              >
                <CallControlIcon type={control.icon} />
              </button>
              <p className="mt-3 text-lg font-bold text-white">{control.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
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
    throw new Error(responseJson?.message || `SignalWire call failed with status ${response.status}.`);
  }

  if (!responseJson.ok) {
    throw new Error(responseJson.message || "SignalWire call failed.");
  }

  return responseJson;
}

async function requestActiveCalls() {
  const response = await fetch(getLocalOperationsServerUrl("/api/twilio/outbound/calls/active"), {
    cache: "no-store",
    headers: getLocalOperationsServerHeaders({ Accept: "application/json" }),
  });
  const responseText = await response.text();
  const responseJson = responseText ? JSON.parse(responseText) : null;

  if (!response.ok || !responseJson?.ok) {
    throw new Error(responseJson?.message || `Active calls failed with status ${response.status}.`);
  }

  return responseJson;
}

async function requestOutboundTextMessage(payload) {
  const response = await fetch(getLocalOperationsServerUrl("/api/twilio/outbound/messages"), {
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
    throw new Error(responseJson?.message || `Text message failed with status ${response.status}.`);
  }

  if (!responseJson.ok) {
    throw new Error(responseJson.message || "Text message failed.");
  }

  return responseJson;
}

function clampNumber(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function InteractionSummaryCard({ contact, mode, callStatus, smsStatus, onClose }) {
  const cardRef = useRef(null);
  const dragRef = useRef(null);
  const [dockSide, setDockSide] = useState(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const modeLabel = mode === "call" ? "Phone call" : "Text conversation";
  const statusLabel = mode === "call" ? callStatus : smsStatus;
  const summaryRows =
    contact.summaryRows?.length ? contact.summaryRows : contact.cardFields?.length ? contact.cardFields : contact.detailRows;
  const isReviewContact = contact.contactType === "review";
  const cardWidth =
    cardRef.current?.offsetWidth ||
    (typeof window === "undefined" ? 360 : Math.max(window.innerWidth - 32, SUMMARY_CARD_PEEK_WIDTH));
  const dockDistance = Math.max(0, cardWidth - SUMMARY_CARD_PEEK_WIDTH);
  const dockBaseOffset = dockSide === "right" ? dockDistance : dockSide === "left" ? -dockDistance : 0;
  const translateX = dockBaseOffset + dragOffsetX;

  useEffect(() => {
    setDockSide(null);
    setDragOffsetX(0);
  }, [contact.id, mode]);

  useEffect(() => {
    if (!isDragging) {
      return undefined;
    }

    function handleWindowMouseMove(event) {
      updateDragPosition(event.clientX, event.clientY, event);
    }

    function handleWindowMouseUp(event) {
      finishDragAt(event.clientX);
    }

    function handleWindowTouchMove(event) {
      const touch = event.touches[0];

      if (touch) {
        updateDragPosition(touch.clientX, touch.clientY, event);
      }
    }

    function handleWindowTouchEnd(event) {
      const touch = event.changedTouches[0];
      finishDragAt(touch?.clientX ?? dragRef.current?.startX ?? 0);
    }

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    window.addEventListener("touchmove", handleWindowTouchMove, { passive: false });
    window.addEventListener("touchend", handleWindowTouchEnd);
    window.addEventListener("touchcancel", handleWindowTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("touchmove", handleWindowTouchMove);
      window.removeEventListener("touchend", handleWindowTouchEnd);
      window.removeEventListener("touchcancel", handleWindowTouchEnd);
    };
  }, [isDragging]);

  function getDockOffset(side, width) {
    const distance = Math.max(0, width - SUMMARY_CARD_PEEK_WIDTH);

    if (side === "right") {
      return distance;
    }

    if (side === "left") {
      return -distance;
    }

    return 0;
  }

  function shouldSkipDragStart(target) {
    return target instanceof Element && Boolean(target.closest("button, a, input, textarea, select"));
  }

  function beginDrag({ clientX, clientY, pointerId }) {
    if (dragRef.current) {
      return;
    }

    const width =
      cardRef.current?.offsetWidth ||
      (typeof window === "undefined" ? 360 : Math.max(window.innerWidth - 32, SUMMARY_CARD_PEEK_WIDTH));

    dragRef.current = {
      dockSideAtStart: dockSide,
      moved: false,
      pointerId,
      startX: clientX,
      startY: clientY,
      width,
    };
    setIsDragging(true);
  }

  function updateDragPosition(clientX, clientY, originalEvent) {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    const deltaX = clientX - drag.startX;
    const deltaY = clientY - drag.startY;

    if (!drag.moved && Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) {
      return;
    }

    drag.moved = true;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      originalEvent?.preventDefault?.();
    }

    const maxOffset = Math.max(0, drag.width - SUMMARY_CARD_PEEK_WIDTH);
    const baseOffset = getDockOffset(drag.dockSideAtStart, drag.width);
    const nextOffset = clampNumber(baseOffset + deltaX, -maxOffset, maxOffset);

    setDragOffsetX(nextOffset - baseOffset);
  }

  function finishDragAt(clientX) {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    const maxOffset = Math.max(0, drag.width - SUMMARY_CARD_PEEK_WIDTH);
    const baseOffset = getDockOffset(drag.dockSideAtStart, drag.width);
    const finalOffset = clampNumber(baseOffset + clientX - drag.startX, -maxOffset, maxOffset);
    const threshold = Math.min(140, Math.max(72, maxOffset * 0.32));

    if (finalOffset > threshold) {
      setDockSide("right");
    } else if (finalOffset < -threshold) {
      setDockSide("left");
    } else {
      setDockSide(null);
    }

    setDragOffsetX(0);
    setIsDragging(false);
    dragRef.current = null;
  }

  function handlePointerDown(event) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    if (shouldSkipDragStart(event.target)) {
      return;
    }

    beginDrag({
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    updateDragPosition(event.clientX, event.clientY, event);
  }

  function finishPointerDrag(event) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    finishDragAt(event.clientX);
  }

  function handleMouseDown(event) {
    if (event.button !== 0 || shouldSkipDragStart(event.target)) {
      return;
    }

    beginDrag({
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: "mouse",
    });
  }

  function handleTouchStart(event) {
    if (shouldSkipDragStart(event.target)) {
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    beginDrag({
      clientX: touch.clientX,
      clientY: touch.clientY,
      pointerId: touch.identifier,
    });
  }

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-30 md:left-[calc(272px+1rem)]">
      <div
        className={`relative mx-auto max-w-5xl touch-pan-y rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-950/20 transition-transform sm:p-5 ${
          isDragging ? "cursor-grabbing duration-0" : "cursor-grab duration-300 ease-out"
        }`}
        onMouseDown={handleMouseDown}
        onPointerCancel={finishPointerDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onTouchStart={handleTouchStart}
        ref={cardRef}
        style={{ transform: `translate3d(${translateX}px, 0, 0)` }}
      >
        {dockSide ? (
          <button
            aria-label="Show summary card"
            className={`absolute top-1/2 z-10 flex h-16 w-10 -translate-y-1/2 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white shadow-lg shadow-slate-950/25 transition hover:bg-slate-800 ${
              dockSide === "right" ? "left-2" : "right-2"
            }`}
            onClick={() => setDockSide(null)}
            type="button"
          >
            {dockSide === "right" ? "<" : ">"}
          </button>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-words text-lg font-semibold text-slate-950">
                {contact.cardTitle || contact.typeLabel}: {contact.name}
              </p>
              <Badge tone={getContactTypeTone(contact.contactType)}>{contact.typeLabel}</Badge>
              <Badge tone={contact.statusTone}>{contact.statusLabel}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{contact.summaryLine}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={mode === "call" ? "emerald" : "blue"}>{modeLabel}</Badge>
            <Badge tone={getStatusTone(statusLabel)}>{statusLabel}</Badge>
            <button
              aria-label="Dock summary card"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-sm font-black text-slate-600 transition hover:bg-slate-50"
              onClick={() => setDockSide("right")}
              type="button"
            >
              &gt;
            </button>
            <button
              aria-label="Close summary card"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-sm font-black text-slate-600 transition hover:bg-slate-50"
              onClick={onClose}
              type="button"
            >
              X
            </button>
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Quick summary
        </p>
        <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-4">
          {summaryRows.map((row) => (
            <div className="rounded-xl bg-slate-50 px-3 py-2" key={`${contact.id}:${row.label}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {row.label}
              </p>
              <p className="mt-1 break-words text-sm font-semibold leading-5 text-slate-800">{row.value}</p>
            </div>
          ))}
        </div>
        {isReviewContact ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {["Customer", "Technician", "Candidate"].map((label) => (
              <button
                className="min-h-10 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                key={label}
                type="button"
              >
                Convert to {label}
              </button>
            ))}
            <button
              className="min-h-10 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              type="button"
            >
              Ignore / Archive
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PhonePage() {
  const repository = getOperationsRepository();
  const location = useLocation();
  const navigate = useNavigate();
  const [rawNumber, setRawNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [contactType, setContactType] = useState("customer");
  const [status, setStatus] = useState("Ready");
  const [isTextComposerOpen, setIsTextComposerOpen] = useState(false);
  const [smsRecipientQuery, setSmsRecipientQuery] = useState("");
  const [smsDraftContact, setSmsDraftContact] = useState(null);
  const [smsBody, setSmsBody] = useState("");
  const [smsStatus, setSmsStatus] = useState("Ready");
  const [smsMessage, setSmsMessage] = useState("Write a text message to send from the SignalWire phone.");
  const [activeCalls, setActiveCalls] = useState([]);
  const [activeCallsError, setActiveCallsError] = useState(null);
  const [activeCallsFetchedAt, setActiveCallsFetchedAt] = useState(null);
  const [directoryRefreshNonce, setDirectoryRefreshNonce] = useState(0);
  const [recentCalls, setRecentCalls] = useState(() => readRecentCalls());
  const [contactSearch, setContactSearch] = useState("");
  const [contactListFilter, setContactListFilter] = useState("all");
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [interactionContext, setInteractionContext] = useState(null);
  const [activeCallTarget, setActiveCallTarget] = useState(null);
  const [showCallKeypad, setShowCallKeypad] = useState(false);
  const audioContextRef = useRef(null);
  const activeToneRef = useRef(null);
  const ringingRef = useRef({ intervalId: null, burst: null });
  const smsRecipientSearchRef = useRef(null);
  const smsComposerRef = useRef(null);
  const directoryQuery = useAsyncValue(async () => {
    const [customers, techniciansPageData, communicationsPageData, liveHiringCandidates] = await Promise.all([
      repository.customers.list(),
      repository.getTechniciansPageData(),
      repository.getCommunicationsPageData(),
      requestLiveHiringCandidates().catch(() => null),
    ]);

    return {
      customers,
      technicians: techniciansPageData?.technicians || [],
      hiringCandidates: liveHiringCandidates?.candidates || techniciansPageData?.hiringCandidates || [],
      communicationRecords: communicationsPageData?.communicationRecords || [],
      unmatchedInboundRecords: communicationsPageData?.unmatchedInboundRecords || [],
    };
  }, [repository, directoryRefreshNonce]);
  const formattedNumber = useMemo(() => formatUsPhone(rawNumber), [rawNumber]);
  const e164Number = useMemo(() => toE164(rawNumber), [rawNumber]);
  const trimmedCustomerName = customerName.trim();
  const customerDirectory = directoryQuery.data?.customers || [];
  const technicianDirectory = directoryQuery.data?.technicians || [];
  const matchedCustomer = useMemo(
    () => findSavedCustomerByPhone(customerDirectory, e164Number || rawNumber),
    [customerDirectory, e164Number, rawNumber],
  );
  const matchedTechnician = useMemo(
    () => findSavedTechnicianByPhone(technicianDirectory, e164Number || rawNumber),
    [technicianDirectory, e164Number, rawNumber],
  );
  const contactDirectory = useMemo(
    () =>
      buildContactDirectory(
        customerDirectory,
        technicianDirectory,
        directoryQuery.data?.hiringCandidates || [],
        directoryQuery.data?.communicationRecords || [],
        directoryQuery.data?.unmatchedInboundRecords || [],
      ),
    [customerDirectory, directoryQuery.data, technicianDirectory],
  );
  const smsQueryPhone = useMemo(
    () => toE164(sanitizeDialValue(smsRecipientQuery)),
    [smsRecipientQuery],
  );
  const smsDraftContactPhone = smsDraftContact?.primaryPhone || smsDraftContact?.phone || "";
  const smsE164Number = useMemo(() => {
    const selectedPhone = toE164(sanitizeDialValue(smsDraftContactPhone));

    if (selectedPhone) {
      return selectedPhone;
    }

    if (smsQueryPhone) {
      return smsQueryPhone;
    }

    return smsRecipientQuery.trim() ? "" : e164Number;
  }, [e164Number, smsDraftContactPhone, smsQueryPhone, smsRecipientQuery]);
  const smsRecipientMatches = useMemo(() => {
    if (!isTextComposerOpen) {
      return [];
    }

    const query = smsRecipientQuery.trim();

    return contactDirectory
      .filter((contact) => !query || contactMatchesSearch(contact, query))
      .filter((contact) => toE164(sanitizeDialValue(contact.primaryPhone)))
      .slice(0, 6);
  }, [contactDirectory, isTextComposerOpen, smsRecipientQuery]);
  const filteredContacts = useMemo(
    () =>
      contactDirectory
        .filter((contact) => contactListFilter === "all" || contact.contactType === contactListFilter)
        .filter((contact) => contactMatchesSearch(contact, contactSearch))
        .slice(0, MAX_VISIBLE_CONTACTS),
    [contactDirectory, contactListFilter, contactSearch],
  );
  const selectedContact =
    contactDirectory.find((contact) => contact.id === selectedContactId) || null;
  const activeMatchedContact = contactType === "technician" ? matchedTechnician : matchedCustomer;
  const activeDirectoryContact = useMemo(() => {
    const activeSourceId = activeMatchedContact?.customerId || activeMatchedContact?.techId || null;
    const activePhone = normalizePhoneLookup(e164Number || rawNumber);

    if (activeSourceId) {
      const matchedById = contactDirectory.find(
        (contact) => contact.contactType === contactType && contact.sourceId === activeSourceId,
      );

      if (matchedById) {
        return matchedById;
      }
    }

    if (!activePhone) {
      return null;
    }

    const phoneMatches = contactDirectory.filter((contact) =>
      [contact.primaryPhone, contact.secondaryPhone]
        .map(normalizePhoneLookup)
        .some((phone) => phone && phone === activePhone),
    );
    const exactTypeMatch = phoneMatches.find((contact) => contact.contactType === contactType);

    return exactTypeMatch || phoneMatches.sort((left, right) => (right.priority || 0) - (left.priority || 0))[0] || null;
  }, [activeMatchedContact, contactDirectory, contactType, e164Number, rawNumber]);
  const interactionContact = useMemo(() => {
    if (activeDirectoryContact) {
      return activeDirectoryContact;
    }

    if (!rawNumber && !trimmedCustomerName) {
      return null;
    }

    return buildManualContactSummary({
      contactType,
      name: trimmedCustomerName,
      phone: e164Number || rawNumber,
    });
  }, [activeDirectoryContact, contactType, e164Number, rawNumber, trimmedCustomerName]);
  const callCustomerName = activeDirectoryContact?.name || activeMatchedContact?.name || trimmedCustomerName;
  const callTargetLabel = callCustomerName || formattedNumber || e164Number || "No number entered";
  const isActiveCallSession =
    Boolean(activeCallTarget) && (status === "Calling" || status === "Sent" || status === "Failed");
  const shouldShowInCallScreen = isActiveCallSession && !showCallKeypad;
  const canCall = Boolean(e164Number) && !isActiveCallSession && status !== "Calling";
  const smsTargetLabel =
    smsDraftContact?.name ||
    (smsE164Number ? formatUsPhone(smsE164Number) || smsE164Number : "Choose a recipient");
  const canSendText = Boolean(smsE164Number) && smsBody.trim().length > 0 && smsStatus !== "Sending";
  const liveCallCount = activeCalls.length || (status === "Calling" ? 1 : 0);
  const activeInteractionContact =
    interactionContext === "text" && smsDraftContact ? smsDraftContact : interactionContact;
  const shouldShowInteractionSummary = Boolean(interactionContext && activeInteractionContact);

  const refreshActiveCalls = useCallback(async () => {
    try {
      const result = await requestActiveCalls();
      setActiveCalls(result.calls || []);
      setActiveCallsFetchedAt(result.fetchedAt || new Date().toISOString());
      setActiveCallsError(null);
    } catch (error) {
      setActiveCallsError(error);
    }
  }, []);

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
    setCustomerName("");
    setStatus("Ready");
    setInteractionContext(null);
    setActiveCallTarget(null);
    setShowCallKeypad(false);
  }

  function focusTextRecipientSearch() {
    window.setTimeout(() => {
      smsRecipientSearchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      smsRecipientSearchRef.current?.focus();
    }, 50);
  }

  function openTextComposer() {
    const targetContact = activeDirectoryContact || selectedContact || null;
    const targetPhone = targetContact?.primaryPhone || e164Number || rawNumber;

    setIsTextComposerOpen(true);
    setSmsDraftContact(targetContact);
    setSmsRecipientQuery(targetContact?.name || formatUsPhone(targetPhone) || targetPhone || "");
    setSmsStatus("Ready");
    setSmsMessage("Choose a contact or enter a phone number, then write your text.");

    if (targetPhone) {
      setInteractionContext("text");
    }

    focusTextRecipientSearch();
  }

  function updateSmsRecipientQuery(value) {
    const nextPhone = toE164(sanitizeDialValue(value));

    setSmsRecipientQuery(value);
    setSmsDraftContact(null);
    setSelectedContactId(null);

    if (nextPhone) {
      setRawNumber(sanitizeDialValue(value));
      setCustomerName("");
      setInteractionContext("text");
    }
  }

  function chooseSmsRecipient(contact) {
    const targetPhone = contact.primaryPhone || contact.phone || "";

    setSmsDraftContact(contact);
    setSmsRecipientQuery(contact.name || formatUsPhone(targetPhone) || targetPhone || "");
    setIsTextComposerOpen(true);
    setSelectedContactId(contact.id || null);
    loadDialTarget(contact);
    setInteractionContext("text");
    setSmsStatus("Ready");
    setSmsMessage(`${contact.name || formatUsPhone(targetPhone) || "Contact"} is ready for a SignalWire text.`);
    focusSmsComposer();
  }

  function rememberRecentCall({ contactType: callContactType, name, phone, outcome }) {
    const normalizedPhone = toE164(sanitizeDialValue(phone)) || phone;
    const calledAt = new Date().toISOString();

    setRecentCalls((currentCalls) => {
      const targetPhone = normalizePhoneLookup(normalizedPhone);
      const nextCalls = [
        {
          id: `${calledAt}:${callContactType}:${normalizedPhone}`,
          contactType: callContactType,
          name: name || formatUsPhone(normalizedPhone) || normalizedPhone,
          phone: normalizedPhone,
          outcome,
          calledAt,
        },
        ...currentCalls.filter(
          (call) =>
            call.contactType !== callContactType ||
            normalizePhoneLookup(call.phone) !== targetPhone,
        ),
      ].slice(0, MAX_RECENT_CALLS);

      return nextCalls;
    });
  }

  function loadDialTarget(target) {
    const targetPhone = target.primaryPhone || target.phone || "";
    const targetContactType = target.contactType || "customer";

    setRawNumber(sanitizeDialValue(targetPhone));
    setCustomerName(target.name || "");
    setContactType(targetContactType);
    setSelectedContactId(target.id || null);
    setStatus("Ready");
    setActiveCallTarget(null);
    setShowCallKeypad(false);
  }

  function focusSmsComposer() {
    window.setTimeout(() => {
      smsComposerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      smsComposerRef.current?.focus();
    }, 50);
  }

  function loadTextTarget(target) {
    const targetPhone = target.primaryPhone || target.phone || "";
    const targetName = target.name || formatUsPhone(targetPhone) || "Contact";

    loadDialTarget(target);
    setIsTextComposerOpen(true);
    setSmsDraftContact(target);
    setSmsRecipientQuery(target.name || formatUsPhone(targetPhone) || targetPhone || "");
    setInteractionContext("text");
    setSmsStatus("Ready");
    setSmsMessage(`${targetName} is ready for a SignalWire text.`);
    focusSmsComposer();
  }

  async function startCall(callOverride = {}) {
    const draftRawNumber = callOverride.phone ? sanitizeDialValue(callOverride.phone) : rawNumber;
    const draftE164Number = toE164(draftRawNumber);

    if (!draftE164Number || status === "Calling" || isActiveCallSession) {
      return;
    }

    const selectedAgentPhone = null;
    const draftContactType = callOverride.contactType || contactType;
    const isTechnicianCall = draftContactType === "technician";
    const isCandidateCall = draftContactType === "candidate";
    const isReviewCall = draftContactType === "review";
    const requestContactType = isTechnicianCall ? "technician" : "customer";
    const draftFormattedNumber = formatUsPhone(draftRawNumber);
    const draftMatchedCustomer = isTechnicianCall
      ? null
      : findSavedCustomerByPhone(customerDirectory, draftE164Number || draftRawNumber);
    const draftMatchedTechnician = isTechnicianCall
      ? findSavedTechnicianByPhone(technicianDirectory, draftE164Number || draftRawNumber)
      : null;
    const draftMatchedContact =
      isTechnicianCall ? draftMatchedTechnician : isCandidateCall || isReviewCall ? null : draftMatchedCustomer;
    const draftName =
      draftMatchedContact?.name ||
      String(callOverride.name || "").trim() ||
      activeDirectoryContact?.name ||
      customerName.trim();

    setInteractionContext("call");
    setActiveCallTarget({
      contactType: draftContactType,
      name: draftName,
      phone: draftE164Number,
    });
    setShowCallKeypad(false);
    setStatus("Calling");
    startRinging();

    try {
      const shouldRefreshDirectoryAfterCall = !draftMatchedContact;
      const result = await requestClickToCall({
        ...(draftMatchedCustomer?.customerId && !isTechnicianCall && !isCandidateCall && !isReviewCall
          ? { customerId: draftMatchedCustomer.customerId }
          : {}),
        contactType: requestContactType,
        customerName: draftName || draftFormattedNumber || draftE164Number,
        customerPhone: draftE164Number,
        persistCustomerContact: !isTechnicianCall && !isCandidateCall && !isReviewCall && !draftMatchedCustomer,
        persistTechnicianContact: isTechnicianCall && !draftMatchedTechnician,
        ...(selectedAgentPhone ? { agentPhone: selectedAgentPhone } : {}),
        triggerSource: isCandidateCall
          ? "manual_hiring_ui"
          : isReviewCall
            ? "manual_review_contact_ui"
            : "manual_phone_dialer",
      });
      stopRinging();
      setStatus("Sent");
      rememberRecentCall({
        contactType: draftContactType,
        name: draftName,
        phone: draftE164Number,
        outcome: "sent",
      });
      const savedContactStatus =
        result.savedContactStatus ||
        (isTechnicianCall ? result.technicianContactStatus : result.customerContactStatus);
      if (
        shouldRefreshDirectoryAfterCall ||
        ["created", "matched", "ambiguous"].includes(savedContactStatus)
      ) {
        repository.clearRuntimeCaches?.();
        setDirectoryRefreshNonce((current) => current + 1);
      }
      refreshActiveCalls();
    } catch (error) {
      stopRinging();
      setStatus("Failed");
      rememberRecentCall({
        contactType: draftContactType,
        name: draftName,
        phone: draftE164Number,
        outcome: "failed",
      });
    }
  }

  async function sendTextMessage(textOverride = null) {
    const body = String(textOverride ?? smsBody).trim();
    const draftE164Number = smsE164Number;

    if (!draftE164Number || !body || smsStatus === "Sending") {
      return;
    }

    const draftContactType = smsDraftContact?.contactType || contactType;
    const isTechnicianText = draftContactType === "technician";
    const isCandidateText = draftContactType === "candidate";
    const isReviewText = draftContactType === "review";
    const requestContactType = isTechnicianText ? "technician" : "customer";
    const draftMatchedCustomer = isTechnicianText
      ? null
      : findSavedCustomerByPhone(customerDirectory, draftE164Number);
    const draftMatchedTechnician = isTechnicianText
      ? findSavedTechnicianByPhone(technicianDirectory, draftE164Number)
      : null;
    const draftMatchedContact =
      smsDraftContact ||
      (isTechnicianText ? draftMatchedTechnician : isCandidateText || isReviewText ? null : draftMatchedCustomer);
    const draftName =
      draftMatchedContact?.name ||
      trimmedCustomerName ||
      formatUsPhone(draftE164Number) ||
      draftE164Number;
    const shouldRefreshDirectoryAfterText = !draftMatchedContact;

    setInteractionContext("text");
    setSmsStatus("Sending");
    setSmsMessage(`Sending text to ${draftName}.`);

    try {
      const result = await requestOutboundTextMessage({
        ...(draftMatchedCustomer?.customerId && !isTechnicianText && !isCandidateText && !isReviewText
          ? { customerId: draftMatchedCustomer.customerId }
          : {}),
        contactType: requestContactType,
        customerName: draftName,
        customerPhone: draftE164Number,
        toNumber: draftE164Number,
        body,
        persistCustomerContact: !isTechnicianText && !isCandidateText && !isReviewText && !draftMatchedCustomer,
        persistTechnicianContact: isTechnicianText && !draftMatchedTechnician,
        triggerSource: isCandidateText
          ? "manual_hiring_ui"
          : isReviewText
            ? "manual_review_contact_ui"
            : "manual_phone_dialer",
      });
      const savedContactStatus =
        result.savedContactStatus ||
        (isTechnicianText ? result.technicianContactStatus : result.customerContactStatus);

      if (
        shouldRefreshDirectoryAfterText ||
        ["created", "matched", "ambiguous"].includes(savedContactStatus)
      ) {
        repository.clearRuntimeCaches?.();
        setDirectoryRefreshNonce((current) => current + 1);
      }

      setSmsStatus("Sent");
      setSmsMessage(result.message || `Text sent to ${draftName}.`);
      setSmsBody("");
    } catch (error) {
      setSmsStatus("Failed");
      setSmsMessage(error.message);
    }
  }

  function callRecentCall(call) {
    loadDialTarget({
      contactType: call.contactType,
      name: call.name,
      phone: call.phone,
    });
    startCall({
      contactType: call.contactType,
      name: call.name,
      phone: call.phone,
    });
  }

  function callContact(contact) {
    loadDialTarget(contact);
    startCall({
      contactType: contact.contactType,
      name: contact.name,
      phone: contact.primaryPhone,
    });
  }

  function textContact(contact) {
    loadTextTarget(contact);
  }

  function resetCallState() {
    stopRinging();
    setStatus("Ready");
    setInteractionContext(null);
    setActiveCallTarget(null);
    setShowCallKeypad(false);
  }

  useEffect(() => {
    if (!location.search) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const phone = params.get("phone");

    if (!phone) {
      return;
    }

    const requestedContactType = params.get("contactType");
    const target = {
      contactType: ["customer", "technician", "candidate", "review"].includes(requestedContactType)
        ? requestedContactType
        : "customer",
      name: params.get("name") || "",
      phone,
    };
    const mode = params.get("mode") === "text" ? "text" : "call";

    if (mode === "text") {
      loadTextTarget(target);
    } else {
      loadDialTarget(target);
      setInteractionContext("call");
    }

    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    writeRecentCalls(recentCalls);
  }, [recentCalls]);

  useEffect(() => {
    refreshActiveCalls();
    const intervalId = window.setInterval(refreshActiveCalls, ACTIVE_CALLS_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [refreshActiveCalls]);

  useEffect(() => {
    if (matchedTechnician && !matchedCustomer && contactType !== "technician") {
      setContactType("technician");
      return;
    }

    if (matchedCustomer && !matchedTechnician && contactType !== "customer") {
      setContactType("customer");
    }
  }, [contactType, matchedCustomer, matchedTechnician]);

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
      contentClassName="bg-[#11141c] p-4 sm:p-6 lg:p-8"
    >
      <div
        className={`mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,430px)_1fr] ${
          shouldShowInteractionSummary ? "pb-56 sm:pb-44" : ""
        }`}
      >
        <Card className="border-white/10 bg-[#1c1e26] p-4 text-white shadow-2xl shadow-black/20 sm:p-6">
          {shouldShowInCallScreen ? (
            <InCallScreen
              onEnd={resetCallState}
              onShowKeypad={() => setShowCallKeypad(true)}
              status={status}
              targetName={activeCallTarget?.name}
              targetPhone={activeCallTarget?.phone}
            />
          ) : (
            <>
              {isActiveCallSession ? (
                <button
                  className="mb-4 flex min-h-[52px] w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.11]"
                  onClick={() => setShowCallKeypad(false)}
                  type="button"
                >
                  <span>Return to call screen</span>
                  <Badge tone={getStatusTone(status)}>{status}</Badge>
                </button>
              ) : null}
              <div className="rounded-3xl border border-white/10 bg-[#10131b] p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Dialer
              </p>
              <Badge tone={getStatusTone(status)}>{status}</Badge>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
              {CONTACT_TYPE_OPTIONS.map((option) => (
                <button
                  className={`min-h-[44px] rounded-xl px-3 text-sm font-semibold transition ${
                    contactType === option.value
                      ? "bg-emerald-500 text-white"
                      : "text-slate-300 hover:bg-white/[0.07]"
                  }`}
                  key={option.value}
                  onClick={() => setContactType(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="mt-6 block text-sm font-semibold text-slate-300">
              Contact number
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
            {matchedCustomer || matchedTechnician ? (
              <div className="mt-4 grid gap-3">
                {matchedCustomer ? (
                  <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                      Saved customer
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">{matchedCustomer.name}</p>
                    <p className="mt-1 text-sm text-emerald-100/80">
                      {[matchedCustomer.primaryPhone, matchedCustomer.customerSegment].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                ) : null}
                {matchedTechnician ? (
                  <div className="rounded-2xl border border-sky-300/30 bg-sky-400/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">
                      Saved technician
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">{matchedTechnician.name}</p>
                    <p className="mt-1 text-sm text-sky-100/80">
                      {[matchedTechnician.primaryPhone, matchedTechnician.serviceArea].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
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
            {isActiveCallSession ? (
              <>
                <button
                  className="min-h-[60px] rounded-2xl bg-slate-700 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-600"
                  onClick={() => setShowCallKeypad(false)}
                  type="button"
                >
                  Call screen
                </button>
                <button
                  className="min-h-[60px] rounded-2xl bg-red-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-red-500"
                  onClick={resetCallState}
                  type="button"
                >
                  End
                </button>
              </>
            ) : (
              <>
                <button
                  className="min-h-[60px] rounded-2xl bg-emerald-500 px-5 py-3 text-base font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  disabled={!canCall}
                  onClick={() => startCall()}
                  type="button"
                >
                  Call from SignalWire
                </button>
                <button
                  className="min-h-[60px] rounded-2xl bg-slate-700 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                  disabled={status === "Ready" && !rawNumber}
                  onClick={resetCallState}
                  type="button"
                >
                  Reset
                </button>
              </>
            )}
          </div>

          <button
            className="mt-5 flex min-h-[64px] w-full items-center justify-between gap-4 rounded-2xl border border-sky-300/30 bg-sky-500 px-5 py-4 text-left text-base font-semibold text-white transition hover:bg-sky-400"
            onClick={() => {
              if (isTextComposerOpen) {
                setIsTextComposerOpen(false);
                return;
              }

              openTextComposer();
            }}
            type="button"
          >
            <span>Text message</span>
            <Badge tone={getStatusTone(smsStatus)}>{smsStatus}</Badge>
          </button>

          {isTextComposerOpen ? (
            <div className="mt-3 rounded-3xl border border-white/10 bg-[#10131b] p-5">
              <label className="block text-sm font-semibold text-slate-300">
                Recipient
                <input
                  ref={smsRecipientSearchRef}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300"
                  inputMode="tel"
                  onChange={(event) => updateSmsRecipientQuery(event.target.value)}
                  placeholder="Search contacts or enter phone"
                  type="search"
                  value={smsRecipientQuery}
                />
              </label>

              {smsRecipientMatches.length ? (
                <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto pr-1">
                  {smsRecipientMatches.map((contact) => (
                    <button
                      className={`rounded-2xl border p-3 text-left transition ${
                        smsDraftContact?.id === contact.id
                          ? "border-sky-300/50 bg-sky-400/10"
                          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                      }`}
                      key={contact.id}
                      onClick={() => chooseSmsRecipient(contact)}
                      type="button"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{contact.name}</p>
                        <Badge tone={getContactTypeTone(contact.contactType)}>
                          {getContactTypeTitle(contact.contactType)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {[formatUsPhone(contact.primaryPhone) || contact.primaryPhone, contact.label]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  To
                </p>
                <p className="mt-1 text-base font-semibold text-white">{smsTargetLabel}</p>
                {smsE164Number ? (
                  <p className="mt-1 text-sm text-slate-400">
                    {formatUsPhone(smsE164Number) || smsE164Number}
                  </p>
                ) : null}
              </div>

              <textarea
                ref={smsComposerRef}
                className="mt-4 min-h-[132px] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300"
                onChange={(event) => {
                  setSmsBody(event.target.value);
                  if (smsE164Number) {
                    setInteractionContext("text");
                  }
                }}
                onFocus={() => {
                  if (smsE164Number) {
                    setInteractionContext("text");
                  }
                }}
                placeholder="Write a text to send from the SignalWire phone"
                value={smsBody}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {SMS_TEMPLATES.map((template) => (
                  <button
                    className="rounded-full border border-white/10 px-3 py-2 text-left text-xs font-semibold text-slate-300 transition hover:bg-white/[0.07]"
                    key={template.label}
                    onClick={() => setSmsBody(template.body)}
                    type="button"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
              <button
                className="mt-4 min-h-[54px] w-full rounded-2xl bg-sky-500 px-5 py-3 text-base font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                disabled={!canSendText}
                onClick={() => sendTextMessage()}
                type="button"
              >
                Send text from SignalWire
              </button>
              <p className="mt-3 text-sm leading-6 text-slate-300">{smsMessage}</p>
            </div>
          ) : null}
            </>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-[#1c1e26] p-5 text-white sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <p className="section-title">Live calls</p>
              <Badge tone={liveCallCount ? "emerald" : "slate"}>
                {liveCallCount ? "In process" : "Idle"}
              </Badge>
            </div>
            {liveCallCount ? (
              <div className="mt-4 grid gap-3">
                {status === "Calling" && activeCalls.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-white">{callTargetLabel}</p>
                      <Badge tone="blue">calling</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      The CRM has requested the bridge call. Waiting for the provider live-status feed.
                    </p>
                  </div>
                ) : null}
                {activeCalls.map((call) => (
                  <div
                    className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4"
                    key={call.sid}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-white">
                        {[formatUsPhone(call.from || ""), formatUsPhone(call.to || "")]
                          .filter(Boolean)
                          .join(" → ") || "Live call"}
                      </p>
                      <Badge tone={getProviderCallTone(call.status)}>
                        {formatProviderCallStatus(call.status)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {[call.direction, formatDateTimeLabel(call.startTime || call.createdAt), formatCallDuration(call.startTime, call.durationSeconds)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-2 break-all text-xs text-slate-500">{call.sid}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                No call is currently in process.
              </div>
            )}
            {activeCallsError ? (
              <p className="mt-3 text-sm leading-6 text-rose-300">{activeCallsError.message}</p>
            ) : activeCallsFetchedAt ? (
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Updated {formatDateTimeLabel(activeCallsFetchedAt)}
              </p>
            ) : null}
          </Card>

          <Card className="border-white/10 bg-[#1c1e26] p-5 text-white sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <p className="section-title">Recent calls</p>
              {recentCalls.length ? (
                <button
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.07]"
                  onClick={() => setRecentCalls([])}
                  type="button"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {recentCalls.length ? (
              <div className="mt-4 grid gap-3">
                {recentCalls.map((call) => (
                  <div
                    className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                    key={call.id}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="text-left text-base font-semibold text-white underline decoration-white/20 underline-offset-4 transition hover:text-emerald-200"
                          disabled={isActiveCallSession}
                          onClick={() => callRecentCall(call)}
                          type="button"
                        >
                          {formatUsPhone(call.phone)}
                        </button>
                        <Badge tone={getCallOutcomeTone(call.outcome)}>
                          {call.outcome === "failed" ? "Failed" : "Sent"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {[call.name, getContactTypeTitle(call.contactType), formatDateTimeLabel(call.calledAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                      <button
                        className="min-h-[40px] rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        disabled={isActiveCallSession}
                        onClick={() => callRecentCall(call)}
                        type="button"
                      >
                        Call
                      </button>
                      <button
                        className="min-h-[40px] rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:bg-indigo-400"
                        onClick={() =>
                          loadTextTarget({
                            contactType: call.contactType,
                            name: call.name,
                            phone: call.phone,
                          })
                        }
                        type="button"
                      >
                        Text
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                No recent calls.
              </div>
            )}
          </Card>

          <Card className="border-white/10 bg-[#1c1e26] p-5 text-white sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <p className="section-title">People</p>
              <Badge tone="slate">{contactDirectory.length}</Badge>
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-300">
              Search people
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300"
                inputMode="tel"
                onChange={(event) => setContactSearch(event.target.value)}
                placeholder="Search by name, phone, area, status, or transcript"
                type="search"
                value={contactSearch}
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1 sm:grid-cols-5">
              {CONTACT_LIST_FILTERS.map((option) => (
                <button
                  className={`min-h-[40px] rounded-xl px-2 text-xs font-semibold transition ${
                    contactListFilter === option.value
                      ? "bg-sky-500 text-white"
                      : "text-slate-300 hover:bg-white/[0.07]"
                  }`}
                  key={option.value}
                  onClick={() => setContactListFilter(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {filteredContacts.length ? (
                filteredContacts.map((contact) => (
                  <div
                    className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_auto] sm:items-center ${
                      selectedContact?.id === contact.id
                        ? "border-sky-300/40 bg-sky-400/10"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                    key={contact.id}
                  >
                    <button
                      className="text-left"
                      onClick={() => {
                        setSelectedContactId(contact.id);
                        loadDialTarget(contact);
                      }}
                      type="button"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{contact.name}</p>
                        <Badge tone={getContactTypeTone(contact.contactType)}>
                          {getContactTypeTitle(contact.contactType)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {[formatUsPhone(contact.primaryPhone) || "No phone", contact.label]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </button>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                      <button
                        className="min-h-[40px] rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        disabled={isActiveCallSession || !toE164(sanitizeDialValue(contact.primaryPhone))}
                        onClick={() => callContact(contact)}
                        type="button"
                      >
                        Call
                      </button>
                      <button
                        className="min-h-[40px] rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        disabled={!toE164(sanitizeDialValue(contact.primaryPhone))}
                        onClick={() => textContact(contact)}
                        type="button"
                      >
                        Text
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                  No matching contacts.
                </div>
              )}
            </div>
            {selectedContact ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#10131b] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Selected contact
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">{selectedContact.name}</p>
                  </div>
                  <Badge tone={getContactTypeTone(selectedContact.contactType)}>
                    {getContactTypeTitle(selectedContact.contactType)}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-slate-300">
                  <p>{formatUsPhone(selectedContact.primaryPhone) || "No primary phone"}</p>
                  {selectedContact.secondaryPhone ? <p>{formatUsPhone(selectedContact.secondaryPhone)}</p> : null}
                  {selectedContact.email ? <p>{selectedContact.email}</p> : null}
                  <p>{selectedContact.label}</p>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
      {shouldShowInteractionSummary ? (
        <InteractionSummaryCard
          callStatus={status}
          contact={activeInteractionContact}
          mode={interactionContext}
          onClose={() => setInteractionContext(null)}
          smsStatus={smsStatus}
        />
      ) : null}
    </PageScaffold>
  );
}
