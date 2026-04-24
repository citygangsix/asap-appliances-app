import { extractZipCode } from "./technicianCoverage";

const EARTH_RADIUS_MILES = 3958.8;
const ROAD_DISTANCE_FACTOR = 1.22;
const DEFAULT_FUEL_PRICE_PER_GALLON = 3.5;

const CITY_COORDINATES = {
  arlington: { lat: 32.7357, lng: -97.1081, label: "Arlington, TX" },
  clearwater: { lat: 27.9659, lng: -82.8001, label: "Clearwater, FL" },
  dallas: { lat: 32.7767, lng: -96.797, label: "Dallas, TX" },
  frisco: { lat: 33.1507, lng: -96.8236, label: "Frisco, TX" },
  "fort lauderdale": { lat: 26.1224, lng: -80.1373, label: "Fort Lauderdale, FL" },
  hialeah: { lat: 25.8576, lng: -80.2781, label: "Hialeah, FL" },
  hollywood: { lat: 26.0112, lng: -80.1495, label: "Hollywood, FL" },
  holiday: { lat: 28.1878, lng: -82.7395, label: "Holiday, FL" },
  irving: { lat: 32.814, lng: -96.9489, label: "Irving, TX" },
  mckinney: { lat: 33.1972, lng: -96.6398, label: "McKinney, TX" },
  miami: { lat: 25.7617, lng: -80.1918, label: "Miami, FL" },
  ocala: { lat: 29.1872, lng: -82.1401, label: "Ocala, FL" },
  plano: { lat: 33.0198, lng: -96.6989, label: "Plano, TX" },
  pompano: { lat: 26.2379, lng: -80.1248, label: "Pompano Beach, FL" },
  "pompano beach": { lat: 26.2379, lng: -80.1248, label: "Pompano Beach, FL" },
  "st pete": { lat: 27.7676, lng: -82.6403, label: "St. Petersburg, FL" },
  "st petersburg": { lat: 27.7676, lng: -82.6403, label: "St. Petersburg, FL" },
  tampa: { lat: 27.9506, lng: -82.4572, label: "Tampa, FL" },
  "west palm": { lat: 26.7153, lng: -80.0534, label: "West Palm Beach, FL" },
  "west palm beach": { lat: 26.7153, lng: -80.0534, label: "West Palm Beach, FL" },
};

const AREA_COORDINATES = [
  { tokens: ["broward"], coordinate: CITY_COORDINATES["fort lauderdale"] },
  { tokens: ["hernando"], coordinate: { lat: 28.5553, lng: -82.3885, label: "Hernando County, FL" } },
  { tokens: ["hillsborough"], coordinate: CITY_COORDINATES.tampa },
  { tokens: ["marion"], coordinate: CITY_COORDINATES.ocala },
  { tokens: ["miami-dade"], coordinate: CITY_COORDINATES.miami },
  { tokens: ["miami dade"], coordinate: CITY_COORDINATES.miami },
  { tokens: ["pasco"], coordinate: { lat: 28.3232, lng: -82.4319, label: "Pasco County, FL" } },
  { tokens: ["pinellas"], coordinate: CITY_COORDINATES["st petersburg"] },
];

const ZIP_PREFIX_COORDINATES = [
  { prefix: "321", coordinate: CITY_COORDINATES.ocala },
  { prefix: "326", coordinate: CITY_COORDINATES.ocala },
  { prefix: "327", coordinate: CITY_COORDINATES.ocala },
  { prefix: "330", coordinate: CITY_COORDINATES.hialeah },
  { prefix: "331", coordinate: CITY_COORDINATES.miami },
  { prefix: "333", coordinate: CITY_COORDINATES["fort lauderdale"] },
  { prefix: "334", coordinate: CITY_COORDINATES["west palm beach"] },
  { prefix: "335", coordinate: CITY_COORDINATES.tampa },
  { prefix: "336", coordinate: CITY_COORDINATES.tampa },
  { prefix: "337", coordinate: CITY_COORDINATES["st petersburg"] },
  { prefix: "344", coordinate: CITY_COORDINATES.ocala },
  { prefix: "346", coordinate: CITY_COORDINATES.holiday },
  { prefix: "750", coordinate: CITY_COORDINATES.plano },
  { prefix: "751", coordinate: CITY_COORDINATES.mckinney },
  { prefix: "752", coordinate: CITY_COORDINATES.dallas },
  { prefix: "760", coordinate: CITY_COORDINATES.arlington },
];

function buildLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readCoordinateFromRecord(record) {
  const candidates = [
    [record?.latitude, record?.longitude],
    [record?.lat, record?.lng],
    [record?.location?.latitude, record?.location?.longitude],
    [record?.location?.lat, record?.location?.lng],
    [record?.geo?.latitude, record?.geo?.longitude],
    [record?.serviceLatitude, record?.serviceLongitude],
  ];

  const match = candidates.find(([lat, lng]) => Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)));

  return match ? { lat: Number(match[0]), lng: Number(match[1]), label: "Saved coordinates" } : null;
}

function findCoordinateByZip(zipCode) {
  if (!zipCode) {
    return null;
  }

  const prefixMatch = ZIP_PREFIX_COORDINATES.find(({ prefix }) => zipCode.startsWith(prefix));

  return prefixMatch
    ? {
        ...prefixMatch.coordinate,
        confidence: "zip-prefix",
      }
    : null;
}

function findCoordinateByText(...values) {
  const text = normalizeSearchText(values.filter(Boolean).join(" "));

  if (!text) {
    return null;
  }

  const cityMatch = Object.entries(CITY_COORDINATES).find(([city]) =>
    text.includes(city),
  );

  if (cityMatch) {
    return {
      ...cityMatch[1],
      confidence: "city",
    };
  }

  const areaMatch = AREA_COORDINATES.find(({ tokens }) =>
    tokens.some((token) => text.includes(token)),
  );

  return areaMatch
    ? {
        ...areaMatch.coordinate,
        confidence: "service-area",
      }
    : null;
}

function offsetCoordinate(coordinate, index, radius = 0.016) {
  if (!coordinate) {
    return null;
  }

  const angle = ((index + 1) * 137.5 * Math.PI) / 180;
  const scale = radius * (1 + (index % 4) * 0.28);

  return {
    ...coordinate,
    lat: coordinate.lat + Math.sin(angle) * scale,
    lng: coordinate.lng + Math.cos(angle) * scale,
  };
}

function getRouteDateKey(job) {
  return job?.scheduledStartAt ? String(job.scheduledStartAt).slice(0, 10) : null;
}

function isJobOnRouteDate(job, routeDateKey) {
  if (!routeDateKey) {
    return true;
  }

  const jobDateKey = getRouteDateKey(job);
  return !jobDateKey || jobDateKey === routeDateKey;
}

function formatMapsCoordinate(coordinate) {
  return `${coordinate.lat.toFixed(6)},${coordinate.lng.toFixed(6)}`;
}

function formatMapsStop(stop) {
  return stop.address || formatMapsCoordinate(stop.coordinate);
}

function sanitizePhoneNumber(phoneNumber) {
  const normalized = String(phoneNumber || "").replace(/[^\d+]/g, "");
  return normalized || null;
}

function buildPermutations(items, limit = 8) {
  if (items.length > limit) {
    return [];
  }

  const results = [];
  const used = new Array(items.length).fill(false);
  const path = [];

  function visit() {
    if (path.length === items.length) {
      results.push([...path]);
      return;
    }

    items.forEach((item, index) => {
      if (used[index]) {
        return;
      }

      used[index] = true;
      path.push(item);
      visit();
      path.pop();
      used[index] = false;
    });
  }

  visit();
  return results;
}

function optimizeByNearestNeighbor(startCoordinate, stops) {
  const remaining = [...stops];
  const ordered = [];
  let cursor = startCoordinate;

  while (remaining.length) {
    let bestIndex = 0;
    let bestMiles = Number.POSITIVE_INFINITY;

    remaining.forEach((stop, index) => {
      const miles = estimateRoadMiles(cursor, stop.coordinate);

      if (miles < bestMiles) {
        bestMiles = miles;
        bestIndex = index;
      }
    });

    const [nextStop] = remaining.splice(bestIndex, 1);
    ordered.push(nextStop);
    cursor = nextStop.coordinate;
  }

  return ordered;
}

