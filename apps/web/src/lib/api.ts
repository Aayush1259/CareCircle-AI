const resolveApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://localhost:4000/api";
  }

  return "/api";
};

const apiBase = resolveApiBase();
export const authStorageKey = "carecircle_auth_token";

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(authStorageKey) : null;
  const isFormData = init?.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
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

  if (response.headers.get("content-type")?.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return response.text() as T;
}
