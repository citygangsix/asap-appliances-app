import { useMemo, useState } from "react";
import { jobs } from "../data/mockData";
import {
  Badge,
  Card,
  FilterSelect,
  PageHeader,
  PageTabs,
  PrimaryButton,
  SecondaryButton,
} from "../components/ui";

const statusTone = {
  new: "blue",
  scheduled: "blue",
  en_route: "teal",
  onsite: "emerald",
  paused: "amber",
  return_scheduled: "amber",
  completed: "emerald",
  canceled: "rose",
  unassigned: "rose",
  assigned: "blue",
  confirmed: "teal",
  late: "amber",
  escalated: "rose",
  none_due: "slate",
  parts_due: "amber",
  parts_paid: "emerald",
  labor_due: "amber",
  labor_paid: "emerald",
  partial: "amber",
  failed: "rose",
  none_needed: "slate",
  quoted: "blue",
  awaiting_payment: "amber",
  ready_to_order: "blue",
  ordered: "teal",
  shipped: "blue",
  delivered: "emerald",
  installed: "emerald",
  clear: "emerald",
  awaiting_callback: "amber",
  unread_message: "blue",
  unresolved: "rose",
};

function formatStatus(value) {
  return value.replaceAll("_", " ");
}

export function JobsPage() {
  const [search, setSearch] = useState("");
  const [technician, setTechnician] = useState("All technicians");
  const [lifecycle, setLifecycle] = useState("All lifecycle");
  const [payment, setPayment] = useState("All payment");
  const [parts, setParts] = useState("All parts");
  const [selectedJob, setSelectedJob] = useState(jobs[0]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const searchMatch =
        search.trim() === "" ||
        `${job.customer} ${job.appliance} ${job.issue} ${job.id}`
          .toLowerCase()
          .includes(search.toLowerCase());

      return (
        searchMatch &&
        (technician === "All technicians" || job.technician === technician) &&
        (lifecycle === "All lifecycle" || job.lifecycle_status === lifecycle) &&
        (payment === "All payment" || job.payment_status === payment) &&
        (parts === "All parts" || job.parts_status === parts)
      );
    });
  }, [search, technician, lifecycle, payment, parts]);

  return (
    <div className="space-y-0">
      <PageHeader
        title="Jobs"
        subtitle="The main operational control page with separate state dimensions for dispatch, parts, payment, and communication."
        action={
          <>
            <SecondaryButton>Refresh jobs</SecondaryButton>
            <PrimaryButton>+ New Job</PrimaryButton>
          </>
        }
      />
      <PageTabs tabs={[{ label: "Queue View", active: true }, { label: "All Jobs" }]} />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Card className="p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <label className="flex flex-1 flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Search
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Customer, appliance, issue, or job ID"
                className="rounded-xl border border-[#cfd6e2] bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <FilterSelect
                label="Technician"
                value={technician}
                onChange={setTechnician}
                options={["All technicians", ...new Set(jobs.map((job) => job.technician))]}
              />
              <FilterSelect
                label="Lifecycle"
                value={lifecycle}
                onChange={setLifecycle}
                options={["All lifecycle", ...new Set(jobs.map((job) => job.lifecycle_status))]}
              />
              <FilterSelect
                label="Payment"
                value={payment}
                onChange={setPayment}
                options={["All payment", ...new Set(jobs.map((job) => job.payment_status))]}
              />
              <FilterSelect
                label="Parts"
                value={parts}
                onChange={setParts}
                options={["All parts", ...new Set(jobs.map((job) => job.parts_status))]}
              />
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Job</th>
                    <th className="px-5 py-4 font-semibold">Time</th>
                    <th className="px-5 py-4 font-semibold">Technician</th>
                    <th className="px-5 py-4 font-semibold">State stack</th>
                    <th className="px-5 py-4 font-semibold">Quick actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr
                      key={job.id}
                      className={`border-t border-[#edf0f5] align-top transition hover:bg-slate-50 ${
                        selectedJob.id === job.id ? "bg-indigo-50/70" : ""
                      }`}
                    >
                      <td className="px-5 py-4">
                        <button className="text-left" onClick={() => setSelectedJob(job)}>
                          <p className="font-semibold text-slate-900">{job.customer}</p>
                          <p className="mt-1 text-slate-500">{job.appliance}</p>
                          <p className="mt-1 text-slate-500">{job.issue}</p>
                        </button>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <p>{job.scheduledTime}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{job.id}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{job.technician}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={statusTone[job.lifecycle_status]}>{formatStatus(job.lifecycle_status)}</Badge>
                          <Badge tone={statusTone[job.dispatch_status]}>{formatStatus(job.dispatch_status)}</Badge>
                          <Badge tone={statusTone[job.payment_status]}>{formatStatus(job.payment_status)}</Badge>
                          <Badge tone={statusTone[job.parts_status]}>{formatStatus(job.parts_status)}</Badge>
                          <Badge tone={statusTone[job.communication_status]}>{formatStatus(job.communication_status)}</Badge>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {[
                            "Assign tech",
                            "Mark en route",
                            "Mark onsite",
                            "Request parts payment",
                            "Mark part ordered",
                            "Schedule return",
                            "Mark labor due",
                          ].map((action) => (
                            <button
                              key={action}
                              className="rounded-full border border-[#d6dce7] bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#e7ebf2] px-6 py-5">
              <div>
                <h2 className="text-[18px] font-semibold text-slate-900">Job details</h2>
                <p className="mt-1 text-sm text-slate-400">Selected record for dispatch and payment review</p>
              </div>
              <Badge tone="amber">Attention</Badge>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{selectedJob.customer}</h3>
                  <p className="mt-1 text-sm text-slate-500">{selectedJob.id}</p>
                </div>
                <Badge tone={statusTone[selectedJob.priority === "Escalated" ? "escalated" : "confirmed"]}>
                  {selectedJob.priority}
                </Badge>
              </div>

              <div className="mt-6 grid gap-4">
                {[
                  ["Appliance", selectedJob.appliance],
                  ["Issue", selectedJob.issue],
                  ["Scheduled", selectedJob.scheduledTime],
                  ["Technician", selectedJob.technician],
                  ["Address", selectedJob.address],
                  ["ETA", selectedJob.eta],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-[#e1e6ef] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-[#202430] p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Field notes</p>
                <p className="mt-3 text-sm leading-6 text-slate-200">{selectedJob.notes}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
