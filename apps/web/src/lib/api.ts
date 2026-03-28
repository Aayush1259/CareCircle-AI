const resolveApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://localhost:4000/api";
  }

  return "/api";
};

export const apiBase = resolveApiBase();
export const authStorageKey = "carecircle_auth_token";
export const activePatientStorageKey = "carecircle_active_patient_id";

const buildApiHeaders = (init?: RequestInit) => {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(authStorageKey) : null;
  const activePatientId =
    typeof window !== "undefined" ? window.sessionStorage.getItem(activePatientStorageKey) : null;
  const isFormData = init?.body instanceof FormData;
  return {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activePatientId ? { "X-CareCircle-Patient-Id": activePatientId } : {}),
    ...(init?.headers ?? {}),
  };
};

const requestApi = async (path: string, init?: RequestInit) => {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: buildApiHeaders(init),
    });
  } catch {
    throw new Error(
      `CareCircle cannot reach the API right now. Make sure the backend is running and that VITE_API_URL points to it. Current API base: ${apiBase}`,
    );
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Something went wrong." }));
    throw new Error(payload.message || "Something went wrong.");
  }

  return response;
};

const parseFileName = (contentDisposition: string | null) => {
  if (!contentDisposition) return null;
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(contentDisposition);
  return match?.[1] ? decodeURIComponent(match[1].replace(/"/g, "")) : null;
};

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await requestApi(path, init);

  if (response.headers.get("content-type")?.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return response.text() as T;
}

export async function apiFileRequest(path: string, init?: RequestInit) {
  const response = await requestApi(path, init);
  return {
    blob: await response.blob(),
    fileName: parseFileName(response.headers.get("content-disposition")),
  };
}
