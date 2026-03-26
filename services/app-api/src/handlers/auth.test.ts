import { describe, expect, it } from "vitest";

import {
  createAuthAbuseProtector,
  createMagicLinkService,
  createSessionTokenService,
  type MagicLinkToken,
} from "@watchcircle/common";

import { createAuthHandlers } from "./auth.js";

function createInMemoryTokenStore() {
  const map = new Map<string, MagicLinkToken>();

  return {
    async putToken(token: MagicLinkToken): Promise<void> {
      map.set(token.token, token);
    },
    async getToken(token: string): Promise<MagicLinkToken | null> {
      return map.get(token) ?? null;
    },
    async deleteToken(token: string): Promise<void> {
      map.delete(token);
    },
  };
}

function createCounterStore() {
  const counts = new Map<string, number>();

  return {
    async incrementWindowCounter(input: {
      scope: "AUTH_REQ_EMAIL" | "AUTH_REQ_IP" | "AUTH_VERIFY_IP";
      key: string;
      windowStartEpoch: number;
      ttlEpochSeconds: number;
    }): Promise<number> {
      const counterKey = `${input.scope}#${input.key}#${input.windowStartEpoch}`;
      const next = (counts.get(counterKey) ?? 0) + 1;
      counts.set(counterKey, next);
      return next;
    },
  };
}

function createVerifyLockStore() {
  const locks = new Map<string, { failedAttempts: number; lockedUntilEpoch?: number }>();

  return {
    async getVerifyLock(eventId: string, email: string) {
      return locks.get(`${eventId}#${email}`) ?? null;
    },
    async putVerifyLock(
      eventId: string,
      email: string,
      lock: { failedAttempts: number; lockedUntilEpoch?: number }
    ) {
      locks.set(`${eventId}#${email}`, lock);
    },
    async clearVerifyLock(eventId: string, email: string) {
      locks.delete(`${eventId}#${email}`);
    },
  };
}

describe("auth handlers", () => {
  it("returns generic request success and sends code", async () => {
    const sentCodes: Array<{ email: string; code: string; eventId: string }> = [];

    const handlers = createAuthHandlers({
      magicLinks: createMagicLinkService({ tokenStore: createInMemoryTokenStore() }),
      abuseProtector: createAuthAbuseProtector({
        counterStore: createCounterStore(),
        verifyLockStore: createVerifyLockStore(),
      }),
      sessions: createSessionTokenService({
        sessionSecret: "session-secret",
        wsSecret: "ws-secret",
      }),
      participantStore: {
        async ensureParticipant(input) {
          return {
            userId: "usr_1",
            email: input.email,
            displayName: input.displayName,
            role: "participant" as const,
          };
        },
      },
      emailSender: {
        async sendVerificationCode(input) {
          sentCodes.push(input);
        },
      },
    });

    const result = await handlers.requestCode({
      body: { email: "user@example.com", eventId: "evt_1" },
      ipAddress: "1.2.3.4",
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ ok: true });
    expect(sentCodes).toHaveLength(1);
  });

  it("verifies code and returns session token", async () => {
    const tokenStore = createInMemoryTokenStore();
    const magicLinks = createMagicLinkService({ tokenStore });
    const issued = await magicLinks.issueCode({
      email: "user@example.com",
      eventId: "evt_1",
      nowMs: Date.now(),
    });

    const sessionServices = createSessionTokenService({
      sessionSecret: "session-secret",
      wsSecret: "ws-secret",
    });

    const handlers = createAuthHandlers({
      magicLinks,
      abuseProtector: createAuthAbuseProtector({
        counterStore: createCounterStore(),
        verifyLockStore: createVerifyLockStore(),
      }),
      sessions: sessionServices,
      participantStore: {
        async ensureParticipant(input) {
          return {
            userId: "usr_1",
            email: input.email,
            displayName: input.displayName,
            role: "participant" as const,
          };
        },
      },
      emailSender: {
        async sendVerificationCode() {
          return;
        },
      },
    });

    const result = await handlers.verifyCode({
      body: {
        email: "user@example.com",
        eventId: "evt_1",
        code: issued.token,
        displayName: "Alice",
      },
      ipAddress: "1.2.3.4",
    });

    expect(result.statusCode).toBe(200);
    expect((result.body as { sessionToken: string }).sessionToken).toBeTypeOf("string");
  });

  it("issues ws token from valid session bearer token", async () => {
    const sessionServices = createSessionTokenService({
      sessionSecret: "session-secret",
      wsSecret: "ws-secret",
    });

    const sessionToken = sessionServices.sessions.createSessionToken({
      userId: "usr_1",
      email: "user@example.com",
      eventId: "evt_1",
      role: "participant",
      nowMs: Date.now(),
    });

    const handlers = createAuthHandlers({
      magicLinks: createMagicLinkService({ tokenStore: createInMemoryTokenStore() }),
      abuseProtector: createAuthAbuseProtector({
        counterStore: createCounterStore(),
        verifyLockStore: createVerifyLockStore(),
      }),
      sessions: sessionServices,
      participantStore: {
        async ensureParticipant(input) {
          return {
            userId: "usr_1",
            email: input.email,
            displayName: input.displayName,
            role: "participant" as const,
          };
        },
      },
      emailSender: {
        async sendVerificationCode() {
          return;
        },
      },
    });

    const result = await handlers.issueWsToken({
      body: { eventId: "evt_1" },
      authorizationHeader: `Bearer ${sessionToken}`,
    });

    expect(result.statusCode).toBe(200);
    expect((result.body as { wsToken: string }).wsToken).toBeTypeOf("string");
    expect((result.body as { expiresInSeconds: number }).expiresInSeconds).toBe(90);
  });
});
