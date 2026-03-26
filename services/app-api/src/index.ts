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

export { createAuthHandlers } from "./handlers/auth.js";
export { createDefaultAuthHandlers } from "./dependencies.js";
