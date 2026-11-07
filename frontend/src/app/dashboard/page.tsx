
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../services/api";

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

export default function CandidateDashboardPage() {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadDashboard() {
            try {
                const token = localStorage.getItem("access_token");

                if (!token) {
                    router.replace("/login");
                    return;
                }

                const userData = await apiRequest("/auth/me") as User;

                if (userData.role !== "candidate") {
                if (userData.role === "recruiter") {
                    router.replace("/recruiter/dashboard");
                } else {
                    router.replace("/dashboard");
                }
                return;
            }

                setUser(userData);
            } catch (err) {
                const status =
                    err && typeof err === "object" && "status" in err
                        ? (err as { status?: number }).status
                        : undefined;

                if (status === 401) {
                    localStorage.removeItem("access_token");
                    router.replace("/login");
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load candidate dashboard."
                );
            } finally {
                setLoading(false);
            }
        }

        loadDashboard();
    }, [router]);

    function handleLogout() {
        localStorage.removeItem("access_token");
        router.replace("/login");
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                Loading candidate dashboard...
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <p className="text-red-400">{error}</p>
            </main>
        );
    }

    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-950 text-white">

            {/* NAVIGATION */}
            <nav className="border-b border-slate-800">
                <div className="mx-auto max-w-7xl px-6 py-5 flex justify-between items-center">
                    <h1 className="text-2xl font-bold">
                        <span className="text-blue-500">Hire</span>Swipe
                    </h1>

                    <button
                        onClick={handleLogout}
                        className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-red-500"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            <div className="mx-auto max-w-7xl px-6 py-10">

                {/* WELCOME */}
                <section className="mb-10">
                    <p className="text-blue-400 text-sm uppercase tracking-wider mb-2">
                        Candidate Portal
                    </p>

                    <h2 className="text-4xl font-bold">
                        Welcome, {user.name}
                    </h2>

                    <p className="mt-2 text-slate-400">
                        Discover opportunities and manage your career with HireSwipe.
                    </p>
                </section>

                {/* PROFILE SUMMARY */}
                <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                    <h3 className="text-xl font-semibold mb-4">
                        My Account
                    </h3>

                    <p className="text-lg font-semibold">
                        {user.name}
                    </p>

                    <p className="mt-1 text-slate-400">
                        {user.email}
                    </p>

                    <p className="mt-2 text-sm text-blue-400">
                        Candidate
                    </p>
                </section>

                {/* CANDIDATE MANAGEMENT */}
                <section>
                    <h3 className="text-2xl font-bold mb-5">
                        Career Management
                    </h3>

                    <div className="grid gap-5 md:grid-cols-3">

                        <button
                            onClick={() => router.push("/jobs")}
                            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left hover:border-blue-500"
                        >
                            <div className="text-3xl mb-4">💼</div>

                            <h4 className="text-lg font-semibold">
                                Browse Jobs
                            </h4>

                            <p className="mt-2 text-sm text-slate-400">
                                Discover job opportunities that match your skills.
                            </p>
                        </button>

                        <button
                            onClick={() => router.push("/applications")}
                            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left hover:border-green-500"
                        >
                            <div className="text-3xl mb-4">📋</div>

                            <h4 className="text-lg font-semibold">
                                My Applications
                            </h4>

                            <p className="mt-2 text-sm text-slate-400">
                                Track your submitted job applications.
                            </p>
                        </button>

                        <button
                            onClick={() => router.push("/profile")}
                            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left hover:border-purple-500"
                        >
                            <div className="text-3xl mb-4">👤</div>

                            <h4 className="text-lg font-semibold">
                                My Profile
                            </h4>

                            <p className="mt-2 text-sm text-slate-400">
                                View and manage your candidate profile.
                            </p>
                        </button>

                    </div>
                </section>

                <footer className="mt-16 border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
                    HireSwipe • Candidate Portal
                </footer>

            </div>
        </main>
    );
}
