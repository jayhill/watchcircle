import crypto from "node:crypto";

import { CONTRACT_CONSTANTS, type Role, type WsTokenClaims } from "../index.js";

export interface SessionClaims {
  sub: string;
  email: string;
  eventId: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface SessionTokenService {
  createSessionToken(input: {
    userId: string;
    email: string;
    eventId: string;
    role: Role;
    nowMs?: number;
  }): string;
  verifySessionToken(token: string): SessionClaims;
}

export interface WsTokenService {
  createWsToken(input: {
    userId: string;
    eventId: string;
    role: Role;
    nowMs?: number;
    jti?: string;
  }): string;
  verifyWsToken(token: string): WsTokenClaims;
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string): Buffer {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return Buffer.from(`${b64}${pad}`, "base64");
}

function hmacSha256(secret: string, payload: string): string {
  return toBase64Url(crypto.createHmac("sha256", secret).update(payload).digest());
}

function makeJwt<T extends object>(payload: T, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = hmacSha256(secret, unsigned);
  return `${unsigned}.${signature}`;
}

function verifyJwt<T extends object>(token: string, secret: string): T {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const encodedHeader = parts[0];
  const encodedPayload = parts[1];
  const signature = parts[2];

  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error("Invalid token format");
  }
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expected = hmacSha256(secret, unsigned);

  if (signature !== expected) {
    throw new Error("Invalid token signature");
  }

  const payloadJson = fromBase64Url(encodedPayload).toString("utf8");
  return JSON.parse(payloadJson) as T;
}

function assertNotExpired(exp: number, nowEpoch: number): void {
  if (exp <= nowEpoch) {
    throw new Error("Token expired");
  }
}

export function createSessionTokenService(input: { sessionSecret: string; wsSecret: string }): {
  sessions: SessionTokenService;
  ws: WsTokenService;
} {
  const { sessionSecret, wsSecret } = input;

  return {
    sessions: {
      createSessionToken({ userId, email, eventId, role, nowMs }) {
        const nowEpoch = Math.floor((nowMs ?? Date.now()) / 1000);
        const claims: SessionClaims = {
          sub: userId,
          email,
          eventId,
          role,
          iat: nowEpoch,
          exp: nowEpoch + CONTRACT_CONSTANTS.SESSION_TTL_HOURS * 3600,
        };

        return makeJwt(claims, sessionSecret);
      },
      verifySessionToken(token) {
        const claims = verifyJwt<SessionClaims>(token, sessionSecret);
        const nowEpoch = Math.floor(Date.now() / 1000);
        assertNotExpired(claims.exp, nowEpoch);
        return claims;
      },
    },

    ws: {
      createWsToken({ userId, eventId, role, nowMs, jti }) {
        const nowEpoch = Math.floor((nowMs ?? Date.now()) / 1000);
        const claims: WsTokenClaims = {
          sub: userId,
          eventId,
          role,
          aud: "ws-connect",
          iat: nowEpoch,
          exp: nowEpoch + CONTRACT_CONSTANTS.WS_TOKEN_TTL_SECONDS,
          jti,
        };

        return makeJwt(claims, wsSecret);
      },
      verifyWsToken(token) {
        const claims = verifyJwt<WsTokenClaims>(token, wsSecret);
        const nowEpoch = Math.floor(Date.now() / 1000);
        assertNotExpired(claims.exp, nowEpoch);

        if (claims.aud !== "ws-connect") {
          throw new Error("Invalid ws audience");
        }

        return claims;
      },
    },
  };
}
