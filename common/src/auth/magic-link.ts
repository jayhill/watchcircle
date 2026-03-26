import crypto from "node:crypto";

import { CONTRACT_CONSTANTS } from "../index.js";
import { normalizeEmail } from "../db/table-schema.js";

export interface MagicLinkToken {
  token: string;
  email: string;
  eventId: string;
  createdAtEpoch: number;
  ttlEpoch: number;
}

export interface MagicLinkTokenStore {
  putToken(token: MagicLinkToken): Promise<void>;
  getToken(token: string): Promise<MagicLinkToken | null>;
  deleteToken(token: string): Promise<void>;
}

export class MagicLinkVerificationError extends Error {
  code: "INVALID_CODE" | "EXPIRED_CODE";

  constructor(code: "INVALID_CODE" | "EXPIRED_CODE", message: string) {
    super(message);
    this.code = code;
  }
}

export function generateVerificationCode(): string {
  const number = crypto.randomInt(0, 1_000_000);
  return number.toString().padStart(6, "0");
}

export function createMagicLinkService(deps: { tokenStore: MagicLinkTokenStore }) {
  return {
    async issueCode(input: {
      email: string;
      eventId: string;
      nowMs?: number;
    }): Promise<MagicLinkToken> {
      const nowMs = input.nowMs ?? Date.now();
      const createdAtEpoch = Math.floor(nowMs / 1000);
      const ttlEpoch = createdAtEpoch + CONTRACT_CONSTANTS.MAGIC_LINK_TTL_MINUTES * 60;

      const record: MagicLinkToken = {
        token: generateVerificationCode(),
        email: normalizeEmail(input.email),
        eventId: input.eventId,
        createdAtEpoch,
        ttlEpoch,
      };

      await deps.tokenStore.putToken(record);
      return record;
    },

    async verifyCode(input: {
      token: string;
      email: string;
      eventId: string;
      nowMs?: number;
    }): Promise<MagicLinkToken> {
      const nowMs = input.nowMs ?? Date.now();
      const nowEpoch = Math.floor(nowMs / 1000);
      const existing = await deps.tokenStore.getToken(input.token);

      if (!existing) {
        throw new MagicLinkVerificationError("INVALID_CODE", "Invalid verification code.");
      }

      if (existing.ttlEpoch <= nowEpoch) {
        await deps.tokenStore.deleteToken(input.token);
        throw new MagicLinkVerificationError("EXPIRED_CODE", "Verification code expired.");
      }

      if (existing.email !== normalizeEmail(input.email) || existing.eventId !== input.eventId) {
        throw new MagicLinkVerificationError("INVALID_CODE", "Invalid verification code.");
      }

      await deps.tokenStore.deleteToken(input.token);
      return existing;
    },
  };
}
