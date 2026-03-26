import type { APIGatewayProxyEventV2 } from "aws-lambda";

import type { AuthRequestBody, AuthVerifyBody, AuthWsTokenBody } from "../index.js";
import type { AuthHandlerSet } from "./auth.js";
import { createDefaultAuthHandlers, createDefaultAuthHandlersFromSsm } from "../dependencies.js";
import { getIpAddress, jsonResponse, parseJsonBody } from "../http-utils.js";

let authHandlersPromise: Promise<AuthHandlerSet> | null = null;

async function getAuthHandlers(): Promise<AuthHandlerSet> {
  if (!authHandlersPromise) {
    authHandlersPromise =
      process.env.AUTH_SECRETS_SOURCE === "ssm"
        ? createDefaultAuthHandlersFromSsm()
        : Promise.resolve(createDefaultAuthHandlers());
  }

  return authHandlersPromise;
}

export async function requestHandler(event: APIGatewayProxyEventV2) {
  const authHandlers = await getAuthHandlers();
  const body = parseJsonBody<AuthRequestBody>(event);
  const result = await authHandlers.requestCode({
    body,
    ipAddress: getIpAddress(event),
  });

  return jsonResponse(result.statusCode, result.body);
}

export async function verifyHandler(event: APIGatewayProxyEventV2) {
  const authHandlers = await getAuthHandlers();
  const body = parseJsonBody<AuthVerifyBody>(event);
  const result = await authHandlers.verifyCode({
    body,
    ipAddress: getIpAddress(event),
  });

  return jsonResponse(result.statusCode, result.body);
}

export async function wsTokenHandler(event: APIGatewayProxyEventV2) {
  const authHandlers = await getAuthHandlers();
  const body = parseJsonBody<AuthWsTokenBody>(event);
  const result = await authHandlers.issueWsToken({
    body,
    authorizationHeader: event.headers.authorization,
  });

  return jsonResponse(result.statusCode, result.body);
}
