import { Component, type PropsWithChildren } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { useBackNavigation } from "../app/backNavigation";

function RecoveryScreen({ onReset }: { onReset(): void }) {
  const { t } = useI18n();
  useBackNavigation(onReset);
  return (
    <div className="app-shell">
      <main className="center-screen error-screen" role="alert">
        <div className="error-symbol" aria-hidden="true">!</div>
        <p className="eyebrow">Arcad View</p>
        <h1>{t("errorTitle")}</h1>
        <p className="error-copy">{t("renderFailed")}</p>
        <button type="button" className="open-button" onClick={onReset}>{t("retryDrawing")}</button>
      </main>
    </div>
  );
}

/** Keep unexpected React/chunk failures recoverable without exposing file data. */
export class AppErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    return this.state.failed
      ? <RecoveryScreen onReset={() => window.location.reload()} />
      : this.props.children;
  }
}
