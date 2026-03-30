import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

export interface WsStageSecrets {
  sessionJwtSecret: string;
  wsJwtSecret: string;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export async function loadWsSecretsFromSsm(input: {
  stage: string;
  region?: string;
  ssmPrefix?: string;
}): Promise<WsStageSecrets> {
  const region = input.region ?? process.env.AWS_REGION ?? "us-east-2";
  const ssmPrefix = (input.ssmPrefix ?? "/watchcircle").replace(/\/$/, "");

  const client = new SSMClient({ region });
  const sessionName = `${ssmPrefix}/${input.stage}/session-jwt-secret`;
  const wsName = `${ssmPrefix}/${input.stage}/ws-jwt-secret`;

  const [session, ws] = await Promise.all([
    client.send(new GetParameterCommand({ Name: sessionName, WithDecryption: true })),
    client.send(new GetParameterCommand({ Name: wsName, WithDecryption: true })),
  ]);

  const sessionJwtSecret = session.Parameter?.Value;
  const wsJwtSecret = ws.Parameter?.Value;

  if (!sessionJwtSecret || !wsJwtSecret) {
    throw new Error("Missing required ws auth secrets in SSM");
  }

  return {
    sessionJwtSecret,
    wsJwtSecret,
  };
}

export function readWsSecretsFromEnv(): WsStageSecrets {
  return {
    sessionJwtSecret: readRequiredEnv("SESSION_JWT_SECRET"),
    wsJwtSecret: readRequiredEnv("WS_JWT_SECRET"),
  };
}
