import {
  createDefaultConnectHandler,
  createDefaultConnectHandlerFromSsm,
  createDefaultDisconnectHandler,
  createDefaultRouteHandler,
  createDefaultRouteHandlerFromSsm,
} from "./dependencies.js";

export type { WsEnvelope } from "./ws-contract.js";
export { CLIENT_ACTIONS } from "./ws-contract.js";

let cachedConnectHandler: ReturnType<typeof createDefaultConnectHandler> | null = null;
let cachedDisconnectHandler: ReturnType<typeof createDefaultDisconnectHandler> | null = null;
let cachedDefaultHandler: ReturnType<typeof createDefaultRouteHandler> | null = null;
let cachedConnectHandlerPromise: Promise<ReturnType<typeof createDefaultConnectHandler>> | null =
  null;
let cachedDefaultHandlerPromise: Promise<ReturnType<typeof createDefaultRouteHandler>> | null =
  null;

function useSsmSecrets(): boolean {
  return (process.env.AUTH_SECRETS_SOURCE ?? "ssm") === "ssm";
}

async function getConnectHandler() {
  if (useSsmSecrets()) {
    if (!cachedConnectHandlerPromise) {
      cachedConnectHandlerPromise = createDefaultConnectHandlerFromSsm();
    }

    return cachedConnectHandlerPromise;
  }

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

async function getDefaultHandler() {
  if (useSsmSecrets()) {
    if (!cachedDefaultHandlerPromise) {
      cachedDefaultHandlerPromise = createDefaultRouteHandlerFromSsm();
    }

    return cachedDefaultHandlerPromise;
  }

  if (!cachedDefaultHandler) {
    cachedDefaultHandler = createDefaultRouteHandler();
  }

  return cachedDefaultHandler;
}

export async function connectHandler(event: unknown) {
  const handler = await getConnectHandler();
  if (!handler) {
    throw new Error("Connect handler not initialized");
  }
  return handler(event as never);
}

export async function disconnectHandler(event: unknown) {
  return getDisconnectHandler()(event as never);
}

export async function defaultHandler(event: unknown) {
  const handler = await getDefaultHandler();
  if (!handler) {
    throw new Error("Default handler not initialized");
  }
  return handler(event as never);
}