function calculateStopSequenceMiles(startCoordinate, stops, includeReturnToBase = true) {
  if (!startCoordinate || stops.length === 0) {
    return 0;
  }

  const routePoints = [startCoordinate, ...stops.map((stop) => stop.coordinate)];
  const outboundMiles = routePoints.reduce((total, point, index) => {
    if (index === 0) {
      return total;
    }

    return total + estimateRoadMiles(routePoints[index - 1], point);
  }, 0);
  const returnMiles = includeReturnToBase
    ? estimateRoadMiles(routePoints[routePoints.length - 1], startCoordinate)
    : 0;

  return outboundMiles + returnMiles;
}

function optimizeStops(startCoordinate, stops, includeReturnToBase = true) {
  if (!startCoordinate || stops.length <= 1) {
    return stops;
  }

  if (stops.length <= 8) {
    return buildPermutations(stops).reduce(
      (best, candidate) => {
        const miles = calculateStopSequenceMiles(startCoordinate, candidate, includeReturnToBase);

        return miles < best.miles ? { miles, stops: candidate } : best;
      },
      { miles: Number.POSITIVE_INFINITY, stops },
    ).stops;
  }

  return optimizeByNearestNeighbor(startCoordinate, stops);
}

function buildRouteLegs(startCoordinate, stops, includeReturnToBase = true) {
  if (!startCoordinate || stops.length === 0) {
    return [];
  }

  const routePoints = [
    { label: "Technician start", coordinate: startCoordinate },
    ...stops,
    ...(includeReturnToBase ? [{ label: "Return to base", coordinate: startCoordinate }] : []),
  ];

  return routePoints.slice(1).map((stop, index) => ({
    from: routePoints[index],
    to: stop,
    miles: estimateRoadMiles(routePoints[index].coordinate, stop.coordinate),
  }));
}

function buildMapsLinks(startCoordinate, stops) {
  if (!startCoordinate || stops.length === 0) {
    return {
      googleMapsUrl: null,
      appleMapsUrl: null,
    };
  }

  const origin = formatMapsCoordinate(startCoordinate);
  const destination = formatMapsStop(stops[stops.length - 1]);
  const waypoints = stops.slice(0, -1).map(formatMapsStop);
  const googleParams = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });

  if (waypoints.length) {
    googleParams.set("waypoints", waypoints.join("|"));
  }

  const appleParams = new URLSearchParams({
    saddr: origin,
    daddr: destination,
    dirflg: "d",
  });

  return {
    googleMapsUrl: `https://www.google.com/maps/dir/?${googleParams.toString()}`,
    appleMapsUrl: `https://maps.apple.com/?${appleParams.toString()}`,
  };
}

