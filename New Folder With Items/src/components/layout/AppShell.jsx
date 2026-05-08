import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { getRouteMeta } from "../../lib/constants/routes";
import { buildDispatchResponseNotifications } from "../../lib/domain/dispatchNotifications";
import { getOperationsRepository } from "../../lib/repositories";
import { SidebarNav } from "../navigation/SidebarNav";

const DISPATCH_NOTIFICATION_REFRESH_MS = 60 * 1000;

function BellIcon({ className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.5 18.25a2.5 2.5 0 0 1-5 0m9-2.5H5.5c1.2-1.35 1.8-2.78 1.8-4.3V9.3a4.7 4.7 0 0 1 9.4 0v2.15c0 1.52.6 2.95 1.8 4.3Z"
      />
    </svg>
  );
}

function CloseIcon({ className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function DispatchNotificationBell({
  notifications,
  loading,
  error,
  open,
  hasUnreadAlert,
  onClose,
  onOpenDispatch,
  onToggle,
}) {
  const criticalCount = notifications.filter((notification) => notification.severity === "critical").length;
  const badgeCount = notifications.length;
  const buttonTone =
    criticalCount > 0
      ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
      : badgeCount > 0
        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        : "border-[#cfd6e2] bg-white text-slate-600 hover:bg-slate-50";

  return (
    <div className="relative flex shrink-0 justify-end">
      <button
        aria-expanded={open}
        aria-label={
          badgeCount > 0
            ? `${badgeCount} dispatch response notification${badgeCount === 1 ? "" : "s"}`
            : "Dispatch response notifications"
        }
        className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition ${buttonTone}`}
        onClick={onToggle}
        type="button"
      >
        <BellIcon className="h-5 w-5" />
        {badgeCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white ring-2 ring-white">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        ) : null}
        {loading && badgeCount === 0 ? (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-indigo-500 ring-2 ring-white" />
        ) : null}
        {hasUnreadAlert ? (
          <span className="absolute inset-0 rounded-full ring-4 ring-rose-200/70" />
        ) : null}
      </button>

      <span className="sr-only" aria-live="polite">
        {criticalCount > 0
          ? `${criticalCount} worker response alert${criticalCount === 1 ? "" : "s"} need attention.`
          : ""}
      </span>

      {open ? (
        <section className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl border border-[#d8ddea] bg-white shadow-2xl shadow-slate-900/20">
          <div className="flex items-start justify-between gap-4 border-b border-[#e5e9f2] px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Dispatch alerts
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {badgeCount > 0
                  ? `${badgeCount} worker response item${badgeCount === 1 ? "" : "s"}`
                  : "All worker confirmations clear"}
              </p>
            </div>
            <button
              aria-label="Close dispatch alerts"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8ddea] text-slate-500 transition hover:bg-slate-50"
              onClick={onClose}
              type="button"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-4 py-3">
            {error ? (
              <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                Dispatch alert feed unavailable.
              </div>
            ) : null}

            {notifications.length === 0 ? (
              <div className="rounded-xl border border-[#e5e9f2] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">No worker response problems right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <article
                    className={`rounded-xl border p-3 ${
                      notification.severity === "critical"
                        ? "border-rose-200 bg-rose-50"
                        : "border-amber-200 bg-amber-50"
                    }`}
                    key={notification.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">{notification.title}</p>
                        <p className="mt-1 text-sm leading-5 text-slate-700">{notification.message}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${
                          notification.severity === "critical"
                            ? "bg-rose-600 text-white"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        {notification.ageLabel}
                      </span>
                    </div>

                    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      {notification.details.map(([label, value]) => (
                        <div className="rounded-lg bg-white/75 p-2" key={`${notification.id}-${label}`}>
                          <dt className="font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
                          <dd className="mt-1 break-words font-semibold text-slate-800">{value}</dd>
                        </div>
                      ))}
                    </dl>

                    <button
                      className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      onClick={() => onOpenDispatch(notification)}
                      type="button"
                    >
                      Open dispatch board
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dispatchNotificationsOpen, setDispatchNotificationsOpen] = useState(false);
  const [hasUnreadDispatchAlert, setHasUnreadDispatchAlert] = useState(false);
  const [dispatchNotificationState, setDispatchNotificationState] = useState({
    notifications: [],
    loading: true,
    error: null,
  });
  const previousDispatchNotificationKeys = useRef(new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const routeMeta = getRouteMeta(location.pathname);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;
    const repository = getOperationsRepository();

    async function loadDispatchNotifications() {
      try {
        const pageData = await repository.getDispatchPageData();

        if (!isMounted) {
          return;
        }

        setDispatchNotificationState({
          notifications: buildDispatchResponseNotifications({
            jobRecords: pageData.jobRecords,
            technicians: pageData.technicians,
          }),
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setDispatchNotificationState((current) => ({
          ...current,
          loading: false,
          error,
        }));
      }
    }

    loadDispatchNotifications();
    const intervalId = window.setInterval(loadDispatchNotifications, DISPATCH_NOTIFICATION_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const notificationKeys = new Set(
      dispatchNotificationState.notifications.map(
        (notification) => `${notification.id}:${notification.severity}`,
      ),
    );
    const previousKeys = previousDispatchNotificationKeys.current;
    const hasNewAlert = Array.from(notificationKeys).some((key) => !previousKeys.has(key));

    if (notificationKeys.size > 0 && hasNewAlert) {
      setDispatchNotificationsOpen(true);
      setHasUnreadDispatchAlert(true);
    }

    previousDispatchNotificationKeys.current = notificationKeys;
  }, [dispatchNotificationState.notifications]);

  const toggleDispatchNotifications = () => {
    setDispatchNotificationsOpen((current) => {
      const nextOpen = !current;

      if (nextOpen) {
        setHasUnreadDispatchAlert(false);
      }

      return nextOpen;
    });
  };

  const closeDispatchNotifications = () => {
    setDispatchNotificationsOpen(false);
    setHasUnreadDispatchAlert(false);
  };

  const openDispatchBoard = () => {
    closeDispatchNotifications();
    navigate("/dashboard/dispatch-board");
  };

  const renderNotificationBell = () => (
    <DispatchNotificationBell
      error={dispatchNotificationState.error}
      hasUnreadAlert={hasUnreadDispatchAlert}
      loading={dispatchNotificationState.loading}
      notifications={dispatchNotificationState.notifications}
      onClose={closeDispatchNotifications}
      onOpenDispatch={openDispatchBoard}
      onToggle={toggleDispatchNotifications}
      open={dispatchNotificationsOpen}
    />
  );

  return (
    <div className="min-h-screen bg-[#eef1f6] md:flex">
      <SidebarNav mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <main className="min-h-screen min-w-0 flex-1 bg-[#eef1f6]">
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#d8ddea] bg-white px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-xl border border-[#cfd6e2] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            type="button"
          >
            Menu
          </button>
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {routeMeta.eyebrow}
            </p>
            <p className="mt-1 truncate text-sm text-slate-500">{routeMeta.alert}</p>
          </div>
          {renderNotificationBell()}
        </div>

        <div className="sticky top-0 z-30 hidden items-center justify-between gap-4 border-b border-[#d8ddea] bg-white px-8 py-3 md:flex">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {routeMeta.eyebrow}
            </p>
            <p className="mt-1 truncate text-sm font-medium text-slate-600">{routeMeta.alert}</p>
          </div>
          {renderNotificationBell()}
        </div>

        <Outlet />
      </main>
    </div>
  );
}
