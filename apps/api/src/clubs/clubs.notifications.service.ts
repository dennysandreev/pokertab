import { Injectable } from "@nestjs/common";
import { appendWebAppCacheBuster } from "../shared/web-app-url";
import type { ClubEventRsvpStatus } from "@pokertable/shared";

type ClubNotificationEvent = {
  id: string;
  clubId: string;
  clubName: string;
  type: "OFFLINE_POKER" | "ONLINE_TABLE";
  title: string;
  scheduledStartAt: Date;
  location: string | null;
  maxPlayers: number | null;
  offlineRoomId: string | null;
  virtualTableId: string | null;
  startingStackChips?: string | null;
  smallBlindChips?: string | null;
  bigBlindChips?: string | null;
};

type ClubNotificationRecipient = {
  telegramId: string | null;
  currentStatus?: ClubEventRsvpStatus | null;
};

export type ClubNotificationDeliveryResult =
  | {
      sent: true;
    }
  | {
      sent: false;
      reason: "disabled" | "missing_telegram_id" | "failed";
    };

type TelegramSendMessageResponse = {
  ok: boolean;
  description?: string;
};

@Injectable()
export class ClubsNotificationsService {
  async sendInviteNotification(
    event: ClubNotificationEvent,
    recipient: ClubNotificationRecipient
  ): Promise<ClubNotificationDeliveryResult> {
    const lines =
      event.type === "OFFLINE_POKER"
        ? [
            `🃏 Новая игра в клубе ${quoteClubName(event.clubName)}`,
            "",
            event.title,
            formatScheduledLine(event.scheduledStartAt),
            ...(event.location ? [`Место: ${event.location}`] : []),
            "",
            "Вы придете?"
          ]
        : [
            `♠️ Запланирован онлайн-стол в клубе ${quoteClubName(event.clubName)}`,
            "",
            event.title,
            `Старт: ${formatDateTime(event.scheduledStartAt)}`,
            ...(event.startingStackChips ? [`Стек: ${event.startingStackChips}`] : []),
            event.smallBlindChips && event.bigBlindChips
              ? `Блайнды: ${event.smallBlindChips} / ${event.bigBlindChips}`
              : null,
            "",
            "Будете играть?"
          ].filter((line): line is string => Boolean(line));

    return this.sendMessage(recipient.telegramId, lines.join("\n"), {
      inline_keyboard: [...buildRsvpKeyboard(event), [buildOpenButton(event)]]
    });
  }

  async sendReminderNotification(
    event: ClubNotificationEvent,
    recipient: ClubNotificationRecipient
  ): Promise<ClubNotificationDeliveryResult> {
    const lines =
      event.type === "OFFLINE_POKER"
        ? [
            "⏰ Напоминание",
            "",
            `Сегодня в ${formatTime(event.scheduledStartAt)} игра ${event.title}.`,
            formatCurrentStatus(recipient.currentStatus)
          ]
        : [
            "⏰ Онлайн-стол скоро начнется",
            "",
            `${event.title} стартует в ${formatDateTime(event.scheduledStartAt)}.`,
            formatCurrentStatus(recipient.currentStatus)
          ];

    return this.sendMessage(recipient.telegramId, lines.join("\n"), {
      inline_keyboard: [[buildOpenButton(event)]]
    });
  }

  private async sendMessage(
    telegramId: string | null,
    text: string,
    replyMarkup: {
      inline_keyboard: Array<Array<Record<string, unknown>>>;
    }
  ): Promise<ClubNotificationDeliveryResult> {
    if (!this.isEnabled()) {
      return {
        sent: false,
        reason: "disabled"
      };
    }

    if (!telegramId) {
      return {
        sent: false,
        reason: "missing_telegram_id"
      };
    }

    try {
      const response = await fetch(this.getApiUrl(), {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          chat_id: telegramId,
          text,
          reply_markup: replyMarkup
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const body = (await response.json()) as TelegramSendMessageResponse;

      if (!body.ok) {
        throw new Error(body.description ?? "unknown error");
      }

      return {
        sent: true
      };
    } catch {
      return {
        sent: false,
        reason: "failed"
      };
    }
  }

  private isEnabled(): boolean {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  }

  private getApiUrl(): string {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    return `https://api.telegram.org/bot${token}/sendMessage`;
  }
}

function buildRsvpKeyboard(event: ClubNotificationEvent): Array<Array<Record<string, unknown>>> {
  const goingLabel = event.type === "ONLINE_TABLE" ? "✅ Играю" : "✅ Приду";
  const declineLabel = "❌ Не смогу";
  const rows: Array<Array<Record<string, unknown>>> = [
    [
      {
        text: goingLabel,
        callback_data: buildCallbackData(event.id, "GOING")
      }
    ]
  ];

  if (event.type === "OFFLINE_POKER") {
    rows[0]?.push({
      text: "❓ Возможно",
      callback_data: buildCallbackData(event.id, "MAYBE")
    });
  }

  rows.push([
    {
      text: declineLabel,
      callback_data: buildCallbackData(event.id, "DECLINED")
    }
  ]);

  return rows;
}

function buildOpenButton(event: ClubNotificationEvent): Record<string, unknown> {
  const label = event.type === "ONLINE_TABLE" ? "Открыть стол" : "Открыть мероприятие";

  return {
    text: label,
    web_app: {
      url: buildOpenUrl(event)
    }
  };
}

function buildCallbackData(eventId: string, status: ClubEventRsvpStatus): string {
  return `club_event_rsvp:${eventId}:${status}`;
}

function buildOpenUrl(event: ClubNotificationEvent): string {
  const webAppUrl = process.env.WEB_APP_URL?.trim() ?? "http://localhost:5173";
  const normalizedWebAppUrl = webAppUrl.endsWith("/")
    ? webAppUrl.slice(0, -1)
    : webAppUrl;
  const path =
    event.type === "ONLINE_TABLE" && event.virtualTableId
      ? `/poker/tables/${event.virtualTableId}`
      : event.type === "OFFLINE_POKER" && event.offlineRoomId
        ? `/rooms/${event.offlineRoomId}`
        : `/clubs/${event.clubId}/events/${event.id}`;

  return appendWebAppCacheBuster(`${normalizedWebAppUrl}${path}`);
}

function quoteClubName(name: string): string {
  return `«${name}»`;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatScheduledLine(date: Date): string {
  return formatDateTime(date);
}

function formatCurrentStatus(status: ClubEventRsvpStatus | null | undefined): string {
  switch (status) {
    case "GOING":
      return "Ваш ответ: Приду.";
    case "MAYBE":
      return "Ваш ответ: Возможно.";
    case "DECLINED":
      return "Ваш ответ: Не смогу.";
    case "WAITLIST":
      return "Сейчас вы в листе ожидания.";
    default:
      return "Ответ пока не выбран.";
  }
}
