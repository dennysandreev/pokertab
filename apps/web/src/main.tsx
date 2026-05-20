import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { SessionProvider } from "./session/session-context";

function sendClientBootBeacon(stage: string): void {
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

sendClientBootBeacon("module-start");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SessionProvider>
  </React.StrictMode>
);

sendClientBootBeacon("react-render-called");
