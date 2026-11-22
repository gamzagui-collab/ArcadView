export type DrawingFormat = "dxf" | "dwg" | "pdf" | "zip" | "rar";

export type DrawingFile = {
  file: File;
  name: string;
  format: DrawingFormat;
  size: number;
};

export type LoadingPhase =
  | "reading"
  | "converting"
  | "fetch"
  | "parse"
  | "prepare"
  | "font";

export type ViewerCommand = "zoom-in" | "zoom-out" | "fit" | "reset";

export type ViewerHandle = {
  execute(command: ViewerCommand): void;
  edit?(command: "undo"|"redo"|"cancel"): void;
  objectAction?(command: "select"|"move"|"rotate"|"delete"): void;
  cancelGesture?(): void;
  showTakeoffTools?():void;
  finishText?(): boolean;
};

export type AppErrorCode =
  | "UNSUPPORTED_FORMAT"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "FILE_READ_FAILED"
  | "PDF_OPEN_FAILED"
  | "PDF_PASSWORD_REQUIRED"
  | "ARCHIVE_OPEN_FAILED"
  | "DXF_OPEN_FAILED"
  | "DWG_CONVERSION_FAILED"
  | "DWG_UNSUPPORTED_VERSION"
  | "DWG_CORRUPT_OR_ENCRYPTED"
  | "DWG_PARSE_FAILED"
  | "DWG_EXPORT_FAILED"
  | "DWG_MEMORY_LIMIT"
  | "DRAWING_MEMORY_LIMIT"
  | "DWG_CONVERSION_TIMEOUT"
  | "DWG_RUNTIME_MISSING"
  | "RENDER_FAILED";

export type DwgDiagnostic = {
  engine: "libredwg";
  version: string;
  fileSizeBytes: number;
  engineCode?: string;
};

export type AppErrorDetails = {
  dwg?: DwgDiagnostic;
};

type AppErrorOptions = ErrorOptions & {
  details?: AppErrorDetails;
};

export class AppError extends Error {
  public readonly details?: AppErrorDetails;

  constructor(
    public readonly code: AppErrorCode,
    message?: string,
    options?: AppErrorOptions,
  ) {
    super(message ?? code, options);
    this.name = "AppError";
    this.details = options?.details;
  }
}
