
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

interface AdminUser {
    id: number;
    name: string;
    email: string;
}

interface DashboardStatistics {
    total_candidates: number;
    total_recruiters: number;
    total_companies: number;
    total_jobs: number;
    active_jobs: number;
    inactive_jobs: number;
    total_applications: number;
    pending_verifications: number;
    verified_companies: number;
}

interface DashboardResponse {
    message: string;
    admin: AdminUser;
    statistics: DashboardStatistics;
}

export default function AdminDashboardPage() {
    const router = useRouter();

    const [admin, setAdmin] = useState<AdminUser | null>(null);
    const [stats, setStats] = useState<DashboardStatistics | null>(null);
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

                const user = await apiRequest<AdminUser & { role?: string }>(
                    "/auth/me"
                );

                if (user.role !== "admin") {
                    router.replace("/dashboard");
                    return;
                }

                const data = await apiRequest<DashboardResponse>(
                    "/admin/dashboard"
                );

                setAdmin(data.admin);
                setStats(data.statistics);

            } catch (err) {
                console.error("Admin dashboard error:", err);

                const status =
                    err && typeof err === "object" && "status" in err
                        ? (err as { status?: number }).status
                        : undefined;

                if (status === 401 || status === 403) {
                    localStorage.removeItem("access_token");
                    router.replace("/login");
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load admin dashboard."
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

    const statCards = [
        {
            title: "Total Candidates",
            value: stats?.total_candidates ?? 0,
            icon: "👥",
            color: "blue",
        },
        {
            title: "Total Recruiters",
            value: stats?.total_recruiters ?? 0,
            icon: "🧑‍💼",
            color: "purple",
        },
        {
            title: "Registered Companies",
            value: stats?.total_companies ?? 0,
            icon: "🏢",
            color: "cyan",
        },
        {
            title: "Total Jobs",
            value: stats?.total_jobs ?? 0,
            icon: "💼",
            color: "indigo",
        },
        {
            title: "Applications",
            value: stats?.total_applications ?? 0,
            icon: "📄",
            color: "pink",
        },
        {
            title: "Pending Verifications",
            value: stats?.pending_verifications ?? 0,
            icon: "⏳",
            color: "yellow",
        },
    ];

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
                    <p className="text-slate-400">
                        Loading admin dashboard...
                    </p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
                <div className="max-w-md rounded-2xl border border-red-500/20 bg-slate-900 p-8 text-center">
                    <h2 className="mb-3 text-xl font-bold text-red-400">
                        Dashboard Error
                    </h2>
                    <p className="text-slate-300">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 rounded-lg bg-blue-600 px-5 py-2 hover:bg-blue-500"
                    >
                        Retry
                    </button>
                </div>
            </main>
        );
    }

    if (!stats || !admin) {
        return null;
    }

    return (
        <main className="min-h-screen bg-slate-950 text-white">

            {/* TOP NAVIGATION */}
            <nav className="border-b border-slate-800 bg-slate-950">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

                    <h1 className="text-2xl font-bold">
                        <span className="text-blue-500">Hire</span>Swipe
                        <span className="ml-3 rounded-md bg-blue-500/10 px-2 py-1 text-xs text-blue-400">
                            PLATFORM ADMIN
                        </span>
                    </h1>

                    <div className="flex items-center gap-5">
                        <div className="hidden text-right sm:block">
                            <p className="text-sm font-semibold">
                                {admin.name}
                            </p>
                            <p className="text-xs text-slate-400">
                                {admin.email}
                            </p>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-red-500 hover:text-red-400"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </nav>

            <div className="mx-auto max-w-7xl px-6 py-10">

                {/* WELCOME SECTION */}
                <section className="mb-10">
                    <p className="mb-2 text-sm font-medium text-blue-400">
                        PLATFORM OVERVIEW
                    </p>

                    <h2 className="text-3xl font-bold">
                        Welcome back, {admin.name}
                    </h2>

                    <p className="mt-2 text-slate-400">
                        Monitor and manage the HireSwipe recruitment platform.
                    </p>
                </section>

                {/* STATISTICS */}
                <section>
                    <div className="mb-5 flex items-center justify-between">
                        <h3 className="text-xl font-semibold">
                            Platform Statistics
                        </h3>
                        <span className="text-xs text-slate-500">
                            Live data from backend
                        </span>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {statCards.map((card) => (
                            <div
                                key={card.title}
                                className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500/50"
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-slate-400">
                                        {card.title}
                                    </p>
                                    <span className="text-2xl">
                                        {card.icon}
                                    </span>
                                </div>

                                <p className="mt-5 text-3xl font-bold">
                                    {card.value.toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* JOB OVERVIEW */}
                <section className="mt-10">
                    <h3 className="mb-5 text-xl font-semibold">
                        Job Overview
                    </h3>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                            <p className="text-sm text-slate-400">
                                Active Jobs
                            </p>
                            <p className="mt-3 text-3xl font-bold text-green-400">
                                {stats.active_jobs}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                            <p className="text-sm text-slate-400">
                                Inactive Jobs
                            </p>
                            <p className="mt-3 text-3xl font-bold text-slate-400">
                                {stats.inactive_jobs}
                            </p>
                        </div>
                    </div>
                </section>

                {/* COMPANY VERIFICATION OVERVIEW */}
                <section className="mt-10">
                    <h3 className="mb-5 text-xl font-semibold">
                        Company Verification
                    </h3>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

                        <div className="grid gap-6 sm:grid-cols-2">

                            <div>
                                <p className="text-sm text-slate-400">
                                    Pending Reviews
                                </p>
                                <p className="mt-2 text-3xl font-bold text-yellow-400">
                                    {stats.pending_verifications}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-slate-400">
                                    Verified Companies
                                </p>
                                <p className="mt-2 text-3xl font-bold text-green-400">
                                    {stats.verified_companies}
                                </p>
                            </div>

                        </div>

                        <button
                            onClick={() =>
                                router.push("/admin/company_verification")
                            }
                            className="mt-7 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500"
                        >
                            Manage Company Verifications →
                        </button>

                    </div>
                </section>

            </div>
        </main>
    );
}
