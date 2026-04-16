import { jobs, technicians } from "../data/mockData";
import {
  Badge,
  Card,
  PageHeader,
  PageTabs,
  PrimaryButton,
  SecondaryButton,
} from "../components/ui";

const groups = ["unassigned", "assigned", "en_route", "late", "escalated"];

export function DispatchPage() {
  return (
    <div className="space-y-0">
      <PageHeader
        title="Dispatch"
        subtitle="Track assignment pressure, ETA confidence, and which jobs are slipping before customers call in."
        action={
          <>
            <SecondaryButton>Refresh board</SecondaryButton>
            <PrimaryButton>Escalation queue</PrimaryButton>
          </>
        }
      />
      <PageTabs tabs={[{ label: "Live Board", active: true }, { label: "Escalations" }]} />

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-title">Live jobs today</p>
              <h2 className="mt-2 text-lg font-semibold">Dispatch board</h2>
            </div>
            <Badge tone="indigo">Customer updates tracked</Badge>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-5">
            {groups.map((group) => (
              <div key={group} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold capitalize text-slate-800">{group.replace("_", " ")}</p>
                <div className="mt-4 space-y-3">
                  {jobs
                    .filter((job) => job.dispatch_status === group || job.lifecycle_status === group)
                    .map((job) => (
                      <div key={job.id} className="rounded-2xl border border-[#dce2ec] bg-white p-3">
                        <p className="text-sm font-semibold text-slate-900">{job.customer}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{job.id}</p>
                        <p className="mt-2 text-sm text-slate-500">{job.technician}</p>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>{job.eta}</span>
                          <span>{job.customerUpdated ? "Updated" : "Not updated"}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="section-title">Technician assignment</p>
            <h2 className="mt-2 text-lg font-semibold">Availability board</h2>
            <div className="mt-6 space-y-4">
              {technicians.map((tech) => (
                <div key={tech.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{tech.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{tech.availability}</p>
                    </div>
                    <Badge tone={tech.statusToday === "Late" ? "rose" : "indigo"}>{tech.statusToday}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <p className="section-title">Simple map</p>
            <h2 className="mt-2 text-lg font-semibold">Coverage placeholder</h2>
            <div className="mt-6 rounded-[28px] bg-[#202430] p-6 text-white">
              <div className="grid h-64 place-items-center rounded-[22px] border border-dashed border-white/20 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.2),_transparent_34%)]">
                <div className="text-center">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Map preview</p>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-slate-300">
                    Future map view for route clustering, ETA confidence, and territory balancing.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
