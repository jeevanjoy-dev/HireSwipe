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

/**
 * Display the authenticated user's HireSwipe dashboard.
 */
export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    /**
     * Load the authenticated user's information.
     */
    async function loadUser() {
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          router.push("/login");
          return;
        }

        const data: User = await apiRequest("/auth/me", {
          method: "GET",
        });

        setUser(data);
      } catch (error) {
        console.error("Dashboard loading error:", error);

        localStorage.removeItem("access_token");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [router]);

  /**
   * Log out the current user.
   */
  function handleLogout() {
    localStorage.removeItem("access_token");
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const isCandidate = user.role === "candidate";
  const isRecruiter = user.role === "recruiter";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-2xl font-bold tracking-tight"
          >
            <span className="text-blue-500">Hire</span>
            <span className="text-white">Swipe</span>
          </button>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Welcome section */}
        <section className="mb-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-blue-400">
            Dashboard
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Welcome, {user.name}
          </h1>

          <p className="mt-2 text-slate-400">
            Manage your HireSwipe account and continue your journey.
          </p>
        </section>

        {/* User information */}
        <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-1 text-sm text-slate-500">Signed in as</p>

              <h2 className="text-xl font-semibold text-white">
                {user.email}
              </h2>
            </div>

            <div className="rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400">
              {user.role}
            </div>
          </div>
        </section>

        {/* Candidate dashboard */}
        {isCandidate && (
          <section>
            <div className="mb-5">
              <h2 className="text-2xl font-bold">Candidate Portal</h2>

              <p className="mt-1 text-slate-400">
                Find jobs, manage your profile, and track your applications.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {/* Profile */}
              <button
                onClick={() => router.push("/profile")}
                className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:-translate-y-1 hover:border-blue-500/50 hover:bg-slate-800"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-2xl">
                  👤
                </div>

                <h3 className="text-lg font-semibold">
                  My Profile
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  View and update your candidate profile.
                </p>

                <p className="mt-5 text-sm font-medium text-blue-400">
                  Open Profile →
                </p>
              </button>

              {/* Jobs */}
              <button
                onClick={() => router.push("/jobs")}
                className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:-translate-y-1 hover:border-blue-500/50 hover:bg-slate-800"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-2xl">
                  💼
                </div>

                <h3 className="text-lg font-semibold">
                  Browse Jobs
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Search and discover jobs that match your skills.
                </p>

                <p className="mt-5 text-sm font-medium text-green-400">
                  Find Jobs →
                </p>
              </button>

              {/* Applications */}
              <button
                onClick={() => router.push("/applications")}
                className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:-translate-y-1 hover:border-blue-500/50 hover:bg-slate-800"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-2xl">
                  📋
                </div>

                <h3 className="text-lg font-semibold">
                  My Applications
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Track the status of jobs you have applied for.
                </p>

                <p className="mt-5 text-sm font-medium text-purple-400">
                  View Applications →
                </p>
              </button>
            </div>
          </section>
        )}

        {/* Recruiter dashboard */}
        {isRecruiter && (
          <section>
            <div className="mb-5">
              <h2 className="text-2xl font-bold">Recruiter Portal</h2>

              <p className="mt-1 text-slate-400">
                Manage your jobs and review candidates.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {/* My Jobs */}
              <button
                onClick={() => router.push("/recruiter/jobs")}
                className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:-translate-y-1 hover:border-blue-500/50 hover:bg-slate-800"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-2xl">
                  💼
                </div>

                <h3 className="text-lg font-semibold">
                  My Jobs
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  View, edit, and delete your job postings.
                </p>

                <p className="mt-5 text-sm font-medium text-blue-400">
                  Manage Jobs →
                </p>
              </button>

              {/* Post Job */}
              <button
                onClick={() => router.push("/recruiter/jobs/create")}
                className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:-translate-y-1 hover:border-green-500/50 hover:bg-slate-800"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-2xl">
                  ➕
                </div>

                <h3 className="text-lg font-semibold">
                  Post a Job
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Create a new job posting and start receiving applications.
                </p>

                <p className="mt-5 text-sm font-medium text-green-400">
                  Create Job →
                </p>
              </button>

              {/* Applications */}
              <button
                onClick={() => router.push("/recruiter/applications")}
                className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:-translate-y-1 hover:border-purple-500/50 hover:bg-slate-800"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-2xl">
                  👥
                </div>

                <h3 className="text-lg font-semibold">
                  Applications
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Review candidates and update application statuses.
                </p>

                <p className="mt-5 text-sm font-medium text-purple-400">
                  View Candidates →
                </p>
              </button>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-16 border-t border-slate-800 pt-6 text-center">
          <p className="text-sm text-slate-500">
            HireSwipe • Connecting talent with opportunity
          </p>
        </footer>
      </div>
    </main>
  );
}