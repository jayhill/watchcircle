import { describe, expect, it } from "vitest";

import {
  bootRecordKey,
  chatMessageKey,
  eventMetaKey,
  eventParticipantKey,
  highlightKey,
  magicTokenKey,
  moderationQueueKey,
  normalizeEmail,
  questionKey,
  rateLimitCounterKey,
  shareLinksKey,
  shareStatsTokenKey,
  statsSnapshotKey,
  transcriptKey,
  userProfileKey,
  verifyLockKey,
  wsConnectionKey,
} from "./table-schema.js";

describe("table schema key builders", () => {
  it("normalizes emails", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it("builds event and participant keys", () => {
    expect(eventMetaKey("evt_1")).toEqual({ PK: "EVENT#evt_1", SK: "META" });
    expect(eventParticipantKey("evt_1", "usr_1")).toEqual({
      PK: "EVENT#evt_1",
      SK: "USER#usr_1",
    });
  });

  it("builds user and token keys", () => {
    expect(userProfileKey("USER@Example.com")).toEqual({
      PK: "USER#user@example.com",
      SK: "PROFILE",
    });
    expect(magicTokenKey("123456")).toEqual({ PK: "TOKEN#123456", SK: "TOKEN" });
  });

  it("builds websocket and chat keys", () => {
    expect(wsConnectionKey("evt_1", "conn_1")).toEqual({
      PK: "EVENT#evt_1",
      SK: "CONN#conn_1",
    });
    expect(chatMessageKey("evt_1", 1711111111, "msg_1")).toEqual({
      PK: "EVENT#evt_1",
      SK: "CHAT#1711111111#msg_1",
    });
  });

  it("builds question transcript highlight and moderation keys", () => {
    expect(questionKey("evt_1", "q_1")).toEqual({ PK: "EVENT#evt_1", SK: "QUESTION#q_1" });
    expect(transcriptKey("evt_1")).toEqual({ PK: "EVENT#evt_1", SK: "TRANSCRIPT" });
    expect(highlightKey("evt_1", "h_1")).toEqual({ PK: "EVENT#evt_1", SK: "HIGHLIGHT#h_1" });
    expect(moderationQueueKey("evt_1", 1711111111, "msg_1")).toEqual({
      PK: "EVENT#evt_1",
      SK: "MODQUEUE#1711111111#msg_1",
    });
  });

  it("builds share and stats keys", () => {
    expect(shareLinksKey("evt_1")).toEqual({ PK: "EVENT#evt_1", SK: "SHARELINKS" });
    expect(statsSnapshotKey("evt_1", 1711111111)).toEqual({
      PK: "EVENT#evt_1",
      SK: "STATS#1711111111",
    });
    expect(shareStatsTokenKey("st_1")).toEqual({ PK: "SHARETOKEN#st_1", SK: "META" });
  });

  it("builds security policy keys", () => {
    expect(rateLimitCounterKey("AUTH_REQ_EMAIL", "user@example.com", 1711111200)).toEqual({
      PK: "RL#AUTH_REQ_EMAIL#user@example.com#1711111200",
      SK: "META",
    });
    expect(verifyLockKey("evt_1", "USER@Example.com")).toEqual({
      PK: "LOCK#VERIFY#evt_1#user@example.com",
      SK: "META",
    });
    expect(bootRecordKey("evt_1", "usr_1")).toEqual({ PK: "EVENT#evt_1", SK: "BOOT#usr_1" });
  });
});
