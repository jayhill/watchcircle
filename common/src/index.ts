export type Role = "host" | "cohost" | "panelist" | "participant";

export interface WsTokenClaims {
  sub: string;
  eventId: string;
  role: Role;
  aud: "ws-connect";
  iat: number;
  exp: number;
  jti?: string;
}

export const CONTRACT_CONSTANTS = {
  WS_TOKEN_TTL_SECONDS: 90,
  AUTH_REQUEST_LIMIT_PER_EMAIL_PER_HOUR: 5,
  AUTH_REQUEST_LIMIT_PER_IP_PER_HOUR: 20,
  AUTH_VERIFY_LIMIT_PER_IP_PER_HOUR: 10,
  AUTH_VERIFY_MAX_FAILED_ATTEMPTS_PER_EMAIL_EVENT: 5,
  AUTH_VERIFY_LOCK_MINUTES: 15,
  MAGIC_LINK_TTL_MINUTES: 15,
  SESSION_TTL_HOURS: 24,
} as const;

export * from "./db/client.js";
export * from "./db/operations.js";
export * from "./db/table-schema.js";
export * from "./contracts/ws-events.js";
export * from "./auth/magic-link.js";
export * from "./auth/rate-limit.js";
export * from "./auth/session.js";
