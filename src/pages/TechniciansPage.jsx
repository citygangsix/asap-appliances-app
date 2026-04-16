import { technicians } from "../data/mockData";
import {
  Badge,
  Card,
  PageHeader,
  PageTabs,
  PrimaryButton,
  SecondaryButton,
} from "../components/ui";

export function TechniciansPage() {
  return (
    <div className="space-y-0">
      <PageHeader
        title="Technicians"
        subtitle="Field performance, current availability, and payout visibility in one place."
        action={
          <>
            <SecondaryButton>Refresh roster</SecondaryButton>
            <PrimaryButton>Add technician</PrimaryButton>
          </>
        }
      />
      <PageTabs tabs={[{ label: "Roster", active: true }, { label: "Scorecards" }]} />

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
        <div className="grid gap-4 md:grid-cols-2">
          {technicians.map((tech) => (
            <Card key={tech.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{tech.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{tech.serviceArea}</p>
                </div>
                <Badge tone={tech.statusToday === "Late" ? "rose" : "indigo"}>{tech.statusToday}</Badge>
              </div>

              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <p>Skills: {tech.skills.join(", ")}</p>
                <p>Availability: {tech.availability}</p>
                <p>Jobs completed this week: {tech.jobsCompleted}</p>
                <p>Callback rate: {tech.callbackRate}</p>
                <p>Payout total: {tech.payoutTotal}</p>
                <p>Gas reimbursement: {tech.gasReimbursement}</p>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <p className="section-title">Scorecard</p>
          <h2 className="mt-2 text-lg font-semibold">Technician accountability panel</h2>
          <div className="mt-6 space-y-5">
            {technicians.map((tech) => (
              <div key={tech.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{tech.name}</p>
                  <p className="text-lg font-semibold text-slate-900">{tech.score}</p>
                </div>
                <div className="mt-3 h-3 rounded-full bg-slate-200">
                  <div
                    className="h-3 rounded-full bg-indigo-500"
                    style={{ width: `${tech.score}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  Weighted from callback rate, completed jobs, schedule discipline, and payout efficiency.
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
