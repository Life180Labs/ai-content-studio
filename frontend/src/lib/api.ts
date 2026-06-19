/**
 * API client with JWT interceptors and automatic token refresh.
 */

// Dynamic base URL getter to handle SSR/CSR mismatch

interface ApiError {
  error: {
    code: string;
    message: string;
    details: Array<{ field: string; message: string }>;
  };
  meta?: { request_id: string };
}

class ApiClient {
  private get baseUrl(): string {
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
    if (typeof window !== "undefined") return `http://${window.location.hostname}:8000`;
    return "http://localhost:8000";
  }

  constructor() {}

  private getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("access_token");
  }

  private setAccessToken(token: string): void {
    sessionStorage.setItem("access_token", token);
  }

  private getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refresh_token");
  }

  private setRefreshToken(token: string): void {
    localStorage.setItem("refresh_token", token);
  }

  clearTokens(): void {
    sessionStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.setAccessToken(accessToken);
    this.setRefreshToken(refreshToken);
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        this.clearTokens();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return false;
      }

      const data = await res.json();
      this.setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      this.clearTokens();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return false;
    }
  }

  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers as Record<string, string>),
    };

    const accessToken = this.getAccessToken();
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    let res = await fetch(url, { ...options, headers });

    // If 401, try to refresh the token once
    if (res.status === 401 && accessToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.getAccessToken()}`;
        res = await fetch(url, { ...options, headers });
      }
    }

    if (!res.ok) {
      const errorData: ApiError = await res.json().catch(() => ({
        error: {
          code: "UNKNOWN_ERROR",
          message: `Request failed with status ${res.status}`,
          details: [],
        },
      }));
      throw errorData;
    }

    return res.json();
  }

  get<T>(path: string, options?: RequestInit) {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  /** Fetch a binary resource (e.g. video/zip) with auth + one-time token refresh. */
  async getBlob(path: string): Promise<Blob> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {};
    const accessToken = this.getAccessToken();
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    let res = await fetch(url, { method: "GET", headers });

    if (res.status === 401 && accessToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.getAccessToken()}`;
        res = await fetch(url, { method: "GET", headers });
      }
    }

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }
    return res.blob();
  }

  post<T>(path: string, body?: unknown, options?: RequestInit) {
    const isFormData = body instanceof FormData;
    const reqOptions: RequestInit = {
      ...options,
      method: "POST",
      body: isFormData ? (body as FormData) : (body ? JSON.stringify(body) : undefined),
    };
    if (isFormData) {
      reqOptions.headers = { ...options?.headers };
      // Let the browser set Content-Type for FormData (includes boundary)
      delete (reqOptions.headers as any)["Content-Type"];
    }
    return this.request<T>(path, reqOptions);
  }

  patch<T>(path: string, body?: unknown, options?: RequestInit) {
    const isFormData = body instanceof FormData;
    const reqOptions: RequestInit = {
      ...options,
      method: "PATCH",
      body: isFormData ? (body as FormData) : (body ? JSON.stringify(body) : undefined),
    };
    if (isFormData) {
      reqOptions.headers = { ...options?.headers };
      delete (reqOptions.headers as any)["Content-Type"];
    }
    return this.request<T>(path, reqOptions);
  }

  put<T>(path: string, body?: unknown, options?: RequestInit) {
    const isFormData = body instanceof FormData;
    const reqOptions: RequestInit = {
      ...options,
      method: "PUT",
      body: isFormData ? (body as FormData) : (body ? JSON.stringify(body) : undefined),
    };
    if (isFormData) {
      reqOptions.headers = { ...options?.headers };
      delete (reqOptions.headers as any)["Content-Type"];
    }
    return this.request<T>(path, reqOptions);
  }

  delete<T>(path: string, options?: RequestInit) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}

export const api = new ApiClient();
