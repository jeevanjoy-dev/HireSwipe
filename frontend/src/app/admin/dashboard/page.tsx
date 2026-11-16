
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

interface Admin {
  id: number;
  name: string;
  email: string;
}

interface Statistics {
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
  admin: Admin;
  statistics: Statistics;
}

export default function AdminDashboard() {
  const router = useRouter();

  const [admin, setAdmin] = useState<Admin | null>(null);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load admin information and dashboard statistics.
  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        // Check whether the logged-in user is an admin.
        const user = await apiRequest("/auth/me");

        if (user.role !== "admin") {
          router.replace("/login");
          return;
        }

        // Fetch dashboard statistics.
        const response: DashboardResponse = await apiRequest(
          "/admin/dashboard"
        );

        if (!cancelled) {
          setAdmin(response.admin);
          setStats(response.statistics);
        }
      } catch (err) {
        console.error("Dashboard loading error:", err);

        if (!cancelled) {
          setError("Unable to load dashboard information.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Logout admin.
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    router.replace("/login");
  };

  // Dashboard statistic cards.
  const statisticCards = [
    {
      title: "Total Candidates",
      value: stats?.total_candidates ?? 0,
      icon: "👤",
      color: "text-blue-400",
    },
    {
      title: "Total Recruiters",
      value: stats?.total_recruiters ?? 0,
      icon: "💼",
      color: "text-purple-400",
    },
    {
      title: "Total Companies",
      value: stats?.total_companies ?? 0,
      icon: "🏢",
      color: "text-cyan-400",
    },
    {
      title: "Total Jobs",
      value: stats?.total_jobs ?? 0,
      icon: "📋",
      color: "text-indigo-400",
    },
    {
      title: "Total Applications",
      value: stats?.total_applications ?? 0,
      icon: "📨",
      color: "text-pink-400",
    },
    {
      title: "Pending Verifications",
      value: stats?.pending_verifications ?? 0,
      icon: "⏳",
      color: "text-yellow-400",
    },
  ];

  // Admin management navigation cards.
  const managementCards = [
    {
      title: "Companies",
      description: "View and manage registered companies.",
      icon: "🏢",
      route: "/admin/companies",
      color: "border-cyan-500/30",
    },
    {
      title: "Company Verification",
      description: "Review company documents and verification requests.",
      icon: "🛡️",
      route: "/admin/company_verification",
      color: "border-yellow-500/30",
    },
    {
      title: "Recruiters",
      description: "View recruiter accounts and company associations.",
      icon: "💼",
      route: "/admin/recruiters",
      color: "border-purple-500/30",
    },
    {
      title: "Candidates",
      description: "View candidate accounts and profile information.",
      icon: "👤",
      route: "/admin/candidates",
      color: "border-blue-500/30",
    },
    {
      title: "Jobs Management",
      description: "View all jobs posted on HireSwipe.",
      icon: "📋",
      route: "/admin/jobs",
      color: "border-indigo-500/30",
    },
    {
      title: "Applications",
      description: "Monitor candidate applications across the platform.",
      icon: "📨",
      route: "/admin/applications",
      color: "border-pink-500/30",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading admin dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Top navigation */}
      <header className="bg-slate-900 border-b border-slate-800 px-5 md:px-8 py-5">

        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

          <div>
            <h1 className="text-2xl font-bold">
              HireSwipe Admin
            </h1>

            <p className="text-sm text-slate-400 mt-1">
              Platform Administration Dashboard
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white px-5 py-2 rounded-lg transition"
          >
            Logout
          </button>

        </div>

      </header>

      <main className="max-w-7xl mx-auto p-5 md:p-8">

        {/* Admin welcome section */}
        <div className="mb-8">

          <h2 className="text-2xl font-semibold">
            Welcome, {admin?.name || "Admin"}
          </h2>

          <p className="text-slate-400 mt-2">
            Manage and monitor the HireSwipe recruitment platform.
          </p>

          {admin?.email && (
            <p className="text-sm text-slate-500 mt-1">
              {admin.email}
            </p>
          )}

        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-950/40 border border-red-800 text-red-300 rounded-xl p-4 mb-6">
            {error}
          </div>
        )}

        {/* Platform statistics */}
        <section className="mb-10">

          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold">
              Platform Overview
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {statisticCards.map((card) => (
              <div
                key={card.title}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition"
              >

                <div className="flex justify-between items-center">

                  <div>
                    <p className="text-sm text-slate-400">
                      {card.title}
                    </p>

                    <p className={`text-3xl font-bold mt-3 ${card.color}`}>
                      {card.value.toLocaleString("en-IN")}
                    </p>
                  </div>

                  <span className="text-3xl">
                    {card.icon}
                  </span>

                </div>

              </div>
            ))}

          </div>

        </section>

        {/* Job statistics */}
        <section className="mb-10">

          <h2 className="text-xl font-semibold mb-5">
            Job Overview
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            <div className="bg-slate-900 border border-green-500/20 rounded-xl p-5">

              <p className="text-slate-400 text-sm">
                Active Jobs
              </p>

              <p className="text-3xl font-bold text-green-400 mt-3">
                {stats?.active_jobs ?? 0}
              </p>

            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">

              <p className="text-slate-400 text-sm">
                Inactive Jobs
              </p>

              <p className="text-3xl font-bold text-slate-300 mt-3">
                {stats?.inactive_jobs ?? 0}
              </p>

            </div>

          </div>

        </section>

        {/* Company verification overview */}
        <section className="mb-10">

          <h2 className="text-xl font-semibold mb-5">
            Company Verification Overview
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            <div className="bg-slate-900 border border-yellow-500/20 rounded-xl p-5">

              <p className="text-slate-400 text-sm">
                Pending Verifications
              </p>

              <p className="text-3xl font-bold text-yellow-400 mt-3">
                {stats?.pending_verifications ?? 0}
              </p>

            </div>

            <div className="bg-slate-900 border border-green-500/20 rounded-xl p-5">

              <p className="text-slate-400 text-sm">
                Verified Companies
              </p>

              <p className="text-3xl font-bold text-green-400 mt-3">
                {stats?.verified_companies ?? 0}
              </p>

            </div>

          </div>

          <button
            onClick={() => router.push("/admin/company_verification")}
            className="mt-5 bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-lg font-medium transition"
          >
            Manage Company Verifications →
          </button>

        </section>

        {/* Management navigation */}
        <section>

          <h2 className="text-xl font-semibold mb-5">
            Platform Management
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {managementCards.map((card) => (
              <button
                key={card.title}
                onClick={() => router.push(card.route)}
                className={`text-left bg-slate-900 border ${card.color} rounded-xl p-6 hover:bg-slate-800 hover:-translate-y-1 transition duration-200`}
              >

                <div className="flex items-center justify-between mb-4">

                  <span className="text-3xl">
                    {card.icon}
                  </span>

                  <span className="text-blue-400 text-xl">
                    →
                  </span>

                </div>

                <h3 className="text-lg font-semibold">
                  {card.title}
                </h3>

                <p className="text-sm text-slate-400 mt-2 leading-6">
                  {card.description}
                </p>

              </button>
            ))}

          </div>

        </section>

      </main>

    </div>
  );
}
