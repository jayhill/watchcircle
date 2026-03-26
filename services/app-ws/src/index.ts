export interface WsEnvelope<TPayload = unknown> {
  action: string;
  payload: TPayload;
}

export const CLIENT_ACTIONS = [
  "chat:send",
  "chat:react",
  "chat:flag",
  "chat:dm",
  "question:ask",
  "question:upvote",
  "question:removeUpvote",
  "question:flag",
  "highlight:create",
  "highlight:react",
  "sync:heartbeat",
  "moderation:hide",
  "moderation:unhide",
  "moderation:boot",
  "moderation:unboot",
  "chat:toggleEnabled",
  "questions:toggleEnabled",
] as const;

export async function connectHandler() {
  return {
    statusCode: 200,
    body: "connected",
  };
}

export async function disconnectHandler() {
  return {
    statusCode: 200,
    body: "disconnected",
  };
}

export async function defaultHandler() {
  return {
    statusCode: 200,
    body: "ok",
  };
}