function buildRouteShareMessage(plan) {
  if (!plan || plan.stops.length === 0) {
    return "";
  }

  const stopLines = plan.stops.map((stop, index) => {
    const time = stop.scheduledStartLabel ? `${stop.scheduledStartLabel} - ` : "";
    return `${index + 1}. ${time}${stop.customerName || "Customer"}: ${stop.address}`;
  });

  return [
    `ASAP route for ${plan.technicianName} (${plan.routeDateKey || "scheduled jobs"})`,
    ...stopLines,
    `Estimated miles: ${formatMiles(plan.totalMiles)}`,
    plan.mapsLinks.googleMapsUrl ? `Google route: ${plan.mapsLinks.googleMapsUrl}` : null,
    plan.mapsLinks.appleMapsUrl ? `Apple route: ${plan.mapsLinks.appleMapsUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function getTomorrowDateKey() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return buildLocalDateKey(date);
}

export function getAvailableRouteDates(jobs = []) {
  return Array.from(
    new Set(jobs.map(getRouteDateKey).filter(Boolean)),
  ).sort();
}

export function resolveJobCoordinate(job, index = 0) {
  const savedCoordinate = readCoordinateFromRecord(job);

  if (savedCoordinate) {
    return {
      ...savedCoordinate,
      confidence: "saved",
    };
  }

  const zipCoordinate = findCoordinateByZip(extractZipCode(job?.serviceAddress));
  const textCoordinate =
    zipCoordinate ||
    findCoordinateByText(job?.serviceAddress, job?.customer?.city, job?.customer?.serviceArea);

  return textCoordinate ? offsetCoordinate(textCoordinate, index) : null;
}

export function resolveTechnicianCoordinate(technician, index = 0) {
  const savedCoordinate = readCoordinateFromRecord(technician);

  if (savedCoordinate) {
    return {
      ...savedCoordinate,
      confidence: "saved",
    };
  }

  const coverageZip = technician?.serviceZipCodes?.[0] || "";
  const zipCoordinate = findCoordinateByZip(coverageZip);
  const textCoordinate =
    findCoordinateByText(technician?.serviceArea, technician?.name, technician?.availabilityLabel) ||
    zipCoordinate;

  return textCoordinate ? offsetCoordinate(textCoordinate, index, 0.02) : null;
}

export function estimateRoadMiles(leftCoordinate, rightCoordinate) {
  if (!leftCoordinate || !rightCoordinate) {
    return 0;
  }

  const toRadians = (value) => (value * Math.PI) / 180;
  const latDelta = toRadians(rightCoordinate.lat - leftCoordinate.lat);
  const lngDelta = toRadians(rightCoordinate.lng - leftCoordinate.lng);
  const leftLat = toRadians(leftCoordinate.lat);
  const rightLat = toRadians(rightCoordinate.lat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lngDelta / 2) ** 2;
  const directMiles = 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(haversine));

  return directMiles * ROAD_DISTANCE_FACTOR;
}

export function buildDispatchMapPoints({ jobs = [], technicians = [] }) {
  const technicianPoints = technicians
    .map((technician, index) => {
      const coordinate = resolveTechnicianCoordinate(technician, index);

      return coordinate
        ? {
            id: technician.techId,
            type: "technician",
            label: technician.name,
            subLabel: technician.serviceArea,
            coordinate,
            status: technician.statusToday,
            technician,
          }
        : null;
    })
    .filter(Boolean);

  const jobPoints = jobs
    .map((job, index) => {
      const coordinate = resolveJobCoordinate(job, index);
      const isLead = !job.techId || job.dispatchStatus === "unassigned";

      return coordinate
        ? {
            id: job.jobId,
            type: isLead ? "lead" : "job",
            label: job.customer?.name || job.jobId,
            subLabel: job.serviceAddress,
            coordinate,
            status: job.dispatchStatus,
            job,
          }
        : null;
    })
    .filter(Boolean);

  return [...technicianPoints, ...jobPoints];
}

export function buildDispatchRoutePlans({
  jobs = [],
  technicians = [],
  routeDateKey,
  includeReturnToBase = true,
}) {
  return technicians.map((technician, technicianIndex) => {
    const startCoordinate = resolveTechnicianCoordinate(technician, technicianIndex);
    const assignedStops = jobs
      .filter((job) => job.techId === technician.techId)
      .filter((job) => !["completed", "canceled"].includes(job.lifecycleStatus))
      .filter((job) => isJobOnRouteDate(job, routeDateKey))
      .map((job, jobIndex) => {
        const coordinate = resolveJobCoordinate(job, jobIndex);

        return coordinate
          ? {
              id: job.jobId,
              job,
              coordinate,
              label: job.jobId,
              customerName: job.customer?.name || "Customer",
              address: job.serviceAddress,
              scheduledStartLabel: job.scheduledStartLabel,
              priority: job.priority,
              dispatchStatus: job.dispatchStatus,
            }
          : null;
      })
      .filter(Boolean);

    const stops = optimizeStops(startCoordinate, assignedStops, includeReturnToBase);
    const legs = buildRouteLegs(startCoordinate, stops, includeReturnToBase);
    const totalMiles = legs.reduce((total, leg) => total + leg.miles, 0);
    const mapsLinks = buildMapsLinks(startCoordinate, stops);
    const plan = {
      techId: technician.techId,
      technician,
      technicianName: technician.name,
      startCoordinate,
      routeDateKey,
      stops,
      stopCount: stops.length,
      legs,
      totalMiles,
      mapsLinks,
      includeReturnToBase,
    };

    return {
      ...plan,
      shareMessage: buildRouteShareMessage(plan),
      smsUrl: buildSmsRouteUrl(technician.primaryPhone, buildRouteShareMessage(plan)),
    };
  });
}

export function buildLeadRecommendations({
  jobs = [],
  routePlans = [],
  routeDateKey,
  includeReturnToBase = true,
}) {
  return jobs
    .filter((job) => !job.techId || job.dispatchStatus === "unassigned")
    .filter((job) => !["completed", "canceled"].includes(job.lifecycleStatus))
    .filter((job) => isJobOnRouteDate(job, routeDateKey))
    .map((job, jobIndex) => {
      const coordinate = resolveJobCoordinate(job, jobIndex);

      if (!coordinate) {
        return null;
      }

      const stop = {
        id: job.jobId,
        job,
        coordinate,
        label: job.jobId,
        customerName: job.customer?.name || "Customer",
        address: job.serviceAddress,
        scheduledStartLabel: job.scheduledStartLabel,
        priority: job.priority,
        dispatchStatus: job.dispatchStatus,
      };

      const rankedRoutes = routePlans
        .filter((plan) => plan.startCoordinate)
        .map((plan) => {
          const currentMiles = calculateStopSequenceMiles(
            plan.startCoordinate,
            plan.stops,
            includeReturnToBase,
          );
          const insertionOptions = Array.from({ length: plan.stops.length + 1 }, (_, insertionIndex) => {
            const stops = [
              ...plan.stops.slice(0, insertionIndex),
              stop,
              ...plan.stops.slice(insertionIndex),
            ];
            const miles = calculateStopSequenceMiles(plan.startCoordinate, stops, includeReturnToBase);

            return {
              insertionIndex,
              miles,
              addedMiles: miles - currentMiles,
            };
          });
          const bestInsertion = insertionOptions.reduce(
            (best, option) => (option.addedMiles < best.addedMiles ? option : best),
            insertionOptions[0],
          );

          return {
            techId: plan.techId,
            technicianName: plan.technicianName,
            addedMiles: bestInsertion.addedMiles,
            routeMiles: bestInsertion.miles,
            insertionIndex: bestInsertion.insertionIndex,
            currentStopCount: plan.stopCount,
          };
        })
        .sort((left, right) => left.addedMiles - right.addedMiles);

      return {
        job,
        coordinate,
        bestRoute: rankedRoutes[0] || null,
        rankedRoutes,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const priorityRank = { escalated: 0, high: 1, normal: 2 };
      return (
        (priorityRank[left.job.priority] ?? 2) - (priorityRank[right.job.priority] ?? 2) ||
        (left.bestRoute?.addedMiles ?? 9999) - (right.bestRoute?.addedMiles ?? 9999)
      );
    });
}

export function buildDefaultVehicleProfile(technician) {
  return {
    vehicleLabel: technician?.vehicleLabel || "Service vehicle",
    milesPerGallon: technician?.milesPerGallon || 22,
    tankGallons: technician?.tankGallons || 16,
    fuelPricePerGallon: DEFAULT_FUEL_PRICE_PER_GALLON,
  };
}

export function calculateFuelReimbursement(routeMiles, profile) {
  const miles = Number(routeMiles) || 0;
  const milesPerGallon = Math.max(Number(profile?.milesPerGallon) || 1, 1);
  const tankGallons = Math.max(Number(profile?.tankGallons) || 1, 1);
  const fuelPricePerGallon = Math.max(Number(profile?.fuelPricePerGallon) || 0, 0);
  const gallonsUsed = miles / milesPerGallon;
  const costPerMile = fuelPricePerGallon / milesPerGallon;

  return {
    miles,
    gallonsUsed,
    costPerMile,
    reimbursementAmount: miles * costPerMile,
    tankPercentUsed: (gallonsUsed / tankGallons) * 100,
    estimatedTankRangeMiles: milesPerGallon * tankGallons,
  };
}

export function buildSmsRouteUrl(phoneNumber, message) {
  const phone = sanitizePhoneNumber(phoneNumber);

  if (!phone || !message) {
    return null;
  }

  return `sms:${phone}?&body=${encodeURIComponent(message)}`;
}

export function formatMiles(value) {
  return `${(Number(value) || 0).toFixed(1)} mi`;
}

export function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}
