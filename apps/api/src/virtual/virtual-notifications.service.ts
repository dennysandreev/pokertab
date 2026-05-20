import { Injectable } from "@nestjs/common";
import { ActionType } from "@prisma/client";
import { appendWebAppCacheBuster } from "../shared/web-app-url";

type NotificationPayload = {
  telegramId: string | null;
  tableTitle: string;
  tableId: string;
};

type TimeoutNotificationPayload = NotificationPayload & {
  actionType: Extract<ActionType, "AUTO_CHECK" | "AUTO_FOLD">;
};

export type VirtualNotificationDeliveryResult =
  | {
      sent: true;
    }
  | {
      sent: false;
      reason: "disabled" | "missing_telegram_id";
    };

type TelegramSendMessageResponse = {
  ok: boolean;
  description?: string;
};

@Injectable()
export class VirtualNotificationsService {
  async sendReminderNotification(
    payload: NotificationPayload
  ): Promise<VirtualNotificationDeliveryResult> {
    return this.sendMessage(payload, `Пора сделать ход за столом «${payload.tableTitle}».`);
  }

  async sendTimeoutNotification(
    payload: TimeoutNotificationPayload
  ): Promise<VirtualNotificationDeliveryResult> {
    const actionLabel =
      payload.actionType === ActionType.AUTO_CHECK ? "Авточек" : "Автофолд";

    return this.sendMessage(
      payload,
      `Время вышло за столом «${payload.tableTitle}». ${actionLabel}.`
    );
  }

  private async sendMessage(
    payload: NotificationPayload,
    text: string
  ): Promise<VirtualNotificationDeliveryResult> {
    if (!this.isEnabled()) {
      return {
        sent: false,
        reason: "disabled"
      };
    }

    if (!payload.telegramId) {
      return {
        sent: false,
        reason: "missing_telegram_id"
      };
    }

    const response = await fetch(this.getApiUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: payload.telegramId,
        text,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Открыть стол",
                // Dedicated virtual-table route does not exist in the web app yet,
                // but keeping a stable target here avoids revisiting message history later.
                web_app: {
                  url: buildVirtualTableUrl(payload.tableId)
                }
              }
            ]
          ]
        }
      })
    });

    if (!response.ok) {
      const description = await response.text();

      throw new Error(`Telegram sendMessage failed: ${description || response.statusText}`);
    }

    const body = (await response.json()) as TelegramSendMessageResponse;

    if (!body.ok) {
      throw new Error(
        `Telegram sendMessage rejected: ${body.description ?? "unknown error"}`
      );
    }

    return {
      sent: true
    };
  }

  private isEnabled(): boolean {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const isExplicitlyDisabled =
      process.env.VIRTUAL_TELEGRAM_NOTIFICATIONS_ENABLED?.trim().toLowerCase() ===
      "false";

    return Boolean(token) && !isExplicitlyDisabled;
  }

  private getApiUrl(): string {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    return `https://api.telegram.org/bot${token}/sendMessage`;
  }
}

function buildVirtualTableUrl(tableId: string): string {
  const webAppUrl = process.env.WEB_APP_URL?.trim() ?? "http://localhost:5173";
  const normalizedWebAppUrl = webAppUrl.endsWith("/")
    ? webAppUrl.slice(0, -1)
    : webAppUrl;

  return appendWebAppCacheBuster(`${normalizedWebAppUrl}/virtual/tables/${tableId}`);
}
