import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Card, SecondaryButton } from "../ui";
import { formatStatusLabel, getStatusTone } from "../../lib/domain/jobs";
import {
  buildDefaultVehicleProfile,
  calculateFuelReimbursement,
  formatMiles,
  formatMoney,
} from "../../lib/domain/dispatchRouting";

const TILE_SIZE = 256;
const MIN_ZOOM = 4;
const MAX_ZOOM = 14;
const WHEEL_ZOOM_THRESHOLD = 180;
const ROUTE_COLORS = ["#4f46e5", "#0f766e", "#dc2626", "#b45309", "#2563eb", "#7c3aed"];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function wrapTileX(tileX, zoom) {
  const maxTile = 2 ** zoom;
  return ((tileX % maxTile) + maxTile) % maxTile;
}

function projectCoordinate(coordinate, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const sinLat = Math.sin((clamp(coordinate.lat, -85.0511, 85.0511) * Math.PI) / 180);

  return {
    x: ((coordinate.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function unprojectCoordinate(point, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (point.x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * point.y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

  return { lat, lng };
}

function getInitialMapView(points) {
  if (!points.length) {
    return { center: { lat: 28.6, lng: -82.2 }, zoom: 7 };
  }

  const bounds = points.reduce(
    (current, point) => ({
      minLat: Math.min(current.minLat, point.coordinate.lat),
      maxLat: Math.max(current.maxLat, point.coordinate.lat),
      minLng: Math.min(current.minLng, point.coordinate.lng),
      maxLng: Math.max(current.maxLng, point.coordinate.lng),
    }),
    {
      minLat: points[0].coordinate.lat,
      maxLat: points[0].coordinate.lat,
      minLng: points[0].coordinate.lng,
      maxLng: points[0].coordinate.lng,
    },
  );
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.01);
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.01);
  const largestSpan = Math.max(latSpan, lngSpan);

  let zoom = 10;
  if (largestSpan > 18) {
    zoom = 5;
  } else if (largestSpan > 8) {
    zoom = 6;
  } else if (largestSpan > 3) {
    zoom = 7;
  } else if (largestSpan > 1.2) {
    zoom = 8;
  } else if (largestSpan < 0.25) {
    zoom = 12;
  }

  return {
    center: {
      lat: (bounds.minLat + bounds.maxLat) / 2,
      lng: (bounds.minLng + bounds.maxLng) / 2,
    },
    zoom,
  };
}

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 960, height: 560 });

  useEffect(() => {
    if (!ref.current) {
      return undefined;
    }

    const updateSize = () => {
      const rect = ref.current.getBoundingClientRect();
      setSize({
        width: Math.max(rect.width, 320),
        height: Math.max(rect.height, 320),
      });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function getPointScreenPosition(coordinate, mapView, size) {
  const centerPoint = projectCoordinate(mapView.center, mapView.zoom);
  const point = projectCoordinate(coordinate, mapView.zoom);

  return {
    x: point.x - centerPoint.x + size.width / 2,
    y: point.y - centerPoint.y + size.height / 2,
  };
}

function buildTileGrid(mapView, size) {
  const centerPoint = projectCoordinate(mapView.center, mapView.zoom);
  const startTileX = Math.floor((centerPoint.x - size.width / 2) / TILE_SIZE) - 1;
  const endTileX = Math.floor((centerPoint.x + size.width / 2) / TILE_SIZE) + 1;
  const startTileY = Math.floor((centerPoint.y - size.height / 2) / TILE_SIZE) - 1;
  const endTileY = Math.floor((centerPoint.y + size.height / 2) / TILE_SIZE) + 1;
  const maxTile = 2 ** mapView.zoom;
  const tiles = [];

  for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
    for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
      if (tileY < 0 || tileY >= maxTile) {
        continue;
      }

      tiles.push({
        id: `${mapView.zoom}-${tileX}-${tileY}`,
        x: tileX * TILE_SIZE - centerPoint.x + size.width / 2,
        y: tileY * TILE_SIZE - centerPoint.y + size.height / 2,
        url: `https://tile.openstreetmap.org/${mapView.zoom}/${wrapTileX(tileX, mapView.zoom)}/${tileY}.png`,
      });
    }
  }

  return tiles;
}

function isMapControlTarget(target) {
  return target instanceof Element && Boolean(target.closest("[data-map-control]"));
}

function formatOptionLabel(value) {
  return formatStatusLabel(String(value || "all").replace(/^status:|^priority:/, ""));
}

function pointMatchesStatusPriority(point, filterValue) {
  if (!filterValue || filterValue === "all") {
    return true;
  }

  if (filterValue.startsWith("status:")) {
    return point.status === filterValue.replace("status:", "");
  }

  if (filterValue.startsWith("priority:")) {
    return point.job?.priority === filterValue.replace("priority:", "");
  }

  return true;
}

function Marker({ point, mapView, size, selected, onSelect }) {
  const position = getPointScreenPosition(point.coordinate, mapView, size);
  const isTechnician = point.type === "technician";
  const isLead = point.type === "lead";
  const markerClass = isTechnician
    ? "border-slate-900 bg-white text-slate-950"
    : isLead
      ? "border-rose-500 bg-rose-500 text-white"
      : "border-indigo-500 bg-indigo-500 text-white";

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`dispatch-marker-${point.type}-${point.id}`}
      className={`absolute z-20 -translate-x-1/2 -translate-y-full rounded-full border-2 px-2.5 py-1 text-xs font-semibold shadow-lg transition hover:scale-[1.03] ${
        selected ? "ring-4 ring-amber-300" : ""
      } ${markerClass}`}
      style={{ left: position.x, top: position.y }}
      title={`${point.label} - ${point.subLabel || formatStatusLabel(point.status || "scheduled")}`}
    >
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span
          className={`h-2 w-2 rounded-full ${
            isTechnician ? "bg-emerald-500" : isLead ? "bg-white" : "bg-indigo-100"
          }`}
        />
        <span className="max-w-[132px] overflow-hidden text-ellipsis">{point.label}</span>
      </span>
    </button>
  );
}

