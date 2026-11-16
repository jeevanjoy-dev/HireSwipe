
export const API_BASE_URL = "http://127.0.0.1:8000";

// Represents an unsuccessful response from the HireSwipe API.
export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

// Retrieves the authenticated user's JWT from local storage.
function getAccessToken(): string | null {
    if (typeof window === "undefined") {
        return null;
    }

    return localStorage.getItem("access_token");
}

// Creates headers with the user's JWT when available.
function createAuthHeaders(
    existingHeaders?: HeadersInit
): Headers {
    const headers = new Headers(existingHeaders);
    const token = getAccessToken();

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    return headers;
}

// Converts different API error formats into readable messages.
function extractErrorMessage(detail: unknown): string {
    if (typeof detail === "string") {
        return detail;
    }

    if (Array.isArray(detail)) {
        const messages = detail
            .map((item) => extractErrorMessage(item))
            .filter(Boolean);

        return messages.length > 0
            ? messages.join(", ")
            : "Something went wrong.";
    }

    if (detail && typeof detail === "object") {
        const error = detail as Record<string, unknown>;

        if (typeof error.message === "string") {
            return error.message;
        }

        if (typeof error.msg === "string") {
            return error.msg;
        }

        if (typeof error.detail === "string") {
            return error.detail;
        }

        if (error.detail !== undefined) {
            return extractErrorMessage(error.detail);
        }

        return JSON.stringify(detail);
    }

    return "Something went wrong.";
}

// Extracts a readable error message from an unsuccessful response.
async function getApiErrorMessage(
    response: Response,
    fallback: string
): Promise<string> {
    const responseText = await response.text();

    if (!responseText) {
        return fallback;
    }

    try {
        const errorData = JSON.parse(responseText);

        const detail =
            errorData?.detail ??
            errorData?.message ??
            errorData;

        return extractErrorMessage(detail);
    } catch {
        return responseText || fallback;
    }
}

// Extracts the filename from the Content-Disposition response header.
function getResponseFilename(
    disposition: string | null
): string | null {
    if (!disposition) {
        return null;
    }

    // Supports RFC 5987 filename* values.
    const encodedFilenameMatch = disposition.match(
        /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i
    );

    if (encodedFilenameMatch) {
        const encodedFilename = encodedFilenameMatch[1]
            .trim()
            .replace(/^["']|["']$/g, "");

        try {
            return decodeURIComponent(encodedFilename);
        } catch {
            return encodedFilename;
        }
    }

    // Supports standard quoted and unquoted filename values.
    const filenameMatch = disposition.match(
        /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i
    );

    if (filenameMatch) {
        return (filenameMatch[1] || filenameMatch[2]).trim();
    }

    return null;
}

// Determines the correct MIME type from the file extension.
function getFileMimeType(
    filename: string | null
): string | null {
    if (!filename) {
        return null;
    }

    const extension = filename
        .split(".")
        .pop()
        ?.toLowerCase();

    switch (extension) {
        case "pdf":
            return "application/pdf";

        case "docx":
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        case "doc":
            return "application/msword";

        default:
            return null;
    }
}

/**
 * Sends an HTTP request to the HireSwipe backend.
 * Automatically attaches the authenticated user's JWT.
 */
export async function apiRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const headers = createAuthHeaders(options.headers);

    // Automatically set JSON content type when appropriate.
    // Do not set Content-Type manually for FormData.
    const isFormData =
        typeof FormData !== "undefined" &&
        options.body instanceof FormData;

    if (
        options.body &&
        !isFormData &&
        !headers.has("Content-Type")
    ) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
            ...options,
            headers,
        }
    );

    // Handle unsuccessful API responses.
    if (!response.ok) {
        const message = await getApiErrorMessage(
            response,
            "Something went wrong."
        );

        throw new ApiError(message, response.status);
    }

    // Handle responses without a body.
    if (
        response.status === 204 ||
        response.headers.get("content-length") === "0"
    ) {
        return null as T;
    }

    // Return successful JSON response.
    const responseText = await response.text();

    if (!responseText) {
        return null as T;
    }

    try {
        return JSON.parse(responseText) as T;
    } catch {
        throw new ApiError(
            "The server returned an invalid response.",
            response.status
        );
    }
}

/**
 * Fetches an authenticated file from the backend.
 * Used for candidate resumes, application resumes and profile photos.
 *
 * Returns a Blob instead of JSON.
 */
export async function apiFileRequest(
    endpoint: string
): Promise<Blob> {
    const headers = createAuthHeaders();

    const response = await fetch(
        `${API_BASE_URL}${endpoint}`,
        {
            method: "GET",
            headers,
        }
    );

    // Handle unsuccessful file responses.
    if (!response.ok) {
        const message = await getApiErrorMessage(
            response,
            "Unable to retrieve file."
        );

        throw new ApiError(message, response.status);
    }

    // Read the file data.
    const blob = await response.blob();

    // Get the original filename supplied by FastAPI.
    const disposition = response.headers.get(
        "Content-Disposition"
    );

    const filename = getResponseFilename(disposition);

    // Prefer the MIME type inferred from the filename.
    const inferredMimeType = getFileMimeType(filename);

    // Use the backend MIME type when it is more specific.
    const responseMimeType = response.headers
        .get("Content-Type")
        ?.split(";")[0];

    const mimeType =
        inferredMimeType ||
        (
            responseMimeType &&
            responseMimeType !== "application/octet-stream"
                ? responseMimeType
                : blob.type
        );

    // Return the file with the correct MIME type for browser preview.
    return new Blob([blob], {
        type: mimeType || "application/octet-stream",
    });
}
