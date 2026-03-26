import { describe, expect, it } from "vitest";

import { createAuthAbuseProtector, floorWindowStartEpoch } from "./rate-limit.js";

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

describe("auth abuse protector", () => {
  it("floors to one hour windows", () => {
    expect(floorWindowStartEpoch(1_711_111_999_000, 3600)).toBe(1_711_108_800);
  });

  it("enforces auth request email/ip limits", async () => {
    const protector = createAuthAbuseProtector({
      counterStore: createCounterStore(),
      verifyLockStore: createVerifyLockStore(),
    });

    const nowMs = 1_711_111_111_000;

    for (let index = 0; index < 5; index += 1) {
      await protector.assertCanRequestCode({ email: "a@example.com", ipAddress: "1.1.1.1", nowMs });
    }

    await expect(
      protector.assertCanRequestCode({ email: "a@example.com", ipAddress: "1.1.1.1", nowMs })
    ).rejects.toThrow(/too many attempts/i);
  });

  it("locks verification after repeated failures", async () => {
    const protector = createAuthAbuseProtector({
      counterStore: createCounterStore(),
      verifyLockStore: createVerifyLockStore(),
    });

    const nowMs = 1_711_111_111_000;

    for (let index = 0; index < 5; index += 1) {
      await protector.registerVerifyFailure({
        eventId: "evt_1",
        email: "user@example.com",
        nowMs,
      });
    }

    await expect(
      protector.assertCanVerifyCode({
        eventId: "evt_1",
        email: "user@example.com",
        ipAddress: "2.2.2.2",
        nowMs,
      })
    ).rejects.toThrow(/temporarily locked/i);
  });

  it("allows verify after lock cleared", async () => {
    const protector = createAuthAbuseProtector({
      counterStore: createCounterStore(),
      verifyLockStore: createVerifyLockStore(),
    });

    const nowMs = 1_711_111_111_000;

    await protector.registerVerifyFailure({ eventId: "evt_1", email: "u@example.com", nowMs });
    await protector.clearVerifyLock({ eventId: "evt_1", email: "u@example.com" });

    await expect(
      protector.assertCanVerifyCode({
        eventId: "evt_1",
        email: "u@example.com",
        ipAddress: "3.3.3.3",
        nowMs,
      })
    ).resolves.toBeUndefined();
  });
});
