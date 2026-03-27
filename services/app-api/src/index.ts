export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface AuthRequestBody {
  email: string;
  eventId: string;
}

export interface AuthVerifyBody {
  email: string;
  eventId: string;
  code: string;
  displayName: string;
}

export interface AuthWsTokenBody {
  eventId: string;
}

export interface EventCreateBody {
  title: string;
  youtubeUrl: string;
  creatorEmail: string;
}

export interface EventSummary {
  eventId: string;
  title: string;
  youtubeUrl: string;
  creatorEmail: string;
  status: "draft" | "live" | "ended";
  chatEnabled: boolean;
  questionsEnabled: boolean;
  createdAt: number;
}

export { createAuthHandlers } from "./handlers/auth.js";
export { createDefaultAuthHandlers } from "./dependencies.js";
export { createEventHandlers } from "./handlers/events.js";
export { createDefaultEventHandlers } from "./dependencies.js";
export {
  requestHandler as authRequestHandler,
  verifyHandler as authVerifyHandler,
  wsTokenHandler as authWsTokenHandler,
} from "./handlers/auth-lambda.js";
export {
  createHandler as createEventHandler,
  getHandler as getEventHandler,
} from "./handlers/events-lambda.js";
