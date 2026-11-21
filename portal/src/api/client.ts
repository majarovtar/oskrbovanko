import { ApiError } from "./errors";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    // body wasn't JSON - fall through to the status text.
  }
  return response.statusText;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }
  return (await response.json()) as T;
}