function RouteLines({ routePlans, activeRouteTechId, mapView, size }) {
  const polylines = routePlans
    .filter((plan) => plan.startCoordinate && plan.stops.length)
    .map((plan, index) => {
      const coordinates = [plan.startCoordinate, ...plan.stops.map((stop) => stop.coordinate)];
      const points = coordinates.map((coordinate) => {
        const position = getPointScreenPosition(coordinate, mapView, size);
        return `${position.x},${position.y}`;
      });
      const isActive = !activeRouteTechId || activeRouteTechId === plan.techId;

      return {
        id: plan.techId,
        points: points.join(" "),
        color: ROUTE_COLORS[index % ROUTE_COLORS.length],
        isActive,
      };
    });

  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
      {polylines.map((line) => (
        <polyline
          key={line.id}
          fill="none"
          points={line.points}
          stroke={line.color}
          strokeDasharray={line.isActive ? "0" : "8 8"}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={line.isActive ? 0.72 : 0.26}
          strokeWidth={line.isActive ? 4 : 3}
        />
      ))}
    </svg>
  );
}

function DetailRow({ label, value }) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function MarkerDetailCard({
  selectedPoint,
  routePlans,
  leadRecommendations,
  selectedTechId,
  onSelectRouteTechnician,
  onStageLead,
}) {
  if (!selectedPoint) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4" data-testid="marker-detail-card">
        <p className="text-sm font-semibold text-slate-800">Select a marker</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Click a worker, scheduled job, or incoming lead to inspect details and dispatch actions.
        </p>
      </div>
    );
  }

  if (selectedPoint.type === "technician") {
    const technician = selectedPoint.technician;
    const routePlan = routePlans.find((plan) => plan.techId === technician.techId);
    const vehicleProfile = buildDefaultVehicleProfile(technician);
    const fuelMath = calculateFuelReimbursement(routePlan?.totalMiles || 0, vehicleProfile);

    return (
      <div className="rounded-2xl border border-[#dce2ec] bg-white p-4 shadow-sm" data-testid="marker-detail-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">{technician.name}</p>
            <p className="mt-1 text-xs text-slate-500">{technician.serviceArea}</p>
          </div>
          <Badge tone={getStatusTone(technician.statusToday)}>{formatStatusLabel(technician.statusToday)}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <DetailRow label="Vehicle" value={vehicleProfile.vehicleLabel} />
          <DetailRow label="MPG" value={`${vehicleProfile.milesPerGallon} mpg`} />
          <DetailRow label="Tank" value={`${vehicleProfile.tankGallons} gal`} />
          <DetailRow label="Route miles" value={formatMiles(routePlan?.totalMiles || 0)} />
          <DetailRow label="Stops" value={`${routePlan?.stopCount || 0}`} />
          <DetailRow label="Gas est." value={formatMoney(fuelMath.reimbursementAmount)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {routePlan?.mapsLinks.googleMapsUrl ? (
            <a
              className="rounded-xl bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-600"
              href={routePlan.mapsLinks.googleMapsUrl}
              rel="noreferrer"
              target="_blank"
            >
              Google route
            </a>
          ) : null}
          {routePlan?.mapsLinks.appleMapsUrl ? (
            <a
              className="rounded-xl border border-[#cfd6e2] px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              href={routePlan.mapsLinks.appleMapsUrl}
              rel="noreferrer"
              target="_blank"
            >
              Apple route
            </a>
          ) : null}
          {routePlan?.smsUrl ? (
            <a
              className="rounded-xl border border-[#cfd6e2] px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              href={routePlan.smsUrl}
            >
              Text route
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  const job = selectedPoint.job;
  const assignedRoute = job.techId ? routePlans.find((plan) => plan.techId === job.techId) : null;
  const recommendation = leadRecommendations.find((item) => item.job.jobId === job.jobId);
  const recommendedRoute = recommendation?.bestRoute;
  const activeRoute = selectedTechId ? routePlans.find((plan) => plan.techId === selectedTechId) : null;

  return (
    <div className="rounded-2xl border border-[#dce2ec] bg-white p-4 shadow-sm" data-testid="marker-detail-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{job.customer?.name || selectedPoint.label}</p>
          <p className="mt-1 text-xs text-slate-500">{job.serviceAddress}</p>
        </div>
        <Badge tone={selectedPoint.type === "lead" ? "rose" : getStatusTone(job.dispatchStatus)}>
          {selectedPoint.type === "lead" ? "Lead" : formatStatusLabel(job.dispatchStatus)}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <DetailRow label="Job type" value={job.applianceLabel || job.applianceBrand || "Service call"} />
        <DetailRow label="Priority" value={formatStatusLabel(job.priority)} />
        <DetailRow label="Window" value={job.scheduledStartLabel || job.etaLabel || "Not set"} />
        <DetailRow label="Assigned" value={assignedRoute?.technicianName || "Unassigned"} />
      </div>
      {job.issueSummary ? <p className="mt-4 text-sm leading-6 text-slate-600">{job.issueSummary}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {recommendedRoute ? (
          <SecondaryButton
            className="rounded-xl px-3 py-2 text-xs"
            onClick={() => onStageLead(job.jobId, recommendedRoute.techId)}
          >
            Stage {recommendedRoute.technicianName}
          </SecondaryButton>
        ) : null}
        {!recommendedRoute && activeRoute && !job.techId ? (
          <SecondaryButton
            className="rounded-xl px-3 py-2 text-xs"
            onClick={() => onStageLead(job.jobId, activeRoute.techId)}
          >
            Stage active tech
          </SecondaryButton>
        ) : null}
        {assignedRoute ? (
          <SecondaryButton
            className="rounded-xl px-3 py-2 text-xs"
            onClick={() => onSelectRouteTechnician(assignedRoute.techId)}
          >
            Focus route
          </SecondaryButton>
        ) : null}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   jobs: any[],
 *   technicians: any[],
 *   mapPoints: any[],
 *   routePlans: any[],
 *   leadRecommendations: any[],
 *   selectedJobId: string|null,
 *   selectedTechId: string,
 *   activeRouteTechId: string,
 *   onSelectJob: (jobId: string) => void,
 *   onSelectTechnician: (techId: string) => void,
 *   onSelectRouteTechnician: (techId: string) => void,
 *   onStageLead: (jobId: string, techId: string) => void,
 * }} props
 */
export function DispatchMapWorkspace({
  jobs,
  technicians,
  mapPoints,
  routePlans,
  leadRecommendations,
  selectedJobId,
  selectedTechId,
  activeRouteTechId,
  onSelectJob,
  onSelectTechnician,
  onSelectRouteTechnician,
  onStageLead,
}) {
  const mapRef = useRef(null);
  const dragRef = useRef(null);
  const wheelDeltaRef = useRef(0);
  const wheelResetTimeoutRef = useRef(null);
  const size = useElementSize(mapRef);
  const [showWorkers, setShowWorkers] = useState(true);
  const [showJobs, setShowJobs] = useState(true);
  const [showLeads, setShowLeads] = useState(true);
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [statusPriorityFilter, setStatusPriorityFilter] = useState("all");
  const [selectedMarkerKey, setSelectedMarkerKey] = useState("");
  const [mapInteractionEnabled, setMapInteractionEnabled] = useState(false);
  const visibleMapPoints = useMemo(
    () =>
      mapPoints.filter((point) => {
        if (!pointMatchesStatusPriority(point, statusPriorityFilter)) {
          return false;
        }

        if (point.type === "technician") {
          return showWorkers && (technicianFilter === "all" || point.technician.techId === technicianFilter);
        }

        if (point.type === "job") {
          return showJobs && (technicianFilter === "all" || point.job.techId === technicianFilter);
        }

        if (point.type === "lead") {
          return showLeads;
        }

        return true;
      }),
    [mapPoints, showJobs, showLeads, showWorkers, statusPriorityFilter, technicianFilter],
  );
  const visibleRoutePlans = useMemo(
    () =>
      routePlans.filter((plan) => {
        if (technicianFilter !== "all" && plan.techId !== technicianFilter) {
          return false;
        }

        if (statusPriorityFilter.startsWith("status:")) {
          return plan.technician.statusToday === statusPriorityFilter.replace("status:", "");
        }

        return showJobs || showWorkers;
      }),
    [routePlans, showJobs, showWorkers, statusPriorityFilter, technicianFilter],
  );
  const mapKey = useMemo(
    () => visibleMapPoints.map((point) => `${point.id}:${point.coordinate.lat}:${point.coordinate.lng}`).join("|"),
    [visibleMapPoints],
  );
  const [mapView, setMapView] = useState(() => getInitialMapView(mapPoints));
  const activeRoutePlan =
    routePlans.find((plan) => plan.techId === activeRouteTechId) ||
    routePlans.find((plan) => plan.stopCount > 0) ||
    routePlans[0] ||
    null;
  const visibleTiles = useMemo(() => buildTileGrid(mapView, size), [mapView, size]);
  const selectedPoint =
    mapPoints.find((point) => `${point.type}:${point.id}` === selectedMarkerKey) ||
    mapPoints.find((point) => point.type !== "technician" && point.id === selectedJobId) ||
    mapPoints.find((point) => point.type === "technician" && point.id === selectedTechId) ||
    null;
  const statusPriorityOptions = useMemo(() => {
    const statusValues = new Set();
    const priorityValues = new Set();

    mapPoints.forEach((point) => {
      if (point.status) {
        statusValues.add(point.status);
      }

      if (point.job?.priority) {
        priorityValues.add(point.job.priority);
      }
    });

    return [
      { value: "all", label: "All status / priority" },
      ...Array.from(statusValues).map((status) => ({
        value: `status:${status}`,
        label: `Status: ${formatOptionLabel(status)}`,
      })),
      ...Array.from(priorityValues).map((priority) => ({
        value: `priority:${priority}`,
        label: `Priority: ${formatOptionLabel(priority)}`,
      })),
    ];
  }, [mapPoints]);
  const locatedWorkers = mapPoints.filter((point) => point.type === "technician").length;
  const visibleWorkers = visibleMapPoints.filter((point) => point.type === "technician").length;
  const visibleJobs = visibleMapPoints.filter((point) => point.type === "job").length;
  const visibleLeads = visibleMapPoints.filter((point) => point.type === "lead").length;
  const incomingLeads = jobs.filter((job) => !job.techId || job.dispatchStatus === "unassigned").length;
  const totalPlannedMiles = routePlans.reduce((total, plan) => total + plan.totalMiles, 0);

  useEffect(() => {
    setMapView(getInitialMapView(visibleMapPoints.length ? visibleMapPoints : mapPoints));
  }, [mapKey, mapPoints, visibleMapPoints]);

  useEffect(() => {
    function handleDocumentPointerDown(event) {
      if (!mapRef.current?.contains(event.target)) {
        setMapInteractionEnabled(false);
        dragRef.current = null;
      }
    }

    function handleDocumentKeyDown(event) {
      if (event.key === "Escape") {
        setMapInteractionEnabled(false);
        dragRef.current = null;
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
      if (wheelResetTimeoutRef.current) {
        window.clearTimeout(wheelResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const node = mapRef.current;

    if (!node) {
      return undefined;
    }

    node.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      node.removeEventListener("wheel", handleWheel);
    };
  }, [mapInteractionEnabled]);

  function fitMapToPins() {
    setMapView(getInitialMapView(visibleMapPoints.length ? visibleMapPoints : mapPoints));
  }

  function zoomMap(delta) {
    setMapView((current) => ({
      ...current,
      zoom: clamp(current.zoom + delta, MIN_ZOOM, MAX_ZOOM),
    }));
  }

  function handleWheel(event) {
    const shouldZoom = mapInteractionEnabled || event.metaKey || event.ctrlKey;

    if (!shouldZoom) {
      return;
    }

    event.preventDefault();
    wheelDeltaRef.current += event.deltaY;

    if (Math.abs(wheelDeltaRef.current) >= WHEEL_ZOOM_THRESHOLD) {
      zoomMap(wheelDeltaRef.current > 0 ? -1 : 1);
      wheelDeltaRef.current = 0;
    }

    if (wheelResetTimeoutRef.current) {
      window.clearTimeout(wheelResetTimeoutRef.current);
    }

    wheelResetTimeoutRef.current = window.setTimeout(() => {
      wheelDeltaRef.current = 0;
    }, 220);
  }

  function handlePointerDown(event) {
    if (isMapControlTarget(event.target)) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    mapRef.current?.focus();

    if (!mapInteractionEnabled) {
      if (event.pointerType !== "mouse") {
        return;
      }

      setMapInteractionEnabled(true);
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      centerPoint: projectCoordinate(mapView.center, mapView.zoom),
    };
  }

  function handlePointerMove(event) {
    if (!mapInteractionEnabled) {
      return;
    }

    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;
    setMapView((current) => ({
      ...current,
      center: unprojectCoordinate(
        {
          x: dragRef.current.centerPoint.x - deltaX,
          y: dragRef.current.centerPoint.y - deltaY,
        },
        current.zoom,
      ),
    }));
  }

  function handlePointerUp(event) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[#e7ebf2] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-title">Dispatch map</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Map command workspace</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Pan, scroll, inspect workers and jobs, then stage the best-fit dispatch route from the same screen.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Workers</p>
              <p className="text-lg font-semibold text-slate-950">{visibleWorkers}/{locatedWorkers || technicians.length}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Jobs</p>
              <p className="text-lg font-semibold text-slate-950">{visibleJobs}/{jobs.length - incomingLeads}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Leads</p>
              <p className="text-lg font-semibold text-rose-600">{visibleLeads}/{incomingLeads}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Miles</p>
              <p className="text-lg font-semibold text-slate-950">{formatMiles(totalPlannedMiles)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-[#e7ebf2] bg-slate-50 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Map filters</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ["Workers", showWorkers, setShowWorkers],
                ["Scheduled jobs", showJobs, setShowJobs],
                ["Incoming leads", showLeads, setShowLeads],
              ].map(([label, enabled, setter]) => (
                <button
                  key={label}
                  type="button"
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    enabled
                      ? "border-indigo-200 bg-white text-indigo-700 shadow-sm"
                      : "border-slate-200 bg-transparent text-slate-500 hover:bg-white"
                  }`}
                  onClick={() => setter((current) => !current)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px]">
            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Technician
              <select
                className="rounded-xl border border-[#cfd6e2] bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none transition focus:border-indigo-500"
                value={technicianFilter}
                onChange={(event) => setTechnicianFilter(event.target.value)}
              >
                <option value="all">All technicians</option>
                {technicians.map((technician) => (
                  <option key={technician.techId} value={technician.techId}>
                    {technician.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Status / priority
              <select
                className="rounded-xl border border-[#cfd6e2] bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none transition focus:border-indigo-500"
                value={statusPriorityFilter}
                onChange={(event) => setStatusPriorityFilter(event.target.value)}
              >
                {statusPriorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <div
          ref={mapRef}
          className={`relative h-[560px] overflow-hidden bg-[#dbe7ee] outline-none ${
            mapInteractionEnabled ? "touch-none ring-2 ring-indigo-300" : "touch-pan-y"
          }`}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px)] bg-[size:64px_64px]" />
          {visibleTiles.map((tile) => (
            <img
              key={tile.id}
              alt=""
              className="absolute h-64 w-64 select-none"
              draggable="false"
              src={tile.url}
              style={{ left: tile.x, top: tile.y }}
            />
          ))}
          <RouteLines
            activeRouteTechId={activeRouteTechId}
            mapView={mapView}
            routePlans={visibleRoutePlans}
            size={size}
          />
          {visibleMapPoints.map((point) => (
            <Marker
              key={`${point.type}-${point.id}`}
              mapView={mapView}
              onSelect={() => {
                setSelectedMarkerKey(`${point.type}:${point.id}`);
                if (point.type === "technician") {
                  onSelectTechnician(point.technician.techId);
                  onSelectRouteTechnician(point.technician.techId);
                } else {
                  onSelectJob(point.job.jobId);
                }
              }}
              point={point}
              selected={`${point.type}:${point.id}` === selectedMarkerKey || point.id === selectedJobId || point.id === selectedTechId}
              size={size}
            />
          ))}
          {visibleMapPoints.length === 0 ? (
            <div className="absolute left-1/2 top-1/2 z-30 w-[min(320px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white/95 p-4 text-center shadow-lg">
              <p className="text-sm font-semibold text-slate-900">No markers match these filters</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Turn a layer back on or loosen the technician/status filters.</p>
            </div>
          ) : null}

          <div
            className="absolute left-4 top-4 z-30 flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            data-map-control
          >
            <button
              type="button"
              className="grid h-10 w-10 place-items-center text-lg font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => zoomMap(1)}
              title="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center border-l border-slate-200 text-lg font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => zoomMap(-1)}
              title="Zoom out"
            >
              -
            </button>
            <button
              type="button"
              className="border-l border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={fitMapToPins}
            >
              Fit
            </button>
          </div>

          <div className="absolute bottom-4 left-4 z-30 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow-lg">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Workers</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Jobs</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Leads</span>
          </div>

          <button
            type="button"
            className={`absolute right-4 top-4 z-30 max-w-[min(260px,calc(100%-130px))] rounded-xl border px-3 py-2 text-left text-xs font-semibold shadow-lg transition ${
              mapInteractionEnabled
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white/95 text-slate-600 hover:bg-slate-50"
            }`}
            data-map-control
            onClick={() => {
              setMapInteractionEnabled((enabled) => !enabled);
              mapRef.current?.focus();
            }}
          >
            {mapInteractionEnabled ? "Map zoom on - Esc to exit" : "Click map or hold Cmd/Ctrl + scroll to zoom"}
          </button>

          <a
            className="absolute bottom-4 right-4 z-30 rounded-lg bg-white/95 px-2 py-1 text-[11px] font-medium text-slate-500 shadow"
            data-map-control
            href="https://www.openstreetmap.org/copyright"
            rel="noreferrer"
            target="_blank"
          >
            OpenStreetMap
          </a>
        </div>

        <aside className="border-t border-[#e7ebf2] bg-white p-5 lg:border-l lg:border-t-0">
          <div>
            <p className="section-title">Marker details</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">Selected map item</h3>
          </div>

          <div className="mt-4">
            <MarkerDetailCard
              leadRecommendations={leadRecommendations}
              onSelectRouteTechnician={onSelectRouteTechnician}
              onStageLead={onStageLead}
              routePlans={routePlans}
              selectedPoint={selectedPoint}
              selectedTechId={selectedTechId || activeRouteTechId}
            />
          </div>

          <div className="mt-6 border-t border-[#e7ebf2] pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-title">Route focus</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">Active technician</h3>
            </div>
            {activeRoutePlan ? (
              <Badge tone={activeRoutePlan.stopCount > 1 ? "indigo" : "slate"}>
                {activeRoutePlan.stopCount} stops
              </Badge>
            ) : null}
          </div>

          <select
            value={activeRouteTechId || ""}
            onChange={(event) => onSelectRouteTechnician(event.target.value)}
            className="mt-4 w-full rounded-xl border border-[#cfd6e2] bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500"
          >
            {routePlans.map((plan) => (
              <option key={plan.techId} value={plan.techId}>
                {plan.technicianName} - {formatMiles(plan.totalMiles)}
              </option>
            ))}
          </select>

          {activeRoutePlan ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{activeRoutePlan.technicianName}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatMiles(activeRoutePlan.totalMiles)} planned driving
                  </p>
                </div>
                <Badge tone={getStatusTone(activeRoutePlan.technician.statusToday)}>
                  {formatStatusLabel(activeRoutePlan.technician.statusToday)}
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {activeRoutePlan.stops.length === 0 ? (
                  <p className="text-sm text-slate-500">No jobs are assigned to this worker for the selected route day.</p>
                ) : (
                  activeRoutePlan.stops.map((stop, index) => (
                    <button
                      key={stop.id}
                      type="button"
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300"
                      onClick={() => onSelectJob(stop.job.jobId)}
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {index + 1}. {stop.customerName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{stop.scheduledStartLabel} - {stop.address}</p>
                    </button>
                  ))
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {activeRoutePlan.mapsLinks.googleMapsUrl ? (
                  <a
                    className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
                    href={activeRoutePlan.mapsLinks.googleMapsUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Google route
                  </a>
                ) : null}
                {activeRoutePlan.mapsLinks.appleMapsUrl ? (
                  <a
                    className="rounded-xl border border-[#cfd6e2] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    href={activeRoutePlan.mapsLinks.appleMapsUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Apple route
                  </a>
                ) : null}
                {activeRoutePlan.smsUrl ? (
                  <a
                    className="rounded-xl border border-[#cfd6e2] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    href={activeRoutePlan.smsUrl}
                  >
                    Text route
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
          </div>

          <div className="mt-6 border-t border-[#e7ebf2] pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-title">Incoming leads</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-950">Best-fit dispatch</h3>
              </div>
              <Badge tone="rose">{leadRecommendations.length}</Badge>
            </div>

            <div className="mt-4 space-y-3">
              {leadRecommendations.length === 0 ? (
                <p className="text-sm text-slate-500">No unassigned map leads match the selected route day.</p>
              ) : (
                leadRecommendations.slice(0, 4).map((recommendation) => (
                  <div key={recommendation.job.jobId} className="rounded-xl border border-[#dce2ec] bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {recommendation.job.customer?.name || recommendation.job.jobId}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{recommendation.job.serviceAddress}</p>
                    {recommendation.bestRoute ? (
                      <p className="mt-2 text-sm text-indigo-700">
                        {recommendation.bestRoute.technicianName} adds {formatMiles(recommendation.bestRoute.addedMiles)}
                      </p>
                    ) : null}
                    {recommendation.bestRoute ? (
                      <SecondaryButton
                        className="mt-3 w-full justify-center rounded-xl py-2"
                        onClick={() => onStageLead(recommendation.job.jobId, recommendation.bestRoute.techId)}
                      >
                        Stage assignment
                      </SecondaryButton>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </Card>
  );
}
