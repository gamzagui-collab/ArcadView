import type { LoadingPhase } from "../types/drawing";
import { useI18n } from "../i18n/I18nProvider";
import { useUx } from "../i18n/ux";
import { ArcadMark, Blueprint } from "./Brand";

type Props = {
  phase: LoadingPhase;
  progress: number | null;
  fileName: string;
  onCancel(): void;
};

export function LoadingScreen({
  phase,
  progress,
  fileName,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const u=useUx();
  const percent = progress === null ? null : Math.round(progress * 100);

  return (
    <main className="center-screen loading-screen" aria-live="polite">
      <Blueprint/><div className="loading-brand"><ArcadMark/><strong>Arcad View</strong><small>GUI&apos;s Arc Industry</small></div>
      <span className="loading-caption">{u.loading}</span>
      <p className="eyebrow">{fileName}</p>
      <h1>{t(phase)}</h1>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={t(phase)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
      >
        <span
          className={percent === null ? "indeterminate" : ""}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>
      {percent !== null && <p className="progress-value">{percent}%</p>}
      {phase === "converting" && <p className="conversion-hint">{u.firstConversion}</p>}
      <button
        type="button"
        className="cancel-button"
        onClick={onCancel}
      >
        {t("cancel")}
      </button>
    </main>
  );
}
