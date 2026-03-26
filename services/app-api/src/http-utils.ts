import type { APIGatewayProxyEventV2 } from "aws-lambda";

export function parseJsonBody<T>(event: APIGatewayProxyEventV2): T {
  if (!event.body) {
    throw new Error("Request body is required");
  }

  return JSON.parse(event.body) as T;
}

export function getIpAddress(event: APIGatewayProxyEventV2): string {
  return event.requestContext.http.sourceIp || "unknown";
}

export function jsonResponse(statusCode: number, body: object) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  };
}
