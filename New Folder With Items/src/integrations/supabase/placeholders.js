export function createQueryPlaceholder(options) {
  return {
    kind: "supabase-query-placeholder",
    mode: "scaffolding_only",
    fallbackSource: "mock",
    ...options,
  };
}

export function createMutationPlaceholder(options) {
  return {
    kind: "supabase-mutation-placeholder",
    mode: "scaffolding_only",
    fallbackSource: "mock",
    ...options,
  };
}

export function createMutationResultPlaceholder({ operation, source, plan, payload, record, message }) {
  return {
    ok: true,
    source,
    operation,
    message,
    plan,
    payload,
    record,
  };
}
