export function sendClientBootBeacon(stage: string): void {
  try {
    const webApp = window.Telegram?.WebApp;
    const params = new URLSearchParams({
      stage,
      tg: webApp ? "1" : "0",
      version: webApp?.version ?? "",
      t: String(Date.now())
    });

    new Image().src = `/client-boot.gif?${params.toString()}`;
  } catch {
    // Ignore diagnostic failures.
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        version?: string;
      };
    };
  }
}
