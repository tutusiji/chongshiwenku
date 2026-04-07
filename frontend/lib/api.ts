export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

const accessTokenStorageKey = "cswk_access_token";
const authUserStorageKey = "cswk_auth_user";

export type ApiError = {
  detail?: string;
};

export type StoredAuthUser = {
  id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  nickname: string;
  avatar_url?: string | null;
  bio?: string | null;
  status?: string;
  is_admin?: boolean;
};

async function readApiError(response: Response): Promise<string> {
  let detail = "请求失败";
  try {
    const data = (await response.json()) as ApiError;
    detail = data.detail ?? detail;
  } catch {
    detail = response.statusText || detail;
  }
  return detail;
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as T;
}

export async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export async function requestFormDataJson<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    body: formData,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as T;
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(accessTokenStorageKey);
}

export function setStoredAccessToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(accessTokenStorageKey, token);
}

export function removeStoredAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(accessTokenStorageKey);
  window.localStorage.removeItem(authUserStorageKey);
}

export function getStoredAuthUser(): StoredAuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(authUserStorageKey);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredAuthUser;
  } catch {
    window.localStorage.removeItem(authUserStorageKey);
    return null;
  }
}

export function setStoredAuthUser(user: StoredAuthUser): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(authUserStorageKey, JSON.stringify(user));
}

export function setStoredAuthSession(token: string, user: StoredAuthUser): void {
  setStoredAccessToken(token);
  setStoredAuthUser(user);
}
