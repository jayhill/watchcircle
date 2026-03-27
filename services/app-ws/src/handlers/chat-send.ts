import crypto from "node:crypto";

import { chatMessageKey, type Role } from "@watchcircle/common";

export interface ChatSendInput {
  connectionId?: string;
  eventId: string;
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

export interface SenderIdentityResolver {
  resolve(input: {
    eventId: string;
    connectionId?: string;
  }): Promise<{ userId: string; displayName: string; role: Role } | null>;
}

export function createChatSendAction(deps: {
  store: ChatSendStore;
  broadcaster: ChatSendBroadcaster;
  senderIdentityResolver: SenderIdentityResolver;
}) {
  return async (input: ChatSendInput) => {
    const receivedAtEpoch = Math.floor(Date.now() / 1000);
    const messageId = `msg_${crypto.randomUUID()}`;

    const identity = await deps.senderIdentityResolver.resolve({
      eventId: input.eventId,
      connectionId: input.connectionId,
    });

    if (!identity) {
      throw new Error("SENDER_NOT_FOUND");
    }

    await deps.store.save({
      connectionId: input.connectionId,
      userId: identity.userId,
      displayName: identity.displayName,
      role: identity.role,
      eventId: input.eventId,
      text: input.text,
      messageId,
      receivedAtEpoch,
    });

    await deps.broadcaster.broadcast({
      connectionId: input.connectionId,
      userId: identity.userId,
      displayName: identity.displayName,
      role: identity.role,
      eventId: input.eventId,
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

export function createNoopSenderIdentityResolver(): SenderIdentityResolver {
  return {
    async resolve() {
      return {
        userId: "unknown",
        displayName: "Unknown",
        role: "participant",
      };
    },
  };
}

type DbOps = {
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
  send(connectionId: string, message: object): Promise<ConnectionSendResult>;
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
          const result = await deps.sender.send(connection.connectionId, {
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
          });

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

export function createDynamoSenderIdentityResolver(deps: { db: DbOps }): SenderIdentityResolver {
  return {
    async resolve(input) {
      if (!input.connectionId) {
        return null;
      }

      const connection = await deps.db.queryItems<ConnectionItem>({
        KeyConditionExpression: "PK = :pk AND SK = :sk",
        ExpressionAttributeValues: {
          ":pk": `EVENT#${input.eventId}`,
          ":sk": `CONN#${input.connectionId}`,
        },
      });

      const connectionItem = connection[0];

      if (!connectionItem?.userId) {
        return null;
      }

      const participants = await deps.db.queryItems<ParticipantItem>({
        KeyConditionExpression: "PK = :pk AND SK = :sk",
        ExpressionAttributeValues: {
          ":pk": `EVENT#${input.eventId}`,
          ":sk": `USER#${connectionItem.userId}`,
        },
      });

      const participant = participants[0];

      if (!participant) {
        return null;
      }

      return {
        userId: participant.userId,
        displayName: participant.displayName,
        role: participant.role,
      };
    },
  };
}
