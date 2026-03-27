import { CLIENT_ACTIONS } from "../ws-contract.js";

export interface WsDefaultEvent {
  body?: string | null;
  queryStringParameters?: Record<string, string | undefined>;
  requestContext?: {
    connectionId?: string;
  };
}

interface ChatSendAction {
  (input: { connectionId?: string; eventId?: string; text: string }): Promise<object>;
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

export function createDefaultRouteHandler(deps?: { chatSendAction?: ChatSendAction }) {
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

    if (candidate.action === "chat:send") {
      const payload = candidate.payload;

      if (!payload || typeof payload !== "object") {
        return badRequest({
          error: {
            code: "INVALID_PAYLOAD",
            message: "Payload must be an object.",
          },
        });
      }

      const text = (payload as { text?: unknown }).text;

      if (typeof text !== "string" || !text.trim()) {
        return badRequest({
          error: {
            code: "INVALID_PAYLOAD",
            message: "chat:send requires non-empty text.",
          },
        });
      }

      if (!deps?.chatSendAction) {
        return ok({
          accepted: true,
          action: candidate.action,
          deferred: true,
        });
      }

      try {
        const result = await deps.chatSendAction({
          connectionId: event.requestContext?.connectionId,
          eventId: event.queryStringParameters?.eventId,
          text,
        });

        return ok(result);
      } catch (error) {
        if (error instanceof Error && error.message === "SENDER_NOT_FOUND") {
          return badRequest({
            error: {
              code: "SENDER_NOT_FOUND",
              message: "Sender identity could not be resolved for this connection.",
            },
          });
        }

        throw error;
      }
    }

    return ok({
      accepted: true,
      action: candidate.action,
    });
  };
}
