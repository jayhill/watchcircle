export interface TableKey {
  PK: string;
  SK: string;
}

export type RateLimitScope = "AUTH_REQ_EMAIL" | "AUTH_REQ_IP" | "AUTH_VERIFY_IP";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function eventMetaKey(eventId: string): TableKey {
  return { PK: `EVENT#${eventId}`, SK: "META" };
}

export function eventParticipantKey(eventId: string, userId: string): TableKey {
  return { PK: `EVENT#${eventId}`, SK: `USER#${userId}` };
}

export function userProfileKey(email: string): TableKey {
  return { PK: `USER#${normalizeEmail(email)}`, SK: "PROFILE" };
}

export function magicTokenKey(tokenValue: string): TableKey {
  return { PK: `TOKEN#${tokenValue}`, SK: "TOKEN" };
}

export function wsConnectionKey(eventId: string, connectionId: string): TableKey {
  return { PK: `EVENT#${eventId}`, SK: `CONN#${connectionId}` };
}

export function chatMessageKey(
  eventId: string,
  timestamp: number | string,
  messageId: string
): TableKey {
  return { PK: `EVENT#${eventId}`, SK: `CHAT#${timestamp}#${messageId}` };
}

export function questionKey(eventId: string, questionId: string): TableKey {
  return { PK: `EVENT#${eventId}`, SK: `QUESTION#${questionId}` };
}

export function transcriptKey(eventId: string): TableKey {
  return { PK: `EVENT#${eventId}`, SK: "TRANSCRIPT" };
}

export function highlightKey(eventId: string, highlightId: string): TableKey {
  return { PK: `EVENT#${eventId}`, SK: `HIGHLIGHT#${highlightId}` };
}

export function moderationQueueKey(
  eventId: string,
  timestamp: number | string,
  itemId: string
): TableKey {
  return { PK: `EVENT#${eventId}`, SK: `MODQUEUE#${timestamp}#${itemId}` };
}

export function shareLinksKey(eventId: string): TableKey {
  return { PK: `EVENT#${eventId}`, SK: "SHARELINKS" };
}

export function statsSnapshotKey(eventId: string, timestamp: number | string): TableKey {
  return { PK: `EVENT#${eventId}`, SK: `STATS#${timestamp}` };
}

export function rateLimitCounterKey(
  scope: RateLimitScope,
  key: string,
  windowStartEpoch: number
): TableKey {
  return {
    PK: `RL#${scope}#${key}#${windowStartEpoch}`,
    SK: "META",
  };
}

export function verifyLockKey(eventId: string, email: string): TableKey {
  return {
    PK: `LOCK#VERIFY#${eventId}#${normalizeEmail(email)}`,
    SK: "META",
  };
}

export function bootRecordKey(eventId: string, userId: string): TableKey {
  return { PK: `EVENT#${eventId}`, SK: `BOOT#${userId}` };
}

export function shareStatsTokenKey(token: string): TableKey {
  return { PK: `SHARETOKEN#${token}`, SK: "META" };
}
