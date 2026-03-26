import {
  AuthAbuseError,
  MagicLinkVerificationError,
  createMagicLinkService,
  createSessionTokenService,
} from "@watchcircle/common";

import type { AuthRequestBody, AuthVerifyBody, AuthWsTokenBody } from "../index.js";

interface EventUser {
  userId: string;
  email: string;
  displayName: string;
  role: "host" | "cohost" | "panelist" | "participant";
}

export interface HttpResult {
  statusCode: number;
  body: object;
}

export interface AuthHandlerSet {
  requestCode(input: { body: AuthRequestBody; ipAddress: string }): Promise<HttpResult>;
  verifyCode(input: { body: AuthVerifyBody; ipAddress: string }): Promise<HttpResult>;
  issueWsToken(input: {
    body: AuthWsTokenBody;
    authorizationHeader: string | undefined;
  }): Promise<HttpResult>;
}

interface EmailSender {
  sendVerificationCode(input: { email: string; code: string; eventId: string }): Promise<void>;
}

interface AuthAbuseProtector {
  assertCanRequestCode(input: { email: string; ipAddress: string; nowMs?: number }): Promise<void>;
  assertCanVerifyCode(input: {
    eventId: string;
    email: string;
    ipAddress: string;
    nowMs?: number;
  }): Promise<void>;
  registerVerifyFailure(input: {
    eventId: string;
    email: string;
    nowMs?: number;
  }): Promise<unknown>;
  clearVerifyLock(input: { eventId: string; email: string }): Promise<void>;
}

interface ParticipantStore {
  ensureParticipant(input: {
    eventId: string;
    email: string;
    displayName: string;
  }): Promise<EventUser>;
}

type MagicLinkService = ReturnType<typeof createMagicLinkService>;
type SessionServices = ReturnType<typeof createSessionTokenService>;

export function createAuthHandlers(deps: {
  magicLinks: MagicLinkService;
  abuseProtector: AuthAbuseProtector;
  sessions: SessionServices;
  participantStore: ParticipantStore;
  emailSender: EmailSender;
}): AuthHandlerSet {
  return {
    async requestCode(input: { body: AuthRequestBody; ipAddress: string }): Promise<HttpResult> {
      try {
        await deps.abuseProtector.assertCanRequestCode({
          email: input.body.email,
          ipAddress: input.ipAddress,
        });
      } catch (error) {
        if (error instanceof AuthAbuseError) {
          return {
            statusCode: 429,
            body: {
              error: {
                code: error.code,
                message: "Too many attempts. Please try again later.",
              },
            },
          };
        }

        throw error;
      }

      const issued = await deps.magicLinks.issueCode({
        email: input.body.email,
        eventId: input.body.eventId,
      });

      await deps.emailSender.sendVerificationCode({
        email: issued.email,
        code: issued.token,
        eventId: issued.eventId,
      });

      return {
        statusCode: 200,
        body: { ok: true },
      };
    },

    async verifyCode(input: { body: AuthVerifyBody; ipAddress: string }): Promise<HttpResult> {
      try {
        await deps.abuseProtector.assertCanVerifyCode({
          eventId: input.body.eventId,
          email: input.body.email,
          ipAddress: input.ipAddress,
        });
      } catch (error) {
        if (error instanceof AuthAbuseError) {
          return {
            statusCode: 429,
            body: {
              error: {
                code: error.code,
                message: "Verification is temporarily unavailable.",
              },
            },
          };
        }

        throw error;
      }

      try {
        await deps.magicLinks.verifyCode({
          token: input.body.code,
          email: input.body.email,
          eventId: input.body.eventId,
        });
      } catch (error) {
        if (error instanceof MagicLinkVerificationError) {
          await deps.abuseProtector.registerVerifyFailure({
            eventId: input.body.eventId,
            email: input.body.email,
          });

          return {
            statusCode: 400,
            body: {
              error: {
                code: "INVALID_VERIFICATION",
                message: "Invalid verification code.",
              },
            },
          };
        }

        throw error;
      }

      await deps.abuseProtector.clearVerifyLock({
        eventId: input.body.eventId,
        email: input.body.email,
      });

      const user = await deps.participantStore.ensureParticipant({
        eventId: input.body.eventId,
        email: input.body.email,
        displayName: input.body.displayName,
      });

      const sessionToken = deps.sessions.sessions.createSessionToken({
        userId: user.userId,
        email: user.email,
        eventId: input.body.eventId,
        role: user.role,
      });

      return {
        statusCode: 200,
        body: {
          sessionToken,
          user,
        },
      };
    },

    async issueWsToken(input: {
      body: AuthWsTokenBody;
      authorizationHeader: string | undefined;
    }): Promise<HttpResult> {
      if (!input.authorizationHeader?.startsWith("Bearer ")) {
        return {
          statusCode: 401,
          body: {
            error: {
              code: "UNAUTHORIZED",
              message: "Unauthorized",
            },
          },
        };
      }

      const token = input.authorizationHeader.replace(/^Bearer\s+/, "");

      let claims;

      try {
        claims = deps.sessions.sessions.verifySessionToken(token);
      } catch {
        return {
          statusCode: 401,
          body: {
            error: {
              code: "UNAUTHORIZED",
              message: "Unauthorized",
            },
          },
        };
      }

      if (claims.eventId !== input.body.eventId) {
        return {
          statusCode: 403,
          body: {
            error: {
              code: "EVENT_SCOPE_MISMATCH",
              message: "Session is not scoped to this event.",
            },
          },
        };
      }

      const wsToken = deps.sessions.ws.createWsToken({
        userId: claims.sub,
        eventId: claims.eventId,
        role: claims.role,
      });

      return {
        statusCode: 200,
        body: {
          wsToken,
          expiresInSeconds: 90,
        },
      };
    },
  };
}
