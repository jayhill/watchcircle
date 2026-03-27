import crypto from "node:crypto";

import { chatMessageKey } from "@watchcircle/common";

export interface ChatSendInput {
  connectionId?: string;
  eventId: string;
  text: string;
}

export interface ChatSendStore {
  save(input: {
    connectionId?: string;
    eventId: string;
    text: string;
    messageId: string;
    receivedAtEpoch: number;
  }): Promise<void>;
}

export interface ChatSendBroadcaster {
  broadcast(input: {
    connectionId?: string;
    eventId: string;
    text: string;
    messageId: string;
    receivedAtEpoch: number;
  }): Promise<void>;
}

export function createChatSendAction(deps: {
  store: ChatSendStore;
  broadcaster: ChatSendBroadcaster;
}) {
  return async (input: ChatSendInput) => {
    const receivedAtEpoch = Math.floor(Date.now() / 1000);
    const messageId = `msg_${crypto.randomUUID()}`;

    await deps.store.save({
      connectionId: input.connectionId,
      eventId: input.eventId,
      text: input.text,
      messageId,
      receivedAtEpoch,
    });

    await deps.broadcaster.broadcast({
      connectionId: input.connectionId,
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
        text: input.text,
        type: "message",
        createdAt: input.receivedAtEpoch,
      });
    },
  };
}

interface ConnectionSender {
  send(connectionId: string, message: object): Promise<void>;
}

export function createEventChatBroadcaster(deps: {
  db: DbOps;
  sender: ConnectionSender;
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
        connections.map((connection) =>
          deps.sender.send(connection.connectionId, {
            action: "chat:new",
            payload: {
              message: {
                messageId: input.messageId,
                eventId: input.eventId,
                text: input.text,
                senderConnectionId: input.connectionId,
                createdAt: input.receivedAtEpoch,
              },
            },
          })
        )
      );
    },
  };
}
