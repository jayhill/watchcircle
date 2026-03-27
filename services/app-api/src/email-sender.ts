import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

export interface VerificationEmailSender {
  sendVerificationCode(input: { email: string; code: string; eventId: string }): Promise<void>;
}

interface SesLike {
  send(command: SendEmailCommand): Promise<unknown>;
}

export function createNoopEmailSender(): VerificationEmailSender {
  return {
    async sendVerificationCode() {
      return;
    },
  };
}

export function createSesEmailSender(input: {
  fromEmail: string;
  region: string;
  productName?: string;
  client?: SesLike;
}): VerificationEmailSender {
  const client = input.client ?? new SESv2Client({ region: input.region });
  const productName = input.productName ?? "WatchCircle";

  return {
    async sendVerificationCode(payload) {
      const subject = `${productName} verification code`;
      const textBody = [
        `Your verification code is: ${payload.code}`,
        "",
        `Event ID: ${payload.eventId}`,
        "",
        "If you did not request this code, you can ignore this email.",
      ].join("\n");

      await client.send(
        new SendEmailCommand({
          FromEmailAddress: input.fromEmail,
          Destination: {
            ToAddresses: [payload.email],
          },
          Content: {
            Simple: {
              Subject: {
                Data: subject,
              },
              Body: {
                Text: {
                  Data: textBody,
                },
              },
            },
          },
        })
      );
    },
  };
}
