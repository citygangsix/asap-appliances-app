import { activityFeed, callMetrics, jobs, technicians, urgentQueues } from "../data/mockData";
import {
  Badge,
  Card,
  PageHeader,
  PageTabs,
  PrimaryButton,
  SecondaryButton,
  StatCard,
} from "../components/ui";

const kpis = [
  { label: "Jobs today", value: "26", detail: "18 active, 5 completed, 3 at risk" },
  { label: "Callbacks needed", value: "7", detail: "4 from customers, 3 from technicians" },
  { label: "Technicians en route", value: "3", detail: "1 late, 1 needs escalation check" },
  { label: "Parts awaiting payment", value: "3", detail: "2 high-priority refrigerators" },
  { label: "Labor due today", value: "$1,240", detail: "2 onsite and 4 pending completion" },
  { label: "Unresolved communications", value: "5", detail: "3 text threads and 2 calls" },
];

export function HomePage() {
  return (
    <div className="space-y-0">
      <PageHeader
        title="Home"
        subtitle="A live operations view of the business: queues, tech movement, and what needs attention right now."
        action={
          <>
            <SecondaryButton>Refresh dashboard</SecondaryButton>
            <PrimaryButton>Open urgent queue</PrimaryButton>
          </>
        }
      />
      <PageTabs tabs={[{ label: "Command Center", active: true }, { label: "Today's Activity" }]} />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpis.map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-title">Today&apos;s activity</p>
                <h2 className="mt-2 text-lg font-semibold">Operational feed</h2>
              </div>
              <Badge tone="indigo">Live</Badge>
            </div>
            <div className="mt-6 space-y-4">
              {activityFeed.map((entry) => (
                <div key={entry} className="flex gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  <p className="text-sm leading-6 text-slate-600">{entry}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <p className="section-title">Calls today</p>
            <h2 className="mt-2 text-lg font-semibold">Who did what</h2>
            <div className="mt-6 space-y-4">
              {callMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-end justify-between">
                    <p className="text-sm text-slate-500">{metric.label}</p>
                    <p className="text-2xl font-semibold">{metric.value}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{metric.detail}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <Card className="p-6">
            <p className="section-title">Urgent queues</p>
            <h2 className="mt-2 text-lg font-semibold">Needs action</h2>
            <div className="mt-6 space-y-4">
              {urgentQueues.map((queue) => (
                <div
                  key={queue.label}
                  className="flex items-center justify-between rounded-2xl border border-[#dce2ec] bg-slate-50 px-4 py-4"
                >
                  <div>
                    <p className="font-medium text-slate-800">{queue.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{queue.ids.join(" • ")}</p>
                  </div>
                  <div className="rounded-full bg-[#1f2430] px-3 py-1 text-sm font-semibold text-white">
                    {queue.count}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <p className="section-title">Technician status</p>
            <h2 className="mt-2 text-lg font-semibold">Field snapshot</h2>
            <div className="mt-6 space-y-3">
              {technicians.map((tech) => (
                <div key={tech.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{tech.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{tech.serviceArea}</p>
                    </div>
                    <Badge tone={tech.statusToday === "Late" ? "rose" : "indigo"}>{tech.statusToday}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <p className="section-title">Hiring bottlenecks</p>
            <h2 className="mt-2 text-lg font-semibold">What slows onboarding</h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="font-medium text-amber-900">2 documents pending</p>
                <p className="mt-2 text-sm text-amber-700">Insurance certificates and driver records are holding up start dates.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-medium text-slate-800">1 trial ride-along this week</p>
                <p className="mt-2 text-sm text-slate-500">Laundry technician candidate needs final field evaluation.</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="font-medium text-emerald-900">1 onboarded</p>
                <p className="mt-2 text-sm text-emerald-700">Marcus Hale is ready for software and invoicing training.</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-title">Watch list</p>
              <h2 className="mt-2 text-lg font-semibold">High-friction jobs</h2>
            </div>
            <Badge tone="amber">Escalation view</Badge>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {jobs
              .filter((job) => ["failed", "parts_due", "partial"].includes(job.payment_status))
              .map((job) => (
                <div key={job.id} className="rounded-2xl border border-[#dce2ec] bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{job.customer}</p>
                      <p className="mt-1 text-sm text-slate-500">{job.appliance}</p>
                    </div>
                    <Badge tone="rose">{job.payment_status.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{job.notes}</p>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
