import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { I18nProvider } from "./i18n/I18nProvider";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./app/app.css";
import "./app/arcad.css";
import "./app/viewerToolPanels.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <AppErrorBoundary><App /></AppErrorBoundary>
    </I18nProvider>
  </StrictMode>,
);

