import { Buffer } from "node:buffer";
import process from "node:process";

type RuntimeGlobal = typeof globalThis & {
  Buffer?: typeof Buffer;
  Deno?: {
    env: {
      toObject(): Record<string, string>;
    };
  };
  process?: typeof process;
};

const runtimeGlobal = globalThis as RuntimeGlobal;

runtimeGlobal.Buffer = runtimeGlobal.Buffer || Buffer;
runtimeGlobal.process = runtimeGlobal.process || process;

if (runtimeGlobal.Deno?.env) {
  Object.assign(runtimeGlobal.process.env, runtimeGlobal.Deno.env.toObject());
}
