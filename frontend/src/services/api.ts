const API_BASE_URL = "http://127.0.0.1:8000";

/**
 * Send an HTTP request to the HireSwipe backend API.
 *
 * Args:
 *     endpoint: Backend API endpoint.
 *     options: Fetch request options.
 *
 * Returns:
 *     Parsed JSON response from the backend, or null for 204 responses.
 *
 * Raises:
 *     Error: If the backend returns an unsuccessful response.
 */
export async function apiRequest(
    endpoint: string,
    options: RequestInit = {}
) {
    const token = localStorage.getItem("access_token");

    const headers = new Headers(options.headers);

    if (options.body) {
        headers.set("Content-Type", "application/json");
    }

    if (token) {
        headers.set("Authorization", `Bearer ${token}`); // Send JWT for authenticated requests
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        throw new Error(
            errorData.detail || "Something went wrong"
        );
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}