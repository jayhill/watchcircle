export interface ChatSendInput {
  connectionId?: string;
  text: string;
}

export interface ChatSendStore {
  save(input: { connectionId?: string; text: string; receivedAtEpoch: number }): Promise<void>;
}

export interface ChatSendBroadcaster {
  broadcast(input: { connectionId?: string; text: string; receivedAtEpoch: number }): Promise<void>;
}

export function createChatSendAction(deps: {
  store: ChatSendStore;
  broadcaster: ChatSendBroadcaster;
}) {
  return async (input: ChatSendInput) => {
    const receivedAtEpoch = Math.floor(Date.now() / 1000);

    await deps.store.save({
      connectionId: input.connectionId,
      text: input.text,
      receivedAtEpoch,
    });

    await deps.broadcaster.broadcast({
      connectionId: input.connectionId,
      text: input.text,
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
