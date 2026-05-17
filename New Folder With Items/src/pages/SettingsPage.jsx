import { useState } from "react";
import { Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { PageScaffold } from "../components/layout/PageScaffold";
import { PageStateNotice } from "../components/layout/PageStateNotice";
import { useAsyncValue } from "../hooks/useAsyncValue";
import { getOperationsRepository } from "../lib/repositories";
import { downloadTextFile } from "../lib/download";

const SETTINGS_FEEDBACK_TONES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

export function SettingsPage() {
  const repository = getOperationsRepository();
  const [settingsFeedback, setSettingsFeedback] = useState(null);
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

  const exportSettings = () => {
    if (!data) {
      return;
    }

    downloadTextFile(
      "asap-settings-export.json",
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          integrationStatus,
          settingsGroups: data.settingsGroups,
        },
        null,
        2,
      )}\n`,
      "application/json;charset=utf-8",
    );

    setSettingsFeedback({
      message: "Settings export downloaded.",
      tone: "emerald",
    });
  };

  const saveLayout = () => {
    try {
      localStorage.setItem(
        "asap.dashboard.layout",
        JSON.stringify({
          savedAt: new Date().toISOString(),
          settingsView: "company",
          contentClassName: "grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3 lg:p-8",
        }),
      );
      setSettingsFeedback({
        message: "Dashboard layout preference saved on this browser.",
        tone: "emerald",
      });
    } catch (storageError) {
      setSettingsFeedback({
        message: storageError.message,
        tone: "rose",
      });
    }
  };

  const actions = (
    <>
      <SecondaryButton onClick={exportSettings} disabled={!data}>
        Export settings
      </SecondaryButton>
      <PrimaryButton onClick={saveLayout}>Save layout</PrimaryButton>
    </>
  );

  if (isLoading) {
    return (
      <PageScaffold
        title="Settings"
        subtitle="Company setup, operational defaults, permissions, and integration readiness."
        actions={actions}
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
        subtitle="Company setup, operational defaults, permissions, and integration readiness."
        actions={actions}
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
      subtitle="Company setup, operational defaults, permissions, and integration readiness."
      actions={actions}
      tabs={[{ label: "Company", active: true }, { label: "Integrations" }]}
      contentClassName="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3 lg:p-8"
    >
      {settingsFeedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm sm:col-span-2 xl:col-span-3 ${
            SETTINGS_FEEDBACK_TONES[settingsFeedback.tone] || SETTINGS_FEEDBACK_TONES.amber
          }`}
        >
          {settingsFeedback.message}
        </div>
      ) : null}
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
