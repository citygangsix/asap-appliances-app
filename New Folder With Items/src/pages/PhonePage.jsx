import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const CONTACT_TYPE_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "technician", label: "Technician" },
];
const CONTACT_LIST_FILTERS = [
  { value: "all", label: "All" },
  { value: "customer", label: "Customers" },
  { value: "technician", label: "Technicians" },
];
const ACTIVE_CALLS_REFRESH_INTERVAL_MS = 5000;
const RECENT_CALLS_STORAGE_KEY = "asap-phone-recent-calls";
const MAX_RECENT_CALLS = 12;
const MAX_VISIBLE_CONTACTS = 80;
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

function getContactTypeLabel(contactType) {
  return contactType === "technician" ? "technician" : "customer";
}

function getContactTypeTitle(contactType) {
  return contactType === "technician" ? "Technician" : "Customer";
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

function buildContactDirectory(customers, technicians) {
  return [
    ...customers.map((customer) => ({
      id: `customer:${customer.customerId}`,
      contactType: "customer",
      name: customer.name,
      primaryPhone: customer.primaryPhone || "",
      secondaryPhone: customer.secondaryPhone || "",
      email: customer.email || "",
      label: customer.customerSegment || customer.serviceArea || "Customer",
    })),
    ...technicians.map((technician) => ({
      id: `technician:${technician.techId}`,
      contactType: "technician",
      name: technician.name,
      primaryPhone: technician.primaryPhone || "",
      secondaryPhone: "",
      email: technician.email || "",
      label: technician.serviceArea || "Technician",
    })),
  ].sort((left, right) => left.name.localeCompare(right.name));
}

function contactMatchesSearch(contact, searchValue) {
  const searchText = String(searchValue || "").trim().toLowerCase();

  if (!searchText) {
    return true;
  }

  const searchDigits = searchText.replace(/\D/g, "");
  const contactPhones = [contact.primaryPhone, contact.secondaryPhone].filter(Boolean);

  if (searchDigits) {
    return contactPhones.some((phone) => {
      const phoneDigits = normalizePhoneLookup(phone) || "";
      return phoneDigits.includes(searchDigits);
    });
  }

  return [contact.name, contact.label, contact.email]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(searchText));
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

export function PhonePage() {
  const repository = getOperationsRepository();
  const [rawNumber, setRawNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [contactType, setContactType] = useState("customer");
  const [agentPhone, setAgentPhone] = useState("");
  const [status, setStatus] = useState("Ready");
  const [message, setMessage] = useState("Enter a contact number and start the Twilio bridge.");
  const [smsBody, setSmsBody] = useState("");
  const [smsStatus, setSmsStatus] = useState("Ready");
  const [smsMessage, setSmsMessage] = useState("Write a text message to send from the Twilio phone.");
  const [activeCalls, setActiveCalls] = useState([]);
  const [activeCallsError, setActiveCallsError] = useState(null);
  const [activeCallsFetchedAt, setActiveCallsFetchedAt] = useState(null);
  const [directoryRefreshNonce, setDirectoryRefreshNonce] = useState(0);
  const [recentCalls, setRecentCalls] = useState(() => readRecentCalls());
  const [contactSearch, setContactSearch] = useState("");
  const [contactListFilter, setContactListFilter] = useState("all");
  const [selectedContactId, setSelectedContactId] = useState(null);
  const audioContextRef = useRef(null);
  const activeToneRef = useRef(null);
  const ringingRef = useRef({ intervalId: null, burst: null });
  const customersQuery = useAsyncValue(
    () => repository.customers.list(),
    [repository, directoryRefreshNonce],
  );
  const techniciansQuery = useAsyncValue(
    () => repository.technicians.list(),
    [repository, directoryRefreshNonce],
  );
  const formattedNumber = useMemo(() => formatUsPhone(rawNumber), [rawNumber]);
  const formattedAgentPhone = useMemo(() => formatUsPhone(agentPhone), [agentPhone]);
  const e164Number = useMemo(() => toE164(rawNumber), [rawNumber]);
  const e164AgentPhone = useMemo(() => toE164(agentPhone), [agentPhone]);
  const trimmedCustomerName = customerName.trim();
  const customerDirectory = customersQuery.data || [];
  const technicianDirectory = techniciansQuery.data || [];
  const matchedCustomer = useMemo(
    () => findSavedCustomerByPhone(customerDirectory, e164Number || rawNumber),
    [customerDirectory, e164Number, rawNumber],
  );
  const matchedTechnician = useMemo(
    () => findSavedTechnicianByPhone(technicianDirectory, e164Number || rawNumber),
    [technicianDirectory, e164Number, rawNumber],
  );
  const contactDirectory = useMemo(
    () => buildContactDirectory(customerDirectory, technicianDirectory),
    [customerDirectory, technicianDirectory],
  );
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
  const callCustomerName = activeMatchedContact?.name || trimmedCustomerName;
  const callTargetLabel = callCustomerName || formattedNumber || e164Number || "No number entered";
  const activeContactTypeLabel = getContactTypeLabel(contactType);
  const canCall = Boolean(e164Number) && status !== "Calling";
  const canSendText = Boolean(e164Number) && smsBody.trim().length > 0 && smsStatus !== "Sending";
  const liveCallCount = activeCalls.length || (status === "Calling" ? 1 : 0);

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
    setMessage("Ready for the next Twilio bridge call.");
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

  function loadDialTarget(target, nextMessage = null) {
    const targetPhone = target.primaryPhone || target.phone || "";
    const targetContactType = target.contactType || "customer";

    setRawNumber(sanitizeDialValue(targetPhone));
    setCustomerName(target.name || "");
    setContactType(targetContactType);
    setSelectedContactId(target.id || null);
    setStatus("Ready");
    setMessage(
      nextMessage ||
        `${target.name || formatUsPhone(targetPhone) || "Contact"} loaded in the dialer.`,
    );
  }

  async function startCall(callOverride = {}) {
    const draftRawNumber = callOverride.phone ? sanitizeDialValue(callOverride.phone) : rawNumber;
    const draftE164Number = toE164(draftRawNumber);

    if (!draftE164Number || status === "Calling") {
      return;
    }

    const selectedAgentPhone = e164AgentPhone || null;
    const draftContactType = callOverride.contactType || contactType;
    const isTechnicianCall = draftContactType === "technician";
    const draftFormattedNumber = formatUsPhone(draftRawNumber);
    const draftMatchedCustomer = isTechnicianCall
      ? null
      : findSavedCustomerByPhone(customerDirectory, draftE164Number || draftRawNumber);
    const draftMatchedTechnician = isTechnicianCall
      ? findSavedTechnicianByPhone(technicianDirectory, draftE164Number || draftRawNumber)
      : null;
    const draftMatchedContact = isTechnicianCall ? draftMatchedTechnician : draftMatchedCustomer;
    const draftName = draftMatchedContact?.name || String(callOverride.name || customerName).trim();
    const draftTargetLabel = draftName || draftFormattedNumber || draftE164Number;

    setStatus("Calling");
    startRinging();
    setMessage(
      selectedAgentPhone
        ? `Calling ${formatUsPhone(selectedAgentPhone)} first. Answer it to connect ${draftTargetLabel}.`
        : `Calling the configured office phone first. Answer it to connect ${draftTargetLabel}.`,
    );

    try {
      const shouldRefreshDirectoryAfterCall = !draftMatchedContact;
      const result = await requestClickToCall({
        ...(draftMatchedCustomer?.customerId && !isTechnicianCall
          ? { customerId: draftMatchedCustomer.customerId }
          : {}),
        contactType: draftContactType,
        customerName: draftName || draftFormattedNumber || draftE164Number,
        customerPhone: draftE164Number,
        persistCustomerContact: !isTechnicianCall && !draftMatchedCustomer,
        persistTechnicianContact: isTechnicianCall && !draftMatchedTechnician,
        ...(selectedAgentPhone ? { agentPhone: selectedAgentPhone } : {}),
        triggerSource: "manual_phone_dialer",
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
      setMessage(
        result.message
          ? `${result.message} ${isTechnicianCall ? "Technician" : "Customer"} sees ${result.businessPhoneNumber || "the Twilio number"}.`
          : `Twilio is calling ${formatUsPhone(result.agentPhone || selectedAgentPhone || "") || "the configured phone"}. ${isTechnicianCall ? "Technician" : "Customer"} sees ${result.businessPhoneNumber || "the Twilio number"}.`,
      );
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
      setMessage(error.message);
    }
  }

  async function sendTextMessage(textOverride = null) {
    const body = String(textOverride ?? smsBody).trim();

    if (!e164Number || !body || smsStatus === "Sending") {
      return;
    }

    const isTechnicianText = contactType === "technician";
    const draftMatchedContact = isTechnicianText ? matchedTechnician : matchedCustomer;
    const draftName = draftMatchedContact?.name || trimmedCustomerName || formattedNumber || e164Number;
    const shouldRefreshDirectoryAfterText = !draftMatchedContact;

    setSmsStatus("Sending");
    setSmsMessage(`Sending text to ${draftName}.`);

    try {
      const result = await requestOutboundTextMessage({
        ...(matchedCustomer?.customerId && !isTechnicianText
          ? { customerId: matchedCustomer.customerId }
          : {}),
        contactType,
        customerName: draftName,
        customerPhone: e164Number,
        toNumber: e164Number,
        body,
        persistCustomerContact: !isTechnicianText && !matchedCustomer,
        persistTechnicianContact: isTechnicianText && !matchedTechnician,
        triggerSource: "manual_phone_dialer",
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
    loadDialTarget(
      {
        contactType: call.contactType,
        name: call.name,
        phone: call.phone,
      },
      `Calling ${call.name || formatUsPhone(call.phone)} again.`,
    );
    startCall({
      contactType: call.contactType,
      name: call.name,
      phone: call.phone,
    });
  }

  function callContact(contact) {
    loadDialTarget(contact, `Calling ${contact.name || formatUsPhone(contact.primaryPhone)}.`);
    startCall({
      contactType: contact.contactType,
      name: contact.name,
      phone: contact.primaryPhone,
    });
  }

  function textContact(contact) {
    loadDialTarget(contact, `Texting ${contact.name || formatUsPhone(contact.primaryPhone)}.`);
  }

  function resetCallState() {
    stopRinging();
    setStatus("Ready");
    setMessage("Ready for the next Twilio bridge call.");
  }

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
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
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
            <label className="mt-4 block text-sm font-semibold text-slate-300">
              {contactType === "technician" ? "Technician name" : "Customer name"}
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300 disabled:text-slate-400"
                disabled={Boolean(activeMatchedContact)}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder={
                  customersQuery.isLoading || techniciansQuery.isLoading
                    ? "Loading saved contacts"
                    : "Optional"
                }
                type="text"
                value={activeMatchedContact ? activeMatchedContact.name : customerName}
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
              onClick={() => startCall()}
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

          <div className="mt-5 rounded-3xl border border-white/10 bg-[#10131b] p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Text message
              </p>
              <Badge tone={getStatusTone(smsStatus)}>{smsStatus}</Badge>
            </div>
            <textarea
              className="mt-4 min-h-[132px] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300"
              onChange={(event) => setSmsBody(event.target.value)}
              placeholder="Write a text to send from the Twilio phone"
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
              Send text from Twilio
            </button>
            <p className="mt-3 text-sm leading-6 text-slate-300">{smsMessage}</p>
          </div>
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
            <p className="section-title">Call state</p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Call target
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">{callTargetLabel}</p>
              <p className="mt-1 text-sm text-slate-400">
                {activeMatchedContact ? activeMatchedContact.primaryPhone || e164Number : e164Number || formattedNumber}
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {activeContactTypeLabel}
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
                          disabled={status === "Calling"}
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
                        disabled={status === "Calling"}
                        onClick={() => callRecentCall(call)}
                        type="button"
                      >
                        Call
                      </button>
                      <button
                        className="min-h-[40px] rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:bg-indigo-400"
                        onClick={() =>
                          loadDialTarget(
                            {
                              contactType: call.contactType,
                              name: call.name,
                              phone: call.phone,
                            },
                            `Texting ${call.name || formatUsPhone(call.phone)}.`,
                          )
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
              <p className="section-title">Contacts</p>
              <Badge tone="slate">{contactDirectory.length}</Badge>
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-300">
              Search phone
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300"
                inputMode="tel"
                onChange={(event) => setContactSearch(event.target.value)}
                placeholder="Search by phone number"
                type="search"
                value={contactSearch}
              />
            </label>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
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
                        <Badge tone={contact.contactType === "technician" ? "blue" : "emerald"}>
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
                        disabled={status === "Calling" || !toE164(sanitizeDialValue(contact.primaryPhone))}
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
                  <Badge tone={selectedContact.contactType === "technician" ? "blue" : "emerald"}>
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
    </PageScaffold>
  );
}
