
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
    const [showPassword, setShowPassword] = useState(false);

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

                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(event) =>
                                            setPassword(event.target.value)
                                        }
                                        required
                                        autoComplete="current-password"
                                        className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 pr-12 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                                    />

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword(!showPassword)
                                        }
                                        aria-label={
                                            showPassword
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                                    >
                                        {showPassword ? (
                                            /* Eye off icon */
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="21"
                                                height="21"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M3 3l18 18" />
                                                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                                                <path d="M9.9 5.2A10.5 10.5 0 0 1 12 5c5 0 8.3 4.5 9 7-.3 1-1.1 2.2-2.2 3.4" />
                                                <path d="M6.6 6.6C4.5 8 3.4 10 3 12c.7 2.5 4 7 9 7 1.3 0 2.5-.3 3.5-.8" />
                                            </svg>
                                        ) : (
                                            /* Eye icon */
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="21"
                                                height="21"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
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

                        {/* CREATE ACCOUNT BUTTON */}
                        <div className="mt-6 border-t border-white/10 pt-6 text-center">
                            <p className="mb-3 text-sm text-slate-400">
                                Don't have a HireSwipe account?
                            </p>

                            <button
                                type="button"
                                onClick={() => router.push("/register/role")}
                                className="w-full rounded-xl border border-blue-400/40 bg-blue-500/10 px-5 py-3 font-semibold text-blue-300 transition hover:border-blue-400 hover:bg-blue-500/20 hover:text-white"
                            >
                                Create an Account
                            </button>
                        </div>

                    </div>

                    <p className="mt-6 text-center text-xs text-slate-500">
                        HireSwipe • Connecting talent with opportunity
                    </p>

                </div>
            </div>
        </main>
    );
}
