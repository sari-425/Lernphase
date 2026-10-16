/**
 * Abstraktion über den eigentlichen Web-Push-Versand (RFC 8030/8291/8292).
 * In Tests wird ein Fake verwendet; im Betrieb die Bibliothek "web-push" mit VAPID.
 *
 * WICHTIG: Ein Erfolg (HTTP 201) bedeutet nur, dass der Push-Dienst des Browser-
 * herstellers die Nachricht ANGENOMMEN hat – nicht, dass sie zugestellt oder gelesen wurde.
 */
export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushOptions {
  ttlSeconds: number;
  urgency: "very-low" | "low" | "normal" | "high";
  topic?: string;
}

export interface PushResult {
  statusCode: number;
}

export interface PushSender {
  send(target: PushTarget, payload: string, opts: PushOptions): Promise<PushResult>;
}

export class PushSendError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function createWebPushSender(
  vapid: { publicKey: string; privateKey: string; subject: string },
  /** nur für Tests (lokaler HTTPS-Push-Dienst mit selbstsigniertem Zertifikat) */
  agent?: import("node:https").Agent,
): PushSender {
  return {
    async send(target, payload, opts) {
      const webpush = (await import("web-push")).default;
      try {
        const res = await webpush.sendNotification(target, payload, {
          TTL: opts.ttlSeconds,
          urgency: opts.urgency,
          topic: opts.topic,
          vapidDetails: vapid,
          timeout: 15_000,
          contentEncoding: "aes128gcm",
          ...(agent ? { agent } : {}),
        });
        return { statusCode: res.statusCode };
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode ?? 0;
        throw new PushSendError(code, code ? `Push-Dienst antwortete mit ${code}` : "Push-Dienst nicht erreichbar");
      }
    },
  };
}
