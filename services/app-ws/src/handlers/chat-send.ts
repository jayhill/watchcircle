import crypto from "node:crypto";

import { chatMessageKey, type ChatNewEvent, type Role } from "@watchcircle/common";

export interface ChatSendInput {
  connectionId?: string;
  eventId?: string;
  text: string;
}

export interface ChatSendStore {
  save(input: {
    connectionId?: string;
    userId: string;
    displayName: string;
    role: Role;
    eventId: string;
    text: string;
    messageId: string;
    receivedAtEpoch: number;
  }): Promise<void>;
}

export interface ChatSendBroadcaster {
  broadcast(input: {
    connectionId?: string;
    userId: string;
    displayName: string;
    role: Role;
    eventId: string;
    text: string;
    messageId: string;
    receivedAtEpoch: number;
  }): Promise<void>;
}

export interface SenderContextResolver {
  resolve(input: {
    eventId?: string;
    connectionId?: string;
  }): Promise<{ eventId: string; userId: string; displayName: string; role: Role } | null>;
}

export function createChatSendAction(deps: {
  store: ChatSendStore;
  broadcaster: ChatSendBroadcaster;
  senderContextResolver: SenderContextResolver;
}) {
  return async (input: ChatSendInput) => {
    const receivedAtEpoch = Math.floor(Date.now() / 1000);
    const messageId = `msg_${crypto.randomUUID()}`;

    const context = await deps.senderContextResolver.resolve({
      eventId: input.eventId,
      connectionId: input.connectionId,
    });

    if (!context) {
      throw new Error("SENDER_NOT_FOUND");
    }

    await deps.store.save({
      connectionId: input.connectionId,
      userId: context.userId,
      displayName: context.displayName,
      role: context.role,
      eventId: context.eventId,
      text: input.text,
      messageId,
      receivedAtEpoch,
    });

    await deps.broadcaster.broadcast({
      connectionId: input.connectionId,
      userId: context.userId,
      displayName: context.displayName,
      role: context.role,
      eventId: context.eventId,
      text: input.text,
      messageId,
      receivedAtEpoch,
    });

    return {
      accepted: true,
      action: "chat:send",
    };
  };
}

export function createNoopChatSendStore(): ChatSendStore {
  return {
    async save() {
      return;
    },
  };
}

export function createNoopChatSendBroadcaster(): ChatSendBroadcaster {
  return {
    async broadcast() {
      return;
    },
  };
}

export function createNoopSenderContextResolver(): SenderContextResolver {
  return {
    async resolve(input) {
      return {
        eventId: input.eventId ?? "unknown",
        userId: "unknown",
        displayName: "Unknown",
        role: "participant",
      };
    },
  };
}

type DbOps = {
  getByKey<T>(key: { PK: string; SK: string }): Promise<T | null>;
  putItem<T extends object>(item: T): Promise<void>;
  queryItems<T>(input: {
    KeyConditionExpression: string;
    ExpressionAttributeValues: Record<string, unknown>;
  }): Promise<T[]>;
};

interface ConnectionItem {
  PK: string;
  SK: string;
  connectionId: string;
  userId?: string;
  role?: Role;
}

interface ConnectionPointerItem {
  PK: string;
  SK: string;
  eventId: string;
}

interface ParticipantItem {
  PK: string;
  SK: string;
  userId: string;
  displayName: string;
  role: Role;
}

export function createDynamoChatSendStore(deps: { db: DbOps }): ChatSendStore {
  return {
    async save(input) {
      const key = chatMessageKey(input.eventId, input.receivedAtEpoch, input.messageId);
      await deps.db.putItem({
        ...key,
        messageId: input.messageId,
        eventId: input.eventId,
        senderConnectionId: input.connectionId,
        userId: input.userId,
        displayName: input.displayName,
        role: input.role,
        text: input.text,
        type: "message",
        createdAt: input.receivedAtEpoch,
      });
    },
  };
}

type ConnectionSendResult = "sent" | "gone";

interface ConnectionSender {
  send(connectionId: string, message: ChatNewEvent): Promise<ConnectionSendResult>;
}

interface ConnectionCleanupStore {
  removeConnection(input: { eventId: string; connectionId: string }): Promise<void>;
}

export function createEventChatBroadcaster(deps: {
  db: DbOps;
  sender: ConnectionSender;
  connectionCleanupStore?: ConnectionCleanupStore;
}): ChatSendBroadcaster {
  return {
    async broadcast(input) {
      const connections = await deps.db.queryItems<ConnectionItem>({
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `EVENT#${input.eventId}`,
          ":prefix": "CONN#",
        },
      });

      await Promise.all(
        connections.map(async (connection) => {
          const message: ChatNewEvent = {
            action: "chat:new",
            payload: {
              message: {
                messageId: input.messageId,
                eventId: input.eventId,
                text: input.text,
                senderConnectionId: input.connectionId,
                userId: input.userId,
                displayName: input.displayName,
                role: input.role,
                createdAt: input.receivedAtEpoch,
              },
            },
          };

          const result = await deps.sender.send(connection.connectionId, message);

          if (result === "gone" && deps.connectionCleanupStore) {
            await deps.connectionCleanupStore.removeConnection({
              eventId: input.eventId,
              connectionId: connection.connectionId,
            });
          }
        })
      );
    },
  };
}

function connectionPointerKey(connectionId: string) {
  return {
    PK: `CONNECTION#${connectionId}`,
    SK: "META",
  };
}

export function createDynamoSenderContextResolver(deps: { db: DbOps }): SenderContextResolver {
  return {
    async resolve(input) {
      if (!input.connectionId) {
        return null;
      }

      const resolvedEventId =
        input.eventId ??
        (await deps.db.getByKey<ConnectionPointerItem>(connectionPointerKey(input.connectionId)))
          ?.eventId;

      if (!resolvedEventId) {
        return null;
      }

      const connectionItem = await deps.db.getByKey<ConnectionItem>({
        PK: `EVENT#${resolvedEventId}`,
        SK: `CONN#${input.connectionId}`,
      });

      if (!connectionItem?.userId) {
        return null;
      }

      const participant = await deps.db.getByKey<ParticipantItem>({
        PK: `EVENT#${resolvedEventId}`,
        SK: `USER#${connectionItem.userId}`,
      });

      if (!participant) {
        return null;
      }

      return {
        eventId: resolvedEventId,
        userId: participant.userId,
        displayName: participant.displayName,
        role: participant.role,
      };
    },
  };
}
