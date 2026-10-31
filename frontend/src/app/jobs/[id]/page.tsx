"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

interface Job {
  id: number;
  title: string;
  description: string;
  location: string | null;
  job_type: string;
  experience_min: number | null;
  experience_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  requirements: string | null;
  is_active: boolean;
  created_at: string;
}

/**
 * Display details of a job and allow candidates to apply or save the job.
 */
export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    /**
     * Load the selected job and check whether the candidate has saved it.
     *
     * Returns:
     *     None. Updates job and saved state.
     */
    async function loadJob() {
      try {
        setLoading(true);
        setError("");
        setMessage("");

        const jobData = await apiRequest(
          `/jobs/${jobId}`,
          {
            method: "GET",
          }
        );

        setJob(jobData);

        const savedJobs = await apiRequest(
          "/saved-jobs/",
          {
            method: "GET",
          }
        );

        const alreadySaved = savedJobs.some(
          (savedJob: { id: number }) =>
            savedJob.id === Number(jobId)
        );

        setIsSaved(alreadySaved);
      } catch (error) {
        console.error("Job loading error:", error);

        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Failed to load job.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadJob();
  }, [jobId]);

  /**
   * Save or unsave the current job.
   *
   * Returns:
   *     None. Updates the saved state and status message.
   */
  async function handleSaveJob() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (isSaved) {
        await apiRequest(
          `/saved-jobs/${jobId}`,
          {
            method: "DELETE",
          }
        );

        setIsSaved(false);
        setMessage("Job removed from saved jobs.");
      } else {
        await apiRequest(
          `/saved-jobs/${jobId}`,
          {
            method: "POST",
          }
        );

        setIsSaved(true);
        setMessage("Job saved successfully.");
      }
    } catch (error) {
      console.error("Save job error:", error);

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to update saved job.");
      }
    } finally {
      setSaving(false);
    }
  }

  /**
   * Apply for the current job.
   *
   * Returns:
   *     None. Updates the status message.
   */
  async function handleApply() {
    try {
      setApplying(true);
      setError("");
      setMessage("");

      await apiRequest(
        "/applications/",
        {
          method: "POST",
          body: JSON.stringify({
            job_id: Number(jobId),
          }),
        }
      );

      setMessage("Application submitted successfully.");
    } catch (error) {
      console.error("Application error:", error);

      if (error instanceof Error) {
        if (error.message.includes("already applied")) {
          setError("You have already applied for this job.");
        } else {
          setError(error.message);
        }
      } else {
        setError("Failed to apply for this job.");
      }
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-slate-300">
            Loading job...
          </p>
        </div>
      </main>
    );
  }

  if (error && !job) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => router.push("/jobs")}
            className="mb-6 text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to Jobs
          </button>

          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-red-300">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-slate-300">
            Job not found.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">

        {/* Back Button */}
        <button
          onClick={() => router.push("/jobs")}
          className="mb-6 text-sm text-slate-400 transition hover:text-white"
        >
          ← Back to Jobs
        </button>

        {/* Job Card */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-lg">

          {/* Header */}
          <div className="flex flex-col justify-between gap-6 md:flex-row">
            <div>
              <h1 className="text-4xl font-bold">
                {job.title}
              </h1>

              <p className="mt-3 text-slate-400">
                📍 {job.location || "Location not specified"}
              </p>

              <p className="mt-2 text-slate-400">
                💼 {job.job_type}
              </p>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveJob}
              disabled={saving}
              className={`h-fit rounded-lg border px-6 py-3 font-semibold transition ${
                isSaved
                  ? "border-blue-500 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30"
                  : "border-slate-600 bg-slate-800 text-white hover:border-blue-500 hover:text-blue-400"
              }`}
            >
              {saving
                ? "Saving..."
                : isSaved
                ? "🔖 Saved"
                : "🔖 Save Job"}
            </button>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-300">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-6 rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-green-300">
              {message}
            </div>
          )}

          {/* Job Information */}
          <div className="mt-8 grid gap-4 md:grid-cols-3">

            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <p className="text-sm text-slate-400">
                Experience
              </p>

              <p className="mt-1 font-semibold">
                {job.experience_min !== null ||
                job.experience_max !== null
                  ? `${job.experience_min ?? 0} - ${
                      job.experience_max ?? "Any"
                    } years`
                  : "Not specified"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <p className="text-sm text-slate-400">
                Salary
              </p>

              <p className="mt-1 font-semibold">
                {job.salary_min !== null ||
                job.salary_max !== null
                  ? `₹${job.salary_min ?? 0} - ₹${
                      job.salary_max ?? "Negotiable"
                    }`
                  : "Not specified"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <p className="text-sm text-slate-400">
                Job Type
              </p>

              <p className="mt-1 font-semibold">
                {job.job_type}
              </p>
            </div>

          </div>

          {/* Description */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold">
              Job Description
            </h2>

            <p className="mt-4 whitespace-pre-line leading-7 text-slate-300">
              {job.description}
            </p>
          </div>

          {/* Requirements */}
          {job.requirements && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold">
                Requirements
              </h2>

              <p className="mt-4 whitespace-pre-line leading-7 text-slate-300">
                {job.requirements}
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-10 flex flex-col gap-3 border-t border-slate-700 pt-6 sm:flex-row">

            <button
              onClick={handleApply}
              disabled={applying || !job.is_active}
              className="rounded-lg bg-blue-600 px-8 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applying
                ? "Applying..."
                : job.is_active
                ? "Apply Now"
                : "Job Closed"}
            </button>

            <button
              onClick={handleSaveJob}
              disabled={saving}
              className={`rounded-lg border px-8 py-3 font-semibold transition ${
                isSaved
                  ? "border-blue-500 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30"
                  : "border-slate-600 text-slate-200 hover:border-blue-500 hover:text-blue-400"
              }`}
            >
              {saving
                ? "Saving..."
                : isSaved
                ? "🔖 Saved"
                : "🔖 Save Job"}
            </button>

          </div>

        </div>
      </div>
    </main>
  );
}