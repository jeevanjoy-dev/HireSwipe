"use client";

import { useState } from "react";
import { apiRequest } from "../../services/api";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");

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
            setMessage("Login successful!");
        } catch {
            setMessage("Login failed. Check your email and password.");
        }
    }

    async function getCurrentUser() {
        try {
            const data = await apiRequest("/auth/me", {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                },
            });

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