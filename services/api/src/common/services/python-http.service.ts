import { Injectable, ServiceUnavailableException } from "@nestjs/common";

export interface PythonServiceRequestOptions {
  timeoutMs?: number;
}

@Injectable()
export class PythonHttpService {
  async get<T>(
    baseUrl: string,
    path: string,
    serviceName: string,
    options: PythonServiceRequestOptions = {},
  ): Promise<T> {
    return this.request<T>(baseUrl, path, serviceName, {
      method: "GET",
      timeoutMs: options.timeoutMs,
    });
  }

  async post<T>(
    baseUrl: string,
    path: string,
    body: unknown,
    serviceName: string,
    options: PythonServiceRequestOptions = {},
  ): Promise<T> {
    return this.request<T>(baseUrl, path, serviceName, {
      method: "POST",
      body,
      timeoutMs: options.timeoutMs,
    });
  }

  private async request<T>(
    baseUrl: string,
    path: string,
    serviceName: string,
    options: {
      method: "GET" | "POST";
      body?: unknown;
      timeoutMs?: number;
    },
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
    const url = `${baseUrl.replace(/\/$/, "")}${path}`;

    try {
      const response = await fetch(url, {
        method: options.method,
        headers:
          options.method === "POST"
            ? { "content-type": "application/json", accept: "application/json" }
            : { accept: "application/json" },
        body: options.method === "POST" ? JSON.stringify(options.body ?? {}) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new ServiceUnavailableException({
          message: `${serviceName} service returned ${response.status}${text ? `: ${text}` : ""}`,
          code: `${serviceName.toUpperCase().replace(/\W+/g, "_")}_UNAVAILABLE`,
        });
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      const reason =
        error instanceof Error && error.name === "AbortError"
          ? "request timed out"
          : error instanceof Error
            ? error.message
            : String(error);

      throw new ServiceUnavailableException({
        message: `${serviceName} service unavailable: ${reason}`,
        code: `${serviceName.toUpperCase().replace(/\W+/g, "_")}_UNAVAILABLE`,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
