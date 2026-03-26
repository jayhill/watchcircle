import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

import type { TableKey } from "./table-schema.js";

export interface DbOptions {
  tableName: string;
}

export function createDbOperations(client: DynamoDBDocumentClient, options: DbOptions) {
  const tableName = options.tableName;

  return {
    async getByKey<T>(key: TableKey): Promise<T | null> {
      const result = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: key,
        })
      );

      return (result.Item as T | undefined) ?? null;
    },

    async putItem<T extends object>(item: T): Promise<void> {
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
        })
      );
    },

    async deleteByKey(key: TableKey): Promise<void> {
      await client.send(
        new DeleteCommand({
          TableName: tableName,
          Key: key,
        })
      );
    },

    async queryItems<T>(input: Omit<QueryCommandInput, "TableName">): Promise<T[]> {
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          ...input,
        })
      );

      return (result.Items as T[] | undefined) ?? [];
    },

    async updateItem(input: {
      key: TableKey;
      updateExpression: string;
      expressionAttributeNames?: Record<string, string>;
      expressionAttributeValues?: Record<string, unknown>;
      conditionExpression?: string;
    }): Promise<void> {
      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: input.key,
          UpdateExpression: input.updateExpression,
          ExpressionAttributeNames: input.expressionAttributeNames,
          ExpressionAttributeValues: input.expressionAttributeValues,
          ConditionExpression: input.conditionExpression,
        })
      );
    },
  };
}
