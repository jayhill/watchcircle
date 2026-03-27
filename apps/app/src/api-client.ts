interface AuthRequestBody {
  email: string;
  eventId: string;
}

interface AuthVerifyBody {
  email: string;
  eventId: string;
  code: string;
  displayName: string;
}

interface AuthWsTokenBody {
  eventId: string;
}

interface EventCreateBody {
  title: string;
  youtubeUrl: string;
  creatorEmail: string;
}

interface EventSummary {
  eventId: string;
  title: string;
  youtubeUrl: string;
  creatorEmail: string;
  status: "draft" | "live" | "ended";
  chatEnabled: boolean;
  questionsEnabled: boolean;
  createdAt: number;
}

export function createApiClient(baseUrl: string) {
  const normalizedBase = baseUrl.replace(/\/$/, "");

  return {
    async createEvent(body: EventCreateBody): Promise<{ event: EventSummary }> {
      const response = await fetch(`${normalizedBase}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      return (await response.json()) as { event: EventSummary };
    },

    async getEvent(eventId: string): Promise<{ event: EventSummary }> {
      const response = await fetch(`${normalizedBase}/events/${eventId}`);
      return (await response.json()) as { event: EventSummary };
    },

    async requestCode(body: AuthRequestBody): Promise<{ ok: boolean }> {
      const response = await fetch(`${normalizedBase}/auth/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      return (await response.json()) as { ok: boolean };
    },

    async verifyCode(body: AuthVerifyBody): Promise<{
      sessionToken: string;
      user: {
        userId: string;
        email: string;
        displayName: string;
        role: "host" | "cohost" | "panelist" | "participant";
      };
    }> {
      const response = await fetch(`${normalizedBase}/auth/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      return (await response.json()) as {
        sessionToken: string;
        user: {
          userId: string;
          email: string;
          displayName: string;
          role: "host" | "cohost" | "panelist" | "participant";
        };
      };
    },

    async issueWsToken(input: {
      sessionToken: string;
      body: AuthWsTokenBody;
    }): Promise<{ wsToken: string; expiresInSeconds: number }> {
      const response = await fetch(`${normalizedBase}/auth/ws-token`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${input.sessionToken}`,
        },
        body: JSON.stringify(input.body),
      });

      return (await response.json()) as { wsToken: string; expiresInSeconds: number };
    },
  };
}
