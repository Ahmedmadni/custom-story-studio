export type ProviderOperation =
  | "reference_image"
  | "script_generation"
  | "scene_generation"
  | "scene_poll";

export type SanitizedProviderDiagnostic = {
  provider: "gemini" | "lovable" | "replicate";
  operation: ProviderOperation;
  http_status: number | null;
  code: string | null;
  type: string | null;
  message: string;
  model: string;
  timestamp: string;
};

type DiagnosticContext = Pick<SanitizedProviderDiagnostic, "provider" | "operation" | "model">;

const MAX_MESSAGE_LENGTH = 500;

function cleanIdentifier(value: unknown): string | null {
  const source =
    typeof value === "string"
      ? value
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : null;
  if (!source) return null;
  const cleaned = source
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]/g, "")
    .slice(0, 100);
  return cleaned || null;
}

export function sanitizeProviderMessage(value: unknown, fallback: string): string {
  const source = typeof value === "string" ? value : fallback;
  return source
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/\bauthorization\s*[:=]?\s*(?:bearer\s+)?\S+/gi, "authorization [redacted]")
    .replace(/\bbearer\s+\S+/gi, "bearer [redacted]")
    .replace(/\bapi[_-]?key\s*[:=]?\s*\S+/gi, "api_key [redacted]")
    .replace(/data:[^;,\s]+;base64,[a-zA-Z0-9+/=]+/gi, "[redacted-image-data]")
    .replace(/[a-zA-Z0-9+/=]{256,}/g, "[redacted-large-data]")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

function safeArabicError(status: number) {
  if (status === 400) return "طلب مزود الإنتاج غير صالح";
  if (status === 401 || status === 403) return "بيانات اعتماد مزود الإنتاج غير صالحة";
  if (status === 402) return "رصيد مزود الإنتاج غير كافٍ";
  if (status === 429) return "مزود الإنتاج مشغول، حاول لاحقاً";
  return `فشل مزود الإنتاج (${status})`;
}

export class ProviderFailure extends Error {
  readonly diagnostic: SanitizedProviderDiagnostic;

  constructor(safeMessage: string, diagnostic: SanitizedProviderDiagnostic) {
    super(safeMessage);
    this.name = "ProviderFailure";
    this.diagnostic = diagnostic;
  }
}

export async function providerHttpFailure(
  response: Response,
  context: DiagnosticContext,
): Promise<ProviderFailure> {
  let providerError: Record<string, unknown> = {};
  try {
    const body = (await response.json()) as Record<string, unknown>;
    const nested = body.error;
    providerError =
      nested && typeof nested === "object" && !Array.isArray(nested)
        ? (nested as Record<string, unknown>)
        : body;
  } catch {
    // Never retain or log the raw response body.
  }
  const code = cleanIdentifier(providerError.code ?? providerError.status);
  const type = cleanIdentifier(providerError.type ?? providerError.status);
  const fallback = `Provider request failed with HTTP ${response.status}`;
  const diagnostic: SanitizedProviderDiagnostic = {
    ...context,
    http_status: response.status,
    code,
    type,
    message: sanitizeProviderMessage(providerError.message, fallback),
    timestamp: new Date().toISOString(),
  };
  return new ProviderFailure(safeArabicError(response.status), diagnostic);
}

export function providerResultFailure(
  context: DiagnosticContext,
  input: { httpStatus?: number; code?: string; type?: string; message: string },
) {
  return new ProviderFailure("لم يُرجع مزود الإنتاج نتيجة صالحة", {
    ...context,
    http_status: input.httpStatus ?? null,
    code: cleanIdentifier(input.code),
    type: cleanIdentifier(input.type),
    message: sanitizeProviderMessage(input.message, "Provider returned no usable result"),
    timestamp: new Date().toISOString(),
  });
}

export function getProviderFailureDiagnostic(error: unknown) {
  return error instanceof ProviderFailure ? error.diagnostic : null;
}
