/** @typedef {import("../../types/models").RepositorySource} RepositorySource */

export const DEFAULT_DATA_SOURCE = "mock";

/**
 * @returns {RepositorySource}
 */
export function getRequestedDataSource() {
  const configuredSource =
    import.meta.env.VITE_APP_DATA_SOURCE ||
    import.meta.env.VITE_DATA_SOURCE ||
    DEFAULT_DATA_SOURCE;

  return configuredSource === "supabase" ? "supabase" : "mock";
}

export function getDataSourceStatus() {
  return {
    requested: getRequestedDataSource(),
    defaultSource: DEFAULT_DATA_SOURCE,
    supportedSources: ["mock", "supabase"],
  };
}
