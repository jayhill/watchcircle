import crypto from "node:crypto";

import {
  eventMetaKey,
  eventParticipantKey,
  magicTokenKey,
  normalizeEmail,
  rateLimitCounterKey,
  userProfileKey,
  verifyLockKey,
  type MagicLinkToken,
  type VerifyLockRecord,
} from "@watchcircle/common";

type DbOps = {
  getByKey<T>(key: { PK: string; SK: string }): Promise<T | null>;
  putItem<T extends object>(item: T): Promise<void>;
  deleteByKey(key: { PK: string; SK: string }): Promise<void>;
};

interface UserProfileItem {
  PK: string;
  SK: string;
  userId: string;
  email: string;
  createdAt: number;
  lastSeenAt: number;
}

interface ParticipantItem {
  PK: string;
  SK: string;
  userId: string;
  email: string;
  displayName: string;
  role: "host" | "cohost" | "panelist" | "participant";
  joinedAt: number;
}

interface EventMetaItem {
  PK: string;
  SK: string;
  creatorEmail?: string;
}

interface RateLimitItem {
  PK: string;
  SK: string;
  count: number;
  ttl: number;
}

interface VerifyLockItem {
  PK: string;
  SK: string;
  failedAttempts: number;
  lockedUntilEpoch?: number;
  ttl: number;
}

interface MagicTokenItem {
  PK: string;
  SK: string;
  token: string;
  email: string;
  eventId: string;
  createdAtEpoch: number;
  ttlEpoch: number;
  ttl: number;
}

export function createAuthStores(deps: { db: DbOps }) {
  const { db } = deps;

  return {
    tokenStore: {
      async putToken(token: MagicLinkToken): Promise<void> {
        const key = magicTokenKey(token.token);
        const item: MagicTokenItem = {
          ...key,
          token: token.token,
          email: token.email,
          eventId: token.eventId,
          createdAtEpoch: token.createdAtEpoch,
          ttlEpoch: token.ttlEpoch,
          ttl: token.ttlEpoch,
        };
        await db.putItem(item);
      },

      async getToken(token: string): Promise<MagicLinkToken | null> {
        const key = magicTokenKey(token);
        const item = await db.getByKey<MagicTokenItem>(key);
        if (!item) {
          return null;
        }

        return {
          token: item.token,
          email: item.email,
          eventId: item.eventId,
          createdAtEpoch: item.createdAtEpoch,
          ttlEpoch: item.ttlEpoch,
        };
      },

      async deleteToken(token: string): Promise<void> {
        await db.deleteByKey(magicTokenKey(token));
      },
    },

    counterStore: {
      async incrementWindowCounter(input: {
        scope: "AUTH_REQ_EMAIL" | "AUTH_REQ_IP" | "AUTH_VERIFY_IP";
        key: string;
        windowStartEpoch: number;
        ttlEpochSeconds: number;
      }): Promise<number> {
        const key = rateLimitCounterKey(input.scope, input.key, input.windowStartEpoch);
        const existing = await db.getByKey<RateLimitItem>(key);
        const nextCount = (existing?.count ?? 0) + 1;
        const item: RateLimitItem = {
          ...key,
          count: nextCount,
          ttl: input.ttlEpochSeconds,
        };
        await db.putItem(item);
        return nextCount;
      },
    },

    verifyLockStore: {
      async getVerifyLock(eventId: string, email: string): Promise<VerifyLockRecord | null> {
        const key = verifyLockKey(eventId, email);
        const item = await db.getByKey<VerifyLockItem>(key);

        if (!item) {
          return null;
        }

        return {
          failedAttempts: item.failedAttempts,
          lockedUntilEpoch: item.lockedUntilEpoch,
        };
      },

      async putVerifyLock(eventId: string, email: string, lock: VerifyLockRecord): Promise<void> {
        const key = verifyLockKey(eventId, email);
        const nowEpoch = Math.floor(Date.now() / 1000);
        const ttl = lock.lockedUntilEpoch
          ? lock.lockedUntilEpoch + 24 * 3600
          : nowEpoch + 24 * 3600;
        const item: VerifyLockItem = {
          ...key,
          failedAttempts: lock.failedAttempts,
          lockedUntilEpoch: lock.lockedUntilEpoch,
          ttl,
        };

        await db.putItem(item);
      },

      async clearVerifyLock(eventId: string, email: string): Promise<void> {
        await db.deleteByKey(verifyLockKey(eventId, email));
      },
    },

    participantStore: {
      async ensureParticipant(input: {
        eventId: string;
        email: string;
        displayName: string;
      }): Promise<{
        userId: string;
        email: string;
        displayName: string;
        role: "host" | "cohost" | "panelist" | "participant";
      }> {
        const email = normalizeEmail(input.email);
        const nowEpoch = Math.floor(Date.now() / 1000);

        const profileKey = userProfileKey(email);
        const profile = await db.getByKey<UserProfileItem>(profileKey);
        const userId = profile?.userId ?? `usr_${crypto.randomUUID()}`;

        const nextProfile: UserProfileItem = {
          ...profileKey,
          userId,
          email,
          createdAt: profile?.createdAt ?? nowEpoch,
          lastSeenAt: nowEpoch,
        };

        await db.putItem(nextProfile);

        const participantKey = eventParticipantKey(input.eventId, userId);
        const participant = await db.getByKey<ParticipantItem>(participantKey);
        const eventMeta = await db.getByKey<EventMetaItem>(eventMetaKey(input.eventId));
        const role =
          participant?.role ??
          (eventMeta?.creatorEmail && normalizeEmail(eventMeta.creatorEmail) === email
            ? "host"
            : "participant");

        const nextParticipant: ParticipantItem = {
          ...participantKey,
          userId,
          email,
          displayName: participant?.displayName ?? input.displayName,
          role,
          joinedAt: participant?.joinedAt ?? nowEpoch,
        };

        await db.putItem(nextParticipant);

        return {
          userId,
          email,
          displayName: nextParticipant.displayName,
          role: nextParticipant.role,
        };
      },
    },
  };
}
