import { handleOperationsFetchRequest } from "./_repo/server/lib/operationsFetchRouter.js";

const runtimeGlobal = globalThis as typeof globalThis & {
  Deno?: {
    serve(handler: (request: Request) => Response | Promise<Response>): unknown;
  };
  addEventListener?: (
    type: "fetch",
    listener: (event: {
      request: Request;
      respondWith(response: Response | Promise<Response>): void;
    }) => void,
  ) => void;
  process?: {
    env: {
      PORT?: string;
      [key: string]: string | undefined;
    };
  };
};

function stripPathPrefix(pathname: string, prefix: string) {
  if (!prefix || prefix === "/") {
    return pathname;
  }

  const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;

  if (pathname === normalizedPrefix) {
    return "/";
  }

  if (pathname.startsWith(`${normalizedPrefix}/`)) {
    return pathname.slice(normalizedPrefix.length) || "/";
  }

  return pathname;
}

async function handler(request: Request) {
  const url = new URL(request.url);
  const pathname = stripPathPrefix(url.pathname, "/asap-crm");

  if (request.method === "GET" && pathname === "/health") {
    return new Response(JSON.stringify({ ok: true, status: "ok" }), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  return handleOperationsFetchRequest(request, {
    pathPrefix: "/asap-crm",
  });
}

if (runtimeGlobal.Deno?.serve) {
  runtimeGlobal.Deno.serve(handler);
} else {
  runtimeGlobal.addEventListener?.("fetch", (event) => {
    event.respondWith(handler(event.request));
  });
}
