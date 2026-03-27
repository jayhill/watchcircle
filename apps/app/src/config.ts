export interface AppConfig {
  appApiUrl: string;
  appWsUrl: string;
}

export function readAppConfig(): AppConfig {
  return {
    appApiUrl: import.meta.env.VITE_APP_API_URL ?? "",
    appWsUrl: import.meta.env.VITE_APP_WS_URL ?? "",
  };
}
