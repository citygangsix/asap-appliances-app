/** @typedef {import("../../types/models").HiringCandidate} HiringCandidate */

/** @type {HiringCandidate[]} */
export const hiringCandidates = [
  {
    candidateId: "cand-1",
    name: "Darius Cole",
    primaryPhone: "(214) 555-0177",
    email: "darius.cole@example.com",
    source: "Indeed",
    stage: "trial_scheduled",
    trade: "Laundry",
    city: "Plano",
    serviceArea: "North Dallas",
    availabilitySummary: "Available weekday afternoons and Saturdays.",
    payoutExpectationSummary: "Looking for per-call payout in the $120 to $150 range.",
    experienceSummary: "Three years on washers and dryers with sealed-system helper experience.",
    nextStep: "Confirm truck inventory and ride-along date.",
    callHighlights:
      "Indeed candidate open to immediate work in Plano and North Dallas. Discussed weekday afternoon coverage and payout expectations.",
    transcriptText:
      "Hi, this is Mike. I got your resume on Indeed and wanted to offer you some work in your area. Candidate said he can cover weekday afternoons and Saturdays around Plano, and he wants around one-twenty to one-fifty per completed call depending on parts complexity.",
    linkedCommunicationId: null,
    providerCallSid: null,
    lastContactLabel: "11:12 AM",
  },
  {
    candidateId: "cand-2",
    name: "Erik Mendoza",
    primaryPhone: "(469) 555-0188",
    email: null,
    source: "Referral",
    stage: "documents_pending",
    trade: "Refrigeration",
    city: "Dallas",
    serviceArea: "Dallas / Mesquite",
    availabilitySummary: "Can start next week after current contract closes out.",
    payoutExpectationSummary: "Wants a mixed flat-rate and mileage arrangement.",
    experienceSummary: "Strong refrigeration and sealed-system background.",
    nextStep: "Collect insurance docs and verify EPA card.",
    callHighlights:
      "Referral candidate has refrigeration experience and can start next week after sending insurance paperwork.",
    transcriptText:
      "We discussed his refrigeration background, Dallas coverage, and the paperwork he still needs to send before we can onboard him.",
    linkedCommunicationId: null,
    providerCallSid: null,
    lastContactLabel: "Yesterday",
  },
  {
    candidateId: "cand-3",
    name: "Tommy Reed",
    primaryPhone: "(972) 555-0130",
    email: null,
    source: "ZipRecruiter",
    stage: "interviewed",
    trade: "Cooking",
    city: "Irving",
    serviceArea: "Irving / Las Colinas",
    availabilitySummary: "Open most evenings and full days Friday through Sunday.",
    payoutExpectationSummary: "Comfortable with starter payout while ride-alongs ramp up.",
    experienceSummary: "Good on ovens and ranges; limited refrigeration experience.",
    nextStep: "Send ride-along invite.",
    callHighlights:
      "Cooking-appliance candidate is open on weekends and wants to start with ride-alongs before taking solo jobs.",
    transcriptText:
      "We covered evenings, weekend availability, and the plan to send him on a ride-along before solo dispatches.",
    linkedCommunicationId: null,
    providerCallSid: null,
    lastContactLabel: "Mon",
  },
];
