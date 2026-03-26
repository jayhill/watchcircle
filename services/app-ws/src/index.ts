import {
  createDefaultConnectHandler,
  createDefaultDisconnectHandler,
  createDefaultRouteHandler,
} from "./dependencies.js";

export type { WsEnvelope } from "./ws-contract.js";
export { CLIENT_ACTIONS } from "./ws-contract.js";

let cachedConnectHandler: ReturnType<typeof createDefaultConnectHandler> | null = null;
let cachedDisconnectHandler: ReturnType<typeof createDefaultDisconnectHandler> | null = null;
let cachedDefaultHandler: ReturnType<typeof createDefaultRouteHandler> | null = null;

function getConnectHandler() {
  if (!cachedConnectHandler) {
    cachedConnectHandler = createDefaultConnectHandler();
  }

  return cachedConnectHandler;
}

function getDisconnectHandler() {
  if (!cachedDisconnectHandler) {
    cachedDisconnectHandler = createDefaultDisconnectHandler();
  }

  return cachedDisconnectHandler;
}

function getDefaultHandler() {
  if (!cachedDefaultHandler) {
    cachedDefaultHandler = createDefaultRouteHandler();
  }

  return cachedDefaultHandler;
}

export async function connectHandler(event: unknown) {
  return getConnectHandler()(event as never);
}

export async function disconnectHandler(event: unknown) {
  return getDisconnectHandler()(event as never);
}

export async function defaultHandler(event: unknown) {
  return getDefaultHandler()(event as never);
}
