import { CLIENT_ACTIONS } from "../ws-contract.js";

export interface WsDefaultEvent {
  body?: string | null;
}

function badRequest(body: object) {
  return {
    statusCode: 400,
    body: JSON.stringify(body),
  };
}

function ok(body: object) {
  return {
    statusCode: 200,
    body: JSON.stringify(body),
  };
}

export function createDefaultRouteHandler() {
  return async (event: WsDefaultEvent) => {
    if (!event.body) {
      return badRequest({
        error: {
          code: "INVALID_ENVELOPE",
          message: "Message body is required.",
        },
      });
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(event.body);
    } catch {
      return badRequest({
        error: {
          code: "INVALID_ENVELOPE",
          message: "Message body must be valid JSON.",
        },
      });
    }

    if (!parsed || typeof parsed !== "object") {
      return badRequest({
        error: {
          code: "INVALID_ENVELOPE",
          message: "Message body must be an object.",
        },
      });
    }

    const candidate = parsed as { action?: unknown; payload?: unknown };

    if (!candidate.action || typeof candidate.action !== "string") {
      return badRequest({
        error: {
          code: "INVALID_ENVELOPE",
          message: "Action is required.",
        },
      });
    }

    if (!CLIENT_ACTIONS.includes(candidate.action as (typeof CLIENT_ACTIONS)[number])) {
      return badRequest({
        error: {
          code: "UNKNOWN_ACTION",
          message: `Unsupported action: ${candidate.action}`,
        },
      });
    }

    return ok({
      accepted: true,
      action: candidate.action,
    });
  };
}
