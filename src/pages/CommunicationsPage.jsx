import { communications, jobs } from "../data/mockData";
import {
  Badge,
  Card,
  PageHeader,
  PageTabs,
  PrimaryButton,
  SecondaryButton,
} from "../components/ui";

export function CommunicationsPage() {
  return (
    <div className="space-y-0">
      <PageHeader
        title="Communications"
        subtitle="A Twilio-ready mock interface for calls, texts, transcript review, and approving extracted operational events."
        action={
          <>
            <SecondaryButton>Refresh inbox</SecondaryButton>
            <PrimaryButton>Review unresolved</PrimaryButton>
          </>
        }
      />
      <PageTabs tabs={[{ label: "Calls & Texts", active: true }, { label: "Event Review" }]} />

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[0.9fr_1.1fr_0.9fr] lg:p-8">
        <Card className="p-6">
          <p className="section-title">Logs</p>
          <h2 className="mt-2 text-lg font-semibold">Calls and texts</h2>
          <div className="mt-6 space-y-4">
            {communications.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">
                    {item.channel} · {item.customer}
                  </p>
                  <Badge tone={item.status === "clear" ? "emerald" : "amber"}>{item.status}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.preview}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">{item.linkedJob}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-title">Transcript preview</p>
          <h2 className="mt-2 text-lg font-semibold">Unresolved communications queue</h2>
          <div className="mt-6 space-y-4">
            {communications.map((item) => {
              const linkedJob = jobs.find((job) => job.id === item.linkedJob);

              return (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone="indigo">{item.channel}</Badge>
                    <Badge tone={item.status === "clear" ? "emerald" : "rose"}>{item.status}</Badge>
                    <span className="text-sm text-slate-500">{item.customer}</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{item.transcript}</p>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Linked job context
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {linkedJob?.appliance} · {linkedJob?.payment_status.replace("_", " ")} ·{" "}
                      {linkedJob?.parts_status.replace("_", " ")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-title">Extracted events</p>
          <h2 className="mt-2 text-lg font-semibold">Approve or reject</h2>
          <div className="mt-6 space-y-4">
            {communications.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-medium text-slate-900">{item.extractedEvent}</p>
                <p className="mt-2 text-sm text-slate-500">{item.customer}</p>
                <div className="mt-4 flex gap-3">
                  <button className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white">
                    Approve
                  </button>
                  <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
