import { settingsGroups } from "../data/mockData";
import { Card, PageHeader, PageTabs, PrimaryButton, SecondaryButton } from "../components/ui";

export function SettingsPage() {
  return (
    <div className="space-y-0">
      <PageHeader
        title="Settings"
        subtitle="Placeholder sections for company setup, operational defaults, permissions, and future integrations."
        action={
          <>
            <SecondaryButton>Export settings</SecondaryButton>
            <PrimaryButton>Save layout</PrimaryButton>
          </>
        }
      />
      <PageTabs tabs={[{ label: "Company", active: true }, { label: "Integrations" }]} />

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3 lg:p-8">
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
      </div>
    </div>
  );
}
