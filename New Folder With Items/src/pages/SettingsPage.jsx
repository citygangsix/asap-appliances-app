import { Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";

export function SettingsPage() {
  const repository = getOperationsRepository();
  const { data, error, isLoading } = useAsyncValue(() => repository.getSettingsPageData(), [repository]);
  const integrationStatus =
    typeof repository.getClientStatus === "function"
      ? repository.getClientStatus()
      : {
          configured: true,
          provider: "mock",
          mode: "mock_only",
          dataSource: {
            requested: repository.source,
          },
          reason: "Mock repository is active.",
        };

  if (isLoading) {
    return (
      <PageScaffold
        title="Settings"
        subtitle="Placeholder sections for company setup, operational defaults, permissions, and future integrations."
        actions={
          <>
            <SecondaryButton>Export settings</SecondaryButton>
            <PrimaryButton>Save layout</PrimaryButton>
          </>
        }
        tabs={[{ label: "Company", active: true }, { label: "Integrations" }]}
        contentClassName="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3 lg:p-8"
      >
        <PageStateNotice title="Loading settings" message="Fetching configuration groups and integration status." />
      </PageScaffold>
    );
  }

  if (error || !data) {
    return (
      <PageScaffold
        title="Settings"
        subtitle="Placeholder sections for company setup, operational defaults, permissions, and future integrations."
        actions={
          <>
            <SecondaryButton>Export settings</SecondaryButton>
            <PrimaryButton>Save layout</PrimaryButton>
          </>
        }
        tabs={[{ label: "Company", active: true }, { label: "Integrations" }]}
        contentClassName="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3 lg:p-8"
      >
        <PageStateNotice title="Settings unavailable" message={error?.message || "Settings data could not be loaded."} />
      </PageScaffold>
    );
  }

  const { settingsGroups } = data;

  return (
    <PageScaffold
      title="Settings"
      subtitle="Placeholder sections for company setup, operational defaults, permissions, and future integrations."
      actions={
        <>
          <SecondaryButton>Export settings</SecondaryButton>
          <PrimaryButton>Save layout</PrimaryButton>
        </>
      }
      tabs={[{ label: "Company", active: true }, { label: "Integrations" }]}
      contentClassName="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3 lg:p-8"
    >
      <Card className="p-6">
        <p className="section-title">Supabase status</p>
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <p>Provider: {integrationStatus.provider}</p>
          <p>Mode: {integrationStatus.mode}</p>
          <p>Configured: {integrationStatus.configured ? "Yes" : "No"}</p>
          <p>Requested source: {integrationStatus.dataSource?.requested || repository.source}</p>
          <p>{integrationStatus.reason}</p>
        </div>
      </Card>
      {settingsGroups.map((group) => (
        <Card key={group.title} className="p-6">
          <p className="section-title">{group.title}</p>
          <div className="mt-4 space-y-3">
            {group.items.map((item) => (
              <div key={item} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </PageScaffold>
  );
}
