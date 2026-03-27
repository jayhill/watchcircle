export interface ChatMessage {
  messageId: string;
  eventId: string;
  text: string;
  senderConnectionId?: string;
  userId: string;
  displayName: string;
  role: "host" | "cohost" | "panelist" | "participant";
  createdAt: number;
}

export interface ChatNewEvent {
  action: "chat:new";
  payload: {
    message: ChatMessage;
  };
}
