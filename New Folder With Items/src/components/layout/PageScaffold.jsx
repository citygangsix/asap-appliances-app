import { PageHeader, PageTabs } from "../ui";

/**
 * @typedef {import("../../types/models").PageTab} PageTab
 */

/**
 * @typedef {Object} PageScaffoldProps
 * @property {string} title
 * @property {string} [subtitle]
 * @property {React.ReactNode} [actions]
 * @property {PageTab[]} [tabs]
 * @property {React.ReactNode} children
 * @property {string} [contentClassName]
 */

/**
 * Shared page shell so routed pages keep the same chrome and spacing.
 *
 * @param {PageScaffoldProps} props
 */
export function PageScaffold({
  title,
  subtitle,
  actions,
  tabs = [],
  children,
  contentClassName = "space-y-6 p-4 sm:p-6 lg:p-8",
}) {
  return (
    <div className="space-y-0">
      <PageHeader title={title} subtitle={subtitle} action={actions} />
      {tabs.length > 0 ? <PageTabs tabs={tabs} /> : null}
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
