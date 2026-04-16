import { hiringCandidates } from "../data/mockData";
import { Card, PageHeader, PageTabs, PrimaryButton, SecondaryButton } from "../components/ui";

const columns = [
  "applicant",
  "contacted",
  "interviewed",
  "trial_scheduled",
  "documents_pending",
  "onboarded",
  "inactive",
];

export function HiringPage() {
  return (
    <div className="space-y-0">
      <PageHeader
        title="Hiring"
        subtitle="A lightweight hiring pipeline focused on getting technicians contacted, evaluated, and ready for the field."
        action={
          <>
            <SecondaryButton>Refresh candidates</SecondaryButton>
            <PrimaryButton>Add applicant</PrimaryButton>
          </>
        }
      />
      <PageTabs tabs={[{ label: "Pipeline", active: true }, { label: "Bench" }]} />

      <Card className="m-4 overflow-x-auto p-6 sm:m-6 lg:m-8">
        <div className="grid min-w-[980px] gap-4 xl:grid-cols-7">
          {columns.map((column) => (
            <div key={column} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold capitalize text-slate-800">
                {column.replace("_", " ")}
              </p>
              <div className="mt-4 space-y-3">
                {hiringCandidates
                  .filter((candidate) => candidate.stage === column)
                  .map((candidate) => (
                    <div key={candidate.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="font-semibold text-slate-900">{candidate.name}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {candidate.trade} · {candidate.city}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">Source: {candidate.source}</p>
                      <button className="mt-4 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white">
                        {candidate.nextStep}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
