import type { APIGatewayProxyEventV2 } from "aws-lambda";

import type { EventCreateBody } from "../index.js";
import { createDefaultEventHandlers } from "../dependencies.js";
import { jsonResponse, parseJsonBody } from "../http-utils.js";

const eventHandlers = createDefaultEventHandlers();

export async function createHandler(event: APIGatewayProxyEventV2) {
  const body = parseJsonBody<EventCreateBody>(event);
  const result = await eventHandlers.createEvent({ body });
  return jsonResponse(result.statusCode, result.body);
}

export async function getHandler(event: APIGatewayProxyEventV2) {
  const eventId = event.pathParameters?.eventId;

  if (!eventId) {
    return jsonResponse(400, {
      error: {
        code: "INVALID_EVENT_ID",
        message: "eventId path parameter is required",
      },
    });
  }

  const result = await eventHandlers.getEvent({ eventId });
  return jsonResponse(result.statusCode, result.body);
}
