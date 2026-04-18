/**
 * @typedef {import("../../types/models").PageTab} PageTab
 */

/**
 * @param {{
 *   section?: string,
 *   title: string,
 *   subtitle?: string,
 *   action?: import("react").ReactNode
 * }} props
 */
export function PageHeader({ section = "CRM", title, subtitle, action }) {
  return (
    <div className="border-b border-[#d8ddea] bg-white px-5 py-5 sm:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[15px] text-slate-400">
            {section} / <span className="font-semibold text-slate-900">{title}</span>
          </p>
          {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
      </div>
    </div>
  );
}

/**
 * @param {{ tabs?: PageTab[] }} props
 */
export function PageTabs({ tabs }) {
  if (!tabs?.length) {
    return null;
  }

  return (
    <div className="border-b border-[#d8ddea] bg-white px-5 sm:px-8">
      <div className="flex gap-8 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id || tab.label}
            className={`border-b-[3px] pb-4 pt-5 text-[17px] font-semibold whitespace-nowrap transition ${
              tab.active
                ? "border-indigo-500 text-indigo-500"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {{ children: import("react").ReactNode, className?: string }} props
 */
export function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}

/**
 * @param {{ tone?: string, children: import("react").ReactNode }} props
 */
export function Badge({ tone = "slate", children }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    blue: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

/**
 * @param {{ children: import("react").ReactNode, className?: string } & import("react").ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * @param {{ children: import("react").ReactNode, className?: string } & import("react").ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function SecondaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`rounded-2xl border border-[#cfd6e2] bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * @param {import("../../types/models").SummaryStat} props
 */
export function StatCard({ label, value, detail }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </Card>
  );
}

/**
 * @param {{
 *   label: string,
 *   value: string,
 *   onChange: (value: string) => void,
 *   options: string[]
 * }} props
 */
export function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex min-w-[150px] flex-col gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-[#cfd6e2] bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none ring-0 transition focus:border-indigo-500"
      >
        {options.map((option) => (
          <option key={`${label}-${option}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
