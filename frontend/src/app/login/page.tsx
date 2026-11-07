
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../services/api";

type LoginResponse = {
    access_token: string;
    token_type: string;
};

type UserResponse = {
    id: number;
    name: string;
    email: string;
    role: string;
};

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    async function handleLogin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        try {
            setLoading(true);
            setMessage("");

            // Step 1: Authenticate user
            const data: LoginResponse = await apiRequest(
                "/auth/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email,
                        password,
                    }),
                }
            );

            // Step 2: Store authentication token
            localStorage.setItem(
                "access_token",
                data.access_token
            );

            // Step 3: Fetch logged-in user details
            const userData: UserResponse = await apiRequest(
                "/auth/me"
            );

            // Step 4: Redirect according to user role
            if (userData.role === "candidate") {
                router.replace("/dashboard");
            } else if (userData.role === "recruiter") {
                router.replace("/recruiter/dashboard");
            } else if (userData.role === "admin") {
                router.replace("/admin/dashboard");
            } else {
                setMessage("Your account has an unsupported role.");
                localStorage.removeItem("access_token");
            }

        } catch (error) {
            console.error("Login error:", error);

            localStorage.removeItem("access_token");

            if (error instanceof Error) {
                setMessage(error.message);
            } else {
                setMessage("Invalid email or password.");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 px-6 py-12 text-white">

            <div className="mx-auto flex min-h-[85vh] max-w-md items-center justify-center">

                <div className="w-full">

                    {/* BRAND */}
                    <div className="mb-8 text-center">
                        <h1 className="text-4xl font-bold tracking-tight">
                            Hire<span className="text-blue-400">Swipe</span>
                        </h1>

                        <p className="mt-3 text-slate-400">
                            Find the right opportunity. Build your future.
                        </p>
                    </div>

                    {/* LOGIN CARD */}
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">

                        <div className="mb-7">
                            <h2 className="text-2xl font-bold">
                                Welcome Back
                            </h2>

                            <p className="mt-2 text-sm text-slate-400">
                                Sign in to continue to your HireSwipe account.
                            </p>
                        </div>

                        <form
                            onSubmit={handleLogin}
                            className="space-y-5"
                        >

                            {/* EMAIL */}
                            <div>
                                <label
                                    htmlFor="email"
                                    className="mb-2 block text-sm font-medium text-slate-200"
                                >
                                    Email
                                </label>

                                <input
                                    id="email"
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                    required
                                    autoComplete="email"
                                    className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            {/* PASSWORD */}
                            <div>
                                <label
                                    htmlFor="password"
                                    className="mb-2 block text-sm font-medium text-slate-200"
                                >
                                    Password
                                </label>

                                <input
                                    id="password"
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    required
                                    autoComplete="current-password"
                                    className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            {/* ERROR MESSAGE */}
                            {message && (
                                <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                    {message}
                                </div>
                            )}

                            {/* LOGIN BUTTON */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading
                                    ? "Signing in..."
                                    : "Sign In"}
                            </button>

                        </form>

                        {/* BACK BUTTON */}
                        <button
                            type="button"
                            onClick={() => router.push("/")}
                            className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                        >
                            Back to Home
                        </button>

                    </div>

                    <p className="mt-6 text-center text-xs text-slate-500">
                        HireSwipe • Connecting talent with opportunity
                    </p>

                </div>
            </div>
        </main>
    );
}
