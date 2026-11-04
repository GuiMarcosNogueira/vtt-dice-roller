import { RecognitionError } from "../types";

export function authHeaders(apiToken: string): Record<string, string> {
  return apiToken ? { Authorization: `Bearer ${apiToken}` } : {};
}

export async function readApiError(response: Response): Promise<RecognitionError> {
  try {
    const detail = (await response.json()).detail;
    if (detail.code) {
      return { code: detail.code, message: detail.message };
    }
  } catch {
    // Corpo ausente ou fora do formato {code, message}: usa o fallback abaixo
  }
  return {
    code: response.status === 401 ? "unauthorized" : "upstream_error",
    message: `Erro na API (${response.status})`,
  };
}
