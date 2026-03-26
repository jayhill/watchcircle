import { DynamoDBClient, type DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export interface CreateDbClientOptions {
  region: string;
  endpoint?: string;
}

export function createDynamoClient(options: CreateDbClientOptions): DynamoDBClient {
  const config: DynamoDBClientConfig = {
    region: options.region,
  };

  if (options.endpoint) {
    config.endpoint = options.endpoint;
  }

  return new DynamoDBClient(config);
}

export function createDocumentClient(client: DynamoDBClient): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });
}
