const API_BASE_URL = "http://127.0.0.1:8000";

/**
 * Represents an unsuccessful response from the HireSwipe API.
 */
export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

/**
 * Sends an HTTP request to the HireSwipe backend.
 */
export async function apiRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token =
        typeof window !== "undefined"
            ? localStorage.getItem("access_token")
            : null;

    const headers = new Headers(options.headers);

    if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has("Content-Type")
    ) {
        headers.set("Content-Type", "application/json");
    }

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        throw new ApiError(
            errorData.detail || "Something went wrong.",
            response.status
        );
    }

    if (response.status === 204) {
        return null as T;
    }

    return response.json() as Promise<T>;
}