"use client";

import { useState } from "react";
import { apiRequest } from "../../services/api";
import { useRouter } from "next/navigation";

/**
 * Display the HireSwipe login page.
 */
export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");

    /**
     * Authenticate the user and store the returned JWT token.
     */
    async function handleLogin() {
        try {
            const data = await apiRequest("/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    email,
                    password,
                }),
            });

            localStorage.setItem("access_token", data.access_token);
            router.push("/dashboard");
        } catch {
            setMessage("Login failed. Check your email and password.");
        }
    }

    /**
     * Retrieve and display the currently authenticated user's information.
     */
    async function getCurrentUser() {
        try {
            const data = await apiRequest("/auth/me");

            setMessage(`Logged in as ${data.name} (${data.role})`);
        } catch {
            setMessage("Failed to get current user");
        }
    }

    return (
        <main>
            <h1>HireSwipe Login</h1>

            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
            />

            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
            />

            <button onClick={handleLogin}>
                Login
            </button>

            <button onClick={getCurrentUser}>
                GetCurrentUser
            </button>

            {message && <p>{message}</p>}
        </main>
    );
}