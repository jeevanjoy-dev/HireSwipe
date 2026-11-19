
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/services/api";

interface JobReport {
  id: number;
  job_id: number;
  reason: string;
  description: string | null;
  status: "pending" | "under_review" | "resolved" | "dismissed";
  created_at: string;
  reviewed_at: string | null;
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  under_review: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  resolved: "bg-green-500/10 text-green-400 border-green-500/30",
  dismissed: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  under_review: "Under Review",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const reasonLabels: Record<string, string> = {
  fake: "Fake or fraudulent job",
  misleading: "Misleading job information",
  payment: "Requests payment or money",
  inappropriate: "Inappropriate content",
  duplicate: "Duplicate job posting",
  impersonation: "Company or recruiter impersonation",
  other: "Other",
};

export default function MyReportsPage() {
  const router = useRouter();

  const [reports, setReports] = useState<JobReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await apiRequest("/job-reports/my-reports");

        setReports(data as JobReport[]);
      } catch (err) {
        console.error("Failed to load reports:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load your reports."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <p className="text-slate-400">Loading your reports...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-5 text-sm text-slate-400 transition hover:text-white"
          >
            ← Back
          </button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">
                HireSwipe
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                My Reports
              </h1>

              <p className="mt-2 text-slate-400">
                Track the status of jobs you have reported.
              </p>
            </div>

            <button
              onClick={() => router.push("/jobs")}
              className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500"
            >
              Browse Jobs
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Summary */}
        {!error && (
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Total reports submitted
            </p>

            <p className="mt-2 text-3xl font-bold">
              {reports.length}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!error && reports.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-16 text-center">
            <div className="text-5xl">📋</div>

            <h2 className="mt-5 text-xl font-semibold">
              No reports yet
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
              You haven't reported any jobs. If you encounter a suspicious
              or misleading job posting, you can report it for our admin
              team to review.
            </p>

            <button
              onClick={() => router.push("/jobs")}
              className="mt-7 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold transition hover:bg-blue-500"
            >
              Explore Jobs
            </button>
          </div>
        )}

        {/* Report list */}
        {!error && reports.length > 0 && (
          <div className="space-y-5">
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Report #{report.id}
                    </p>

                    <h2 className="mt-2 text-lg font-semibold">
                      Job #{report.job_id}
                    </h2>

                    <p className="mt-2 text-sm text-slate-300">
                      {reasonLabels[report.reason] || report.reason}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full border px-4 py-2 text-xs font-semibold ${
                      statusStyles[report.status] ||
                      "border-slate-700 bg-slate-800 text-slate-300"
                    }`}
                  >
                    {statusLabels[report.status] || report.status}
                  </span>
                </div>

                {report.description && (
                  <div className="mt-5 rounded-lg bg-slate-800/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Your description
                    </p>

                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">
                      {report.description}
                    </p>
                  </div>
                )}

                <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-800 pt-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">
                      Submitted on
                    </p>

                    <p className="mt-1 text-sm text-slate-300">
                      {formatDate(report.created_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Last reviewed
                    </p>

                    <p className="mt-1 text-sm text-slate-300">
                      {report.reviewed_at
                        ? formatDate(report.reviewed_at)
                        : "Not reviewed yet"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
