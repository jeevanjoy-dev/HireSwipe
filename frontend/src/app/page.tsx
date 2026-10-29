"use client";

import { useState } from "react";
import { apiRequest } from "../services/api";

export default function Home() {
    const [message, setMessage] = useState("");

    async function getCurrentUser() {
        try {
            const data = await apiRequest("/auth/me");
            setMessage(`Logged in as: ${data.name} (${data.role})`);
        } catch {
            setMessage("Authentication failed");
        }
    }

    return (
        <main>
            <h1>HireSwipe</h1>

            <button onClick={getCurrentUser}>
                Get My Profile
            </button>

            <p>{message}</p>
        </main>
    );
}