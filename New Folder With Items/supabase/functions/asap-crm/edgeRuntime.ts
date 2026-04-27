type RuntimeGlobal = typeof globalThis & {
  Deno?: {
    env: {
      toObject(): Record<string, string>;
    };
  };
  process?: {
    env: Record<string, string>;
  };
};

const runtimeGlobal = globalThis as RuntimeGlobal;

runtimeGlobal.process = runtimeGlobal.process || { env: {} };
runtimeGlobal.process.env = runtimeGlobal.process.env || {};

if (runtimeGlobal.Deno?.env) {
  Object.assign(runtimeGlobal.process.env, runtimeGlobal.Deno.env.toObject());
}
