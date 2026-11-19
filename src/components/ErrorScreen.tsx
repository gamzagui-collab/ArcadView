import {
  AppError,
  type AppErrorCode,
} from "../types/drawing";
import { useI18n } from "../i18n/I18nProvider";
import { FolderIcon } from "./Icons";

type Props = {
  error: AppError;
  onOpenLibrary(): void;
  onRetry?(): void;
  onClose?(): void;
};

const errorTranslation = {
  UNSUPPORTED_FORMAT: "unsupportedFormat",
  FILE_READ_FAILED: "fileReadFailed",
  EMPTY_FILE: "emptyFile",
  FILE_TOO_LARGE: "fileTooLarge",
  DXF_OPEN_FAILED: "dxfOpenFailed",
  PDF_OPEN_FAILED: "pdfOpenFailed",
  PDF_PASSWORD_REQUIRED: "pdfPasswordUnsupported",
  ARCHIVE_OPEN_FAILED: "archiveOpenFailed",
  DWG_CONVERSION_FAILED: "dwgConversionFailed",
  DWG_UNSUPPORTED_VERSION: "dwgUnsupportedVersion",
  DWG_CORRUPT_OR_ENCRYPTED: "dwgCorruptOrEncrypted",
  DWG_PARSE_FAILED: "dwgParseFailed",
  DWG_EXPORT_FAILED: "dwgExportFailed",
  DWG_MEMORY_LIMIT: "dwgMemoryLimit",
  DWG_CONVERSION_TIMEOUT: "dwgConversionTimeout",
  DWG_RUNTIME_MISSING: "dwgRuntimeMissing",
  RENDER_FAILED: "renderFailed",
} as const;

export function ErrorScreen({ error, onOpenLibrary, onRetry, onClose }: Props) {
  const { t } = useI18n();
  const diagnostic = error.details?.dwg;

  return (
    <main className="center-screen error-screen">
      <div className="error-symbol" aria-hidden="true">
        !
      </div>
      <p className="eyebrow">Arcad View</p>
      <h1>{t("errorTitle")}</h1>
      <p className="error-copy">{t(errorTranslation[error.code])}</p>
      {diagnostic ? (
        <dl className="error-diagnostics">
          <div>
            <dt>{t("dwgDiagnosticVersion")}</dt>
            <dd>{diagnostic.version}</dd>
          </div>
          {diagnostic.engineCode ? (
            <div>
              <dt>{t("dwgDiagnosticEngineCode")}</dt>
              <dd>{diagnostic.engineCode}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <button type="button" className="open-button" onClick={onOpenLibrary}>
        <FolderIcon />
        <span>{t("myDrawings")}</span>
      </button>
      {onRetry ? (
        <button type="button" className="cancel-button" onClick={onRetry}>
          {t("retryDrawing")}
        </button>
      ) : null}
      {onClose ? (
        <button type="button" className="cancel-button" onClick={onClose}>
          {t("back")}
        </button>
      ) : null}
    </main>
  );
}
