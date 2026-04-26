import "./edgeRuntime.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOperationsFetchRequest } from "./_repo/server/lib/operationsFetchRouter.js";

const runtimeGlobal = globalThis as typeof globalThis & {
  process?: {
    env: {
      PORT?: string;
    };
  };
};

serve((request: Request) =>
  handleOperationsFetchRequest(request, {
    pathPrefix: "/asap-crm",
  }), {
  port: Number(runtimeGlobal.process.env.PORT || 8000),
});
