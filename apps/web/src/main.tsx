import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { sendClientBootBeacon } from "./lib/client-boot";
import { SessionProvider } from "./session/session-context";

sendClientBootBeacon("module-start");

window.addEventListener("error", () => {
  sendClientBootBeacon("window-error");
});

window.addEventListener("unhandledrejection", () => {
  sendClientBootBeacon("unhandled-rejection");
});

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
