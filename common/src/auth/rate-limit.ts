import { CONTRACT_CONSTANTS } from "../index.js";
import { normalizeEmail } from "../db/table-schema.js";

export class AuthAbuseError extends Error {
  code: "RATE_LIMITED" | "VERIFY_LOCKED";

  constructor(code: "RATE_LIMITED" | "VERIFY_LOCKED", message: string) {
    super(message);
    this.code = code;
  }
}

export interface RateLimitCounterStore {
  incrementWindowCounter(input: {
    scope: "AUTH_REQ_EMAIL" | "AUTH_REQ_IP" | "AUTH_VERIFY_IP";
    key: string;
    windowStartEpoch: number;
    ttlEpochSeconds: number;
  }): Promise<number>;
}

export interface VerifyLockRecord {
  failedAttempts: number;
  lockedUntilEpoch?: number;
}

export interface VerifyLockStore {
  getVerifyLock(eventId: string, email: string): Promise<VerifyLockRecord | null>;
  putVerifyLock(eventId: string, email: string, lock: VerifyLockRecord): Promise<void>;
  clearVerifyLock(eventId: string, email: string): Promise<void>;
}

interface AuthAbuseConfig {
  requestPerEmailPerHour: number;
  requestPerIpPerHour: number;
  verifyPerIpPerHour: number;
  verifyFailuresBeforeLock: number;
  verifyLockMinutes: number;
}

export function floorWindowStartEpoch(nowMs: number, windowSeconds: number): number {
  const epochSeconds = Math.floor(nowMs / 1000);
  return epochSeconds - (epochSeconds % windowSeconds);
}

function defaultConfig(): AuthAbuseConfig {
  return {
    requestPerEmailPerHour: CONTRACT_CONSTANTS.AUTH_REQUEST_LIMIT_PER_EMAIL_PER_HOUR,
    requestPerIpPerHour: CONTRACT_CONSTANTS.AUTH_REQUEST_LIMIT_PER_IP_PER_HOUR,
    verifyPerIpPerHour: CONTRACT_CONSTANTS.AUTH_VERIFY_LIMIT_PER_IP_PER_HOUR,
    verifyFailuresBeforeLock: CONTRACT_CONSTANTS.AUTH_VERIFY_MAX_FAILED_ATTEMPTS_PER_EMAIL_EVENT,
    verifyLockMinutes: CONTRACT_CONSTANTS.AUTH_VERIFY_LOCK_MINUTES,
  };
}

export function createAuthAbuseProtector(
  deps: {
    counterStore: RateLimitCounterStore;
    verifyLockStore: VerifyLockStore;
  },
  config: Partial<AuthAbuseConfig> = {}
) {
  const cfg: AuthAbuseConfig = { ...defaultConfig(), ...config };
  const oneHourSeconds = 3600;

  async function consumeRateLimit(input: {
    scope: "AUTH_REQ_EMAIL" | "AUTH_REQ_IP" | "AUTH_VERIFY_IP";
    key: string;
    limit: number;
    nowMs: number;
  }): Promise<void> {
    const windowStartEpoch = floorWindowStartEpoch(input.nowMs, oneHourSeconds);
    const ttlEpochSeconds = windowStartEpoch + oneHourSeconds * 2;
    const count = await deps.counterStore.incrementWindowCounter({
      scope: input.scope,
      key: input.key,
      windowStartEpoch,
      ttlEpochSeconds,
    });

    if (count > input.limit) {
      throw new AuthAbuseError("RATE_LIMITED", "Too many attempts. Please try again later.");
    }
  }

  return {
    async assertCanRequestCode(input: {
      email: string;
      ipAddress: string;
      nowMs?: number;
    }): Promise<void> {
      const nowMs = input.nowMs ?? Date.now();
      const email = normalizeEmail(input.email);

      await consumeRateLimit({
        scope: "AUTH_REQ_EMAIL",
        key: email,
        limit: cfg.requestPerEmailPerHour,
        nowMs,
      });

      await consumeRateLimit({
        scope: "AUTH_REQ_IP",
        key: input.ipAddress,
        limit: cfg.requestPerIpPerHour,
        nowMs,
      });
    },

    async assertCanVerifyCode(input: {
      eventId: string;
      email: string;
      ipAddress: string;
      nowMs?: number;
    }): Promise<void> {
      const nowMs = input.nowMs ?? Date.now();
      const email = normalizeEmail(input.email);

      await consumeRateLimit({
        scope: "AUTH_VERIFY_IP",
        key: input.ipAddress,
        limit: cfg.verifyPerIpPerHour,
        nowMs,
      });

      const lock = await deps.verifyLockStore.getVerifyLock(input.eventId, email);
      const nowEpoch = Math.floor(nowMs / 1000);

      if (lock?.lockedUntilEpoch && lock.lockedUntilEpoch > nowEpoch) {
        throw new AuthAbuseError("VERIFY_LOCKED", "Verification is temporarily locked.");
      }
    },

    async registerVerifyFailure(input: {
      eventId: string;
      email: string;
      nowMs?: number;
    }): Promise<VerifyLockRecord> {
      const nowMs = input.nowMs ?? Date.now();
      const nowEpoch = Math.floor(nowMs / 1000);
      const email = normalizeEmail(input.email);
      const existing = await deps.verifyLockStore.getVerifyLock(input.eventId, email);
      const failedAttempts = (existing?.failedAttempts ?? 0) + 1;

      const next: VerifyLockRecord = {
        failedAttempts,
      };

      if (failedAttempts >= cfg.verifyFailuresBeforeLock) {
        next.lockedUntilEpoch = nowEpoch + cfg.verifyLockMinutes * 60;
      }

      await deps.verifyLockStore.putVerifyLock(input.eventId, email, next);
      return next;
    },

    async clearVerifyLock(input: { eventId: string; email: string }): Promise<void> {
      await deps.verifyLockStore.clearVerifyLock(input.eventId, normalizeEmail(input.email));
    },
  };
}
