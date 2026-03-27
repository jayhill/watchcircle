import crypto from "node:crypto";

import { eventMetaKey, normalizeEmail } from "@watchcircle/common";

import type { EventCreateBody, EventSummary } from "../index.js";

export interface EventHttpResult {
  statusCode: number;
  body: object;
}

interface EventStore {
  putEvent(event: EventSummary): Promise<void>;
  getEvent(eventId: string): Promise<EventSummary | null>;
}

export function createEventHandlers(deps: { store: EventStore }) {
  return {
    async createEvent(input: { body: EventCreateBody }): Promise<EventHttpResult> {
      const nowEpoch = Math.floor(Date.now() / 1000);
      const eventId = `evt_${crypto.randomUUID()}`;

      const event: EventSummary = {
        eventId,
        title: input.body.title.trim(),
        youtubeUrl: input.body.youtubeUrl.trim(),
        creatorEmail: normalizeEmail(input.body.creatorEmail),
        status: "draft",
        chatEnabled: true,
        questionsEnabled: true,
        createdAt: nowEpoch,
      };

      await deps.store.putEvent(event);

      return {
        statusCode: 201,
        body: {
          event,
        },
      };
    },

    async getEvent(input: { eventId: string }): Promise<EventHttpResult> {
      const event = await deps.store.getEvent(input.eventId);

      if (!event) {
        return {
          statusCode: 404,
          body: {
            error: {
              code: "EVENT_NOT_FOUND",
              message: "Event not found",
            },
          },
        };
      }

      return {
        statusCode: 200,
        body: {
          event,
        },
      };
    },
  };
}

type DbOps = {
  putItem<T extends object>(item: T): Promise<void>;
  getByKey<T>(key: { PK: string; SK: string }): Promise<T | null>;
};

interface EventMetaItem {
  PK: string;
  SK: string;
  eventId: string;
  title: string;
  youtubeUrl: string;
  creatorEmail: string;
  status: "draft" | "live" | "ended";
  chatEnabled: boolean;
  questionsEnabled: boolean;
  createdAt: number;
}

export function createDynamoEventStore(deps: { db: DbOps }): EventStore {
  return {
    async putEvent(event) {
      const key = eventMetaKey(event.eventId);
      const item: EventMetaItem = {
        ...key,
        ...event,
      };
      await deps.db.putItem(item);
    },

    async getEvent(eventId) {
      const item = await deps.db.getByKey<EventMetaItem>(eventMetaKey(eventId));
      if (!item) {
        return null;
      }

      return {
        eventId: item.eventId,
        title: item.title,
        youtubeUrl: item.youtubeUrl,
        creatorEmail: item.creatorEmail,
        status: item.status,
        chatEnabled: item.chatEnabled,
        questionsEnabled: item.questionsEnabled,
        createdAt: item.createdAt,
      };
    },
  };
}
