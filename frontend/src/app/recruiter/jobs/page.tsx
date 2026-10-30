"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
 * Display jobs posted by the authenticated recruiter.
 */
export default function RecruiterJobsPage() {
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    /**
     * Load jobs belonging to the authenticated recruiter.
     *
     * Returns:
     *     None. Updates the jobs, loading, and error state.
     */
    async function loadJobs() {
      try {
        setLoading(true);
        setError("");

        const data: Job[] = await apiRequest("/jobs/my-jobs", {
          method: "GET",
        });

        setJobs(data);
      } catch (error) {
        console.error("Recruiter jobs loading error:", error);

        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Failed to load your jobs.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadJobs();
  }, []);

  /**
   * Delete a job posted by the authenticated recruiter.
   *
   * Args:
   *     jobId: ID of the job to delete.
   *
   * Returns:
   *     None. Removes the deleted job from the page.
   *
   * Raises:
   *     Error: If the delete request fails.
   */
  async function handleDelete(jobId: number) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this job?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(jobId);
      setError("");

      await apiRequest(`/jobs/${jobId}`, {
        method: "DELETE",
      });

      setJobs((currentJobs) =>
        currentJobs.filter((job) => job.id !== jobId)
      );
    } catch (error) {
      console.error("Job deletion error:", error);

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to delete job.");
      }
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl">
          <p>Loading your jobs...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Jobs</h1>

          <button
            onClick={() => router.push("/recruiter/jobs/create")}
            className="rounded-md bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
          >
            Post New Job
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-600">
            {error}
          </div>
        )}

        {jobs.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
            <h2 className="mb-2 text-xl font-semibold">
              No jobs posted yet
            </h2>

            <p className="mb-4 text-gray-600">
              Create your first job posting to start receiving applications.
            </p>

            <button
              onClick={() => router.push("/recruiter/jobs/create")}
              className="rounded-md bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
            >
              Post a Job
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-lg border bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {job.title}
                    </h2>

                    <p className="mt-1 text-gray-600">
                      📍 {job.location || "Location not specified"}
                    </p>
                  </div>

                  <span
                    className={
                      job.is_active
                        ? "rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
                        : "rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600"
                    }
                  >
                    {job.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mb-4 grid gap-2 text-gray-700 md:grid-cols-3">
                  <p>
                    <strong>Type:</strong> {job.job_type}
                  </p>

                  <p>
                    <strong>Experience:</strong>{" "}
                    {job.experience_min !== null &&
                    job.experience_max !== null
                      ? `${job.experience_min} - ${job.experience_max} years`
                      : job.experience_min !== null
                        ? `${job.experience_min}+ years`
                        : job.experience_max !== null
                          ? `Up to ${job.experience_max} years`
                          : "Not specified"}
                  </p>

                  <p>
                    <strong>Salary:</strong>{" "}
                    {job.salary_min !== null
                      ? `₹${job.salary_min}`
                      : "Not specified"}{" "}
                    -{" "}
                    {job.salary_max !== null
                      ? `₹${job.salary_max}`
                      : "Not specified"}
                  </p>
                </div>

                <p className="mb-4 text-gray-700">
                  {job.description}
                </p>

                {job.requirements && (
                  <p className="mb-4 text-gray-700">
                    <strong>Requirements:</strong> {job.requirements}
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      router.push(`/recruiter/jobs/${job.id}/edit`)
                    }
                    className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => router.push(`/jobs/${job.id}`)}
                    className="rounded-md border px-4 py-2 hover:bg-gray-50"
                  >
                    View
                  </button>

                  <button
                    onClick={() => handleDelete(job.id)}
                    disabled={deletingId === job.id}
                    className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === job.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => router.push("/dashboard")}
          className="mt-8 rounded-md border px-5 py-2 hover:bg-white"
        >
          Back to Dashboard
        </button>
      </div>
    </main>
  );
}