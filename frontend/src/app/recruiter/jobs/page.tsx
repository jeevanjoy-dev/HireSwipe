
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

export default function RecruiterJobsPage() {
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]); // Stores jobs posted by the authenticated recruiter
  const [loading, setLoading] = useState(true); // Tracks the initial jobs loading state
  const [deletingId, setDeletingId] = useState<number | null>(null); // Tracks the job currently being deleted
  const [error, setError] = useState(""); // Stores API and deletion errors

  useEffect(() => {
    // Fetches all jobs belonging to the authenticated recruiter
    async function loadJobs() {
      try {
        setLoading(true);
        setError("");

        const data: Job[] = await apiRequest("/jobs/my-jobs", {
          method: "GET",
        });

        setJobs(data); // Updates the jobs list with backend data
      } catch (error) {
        console.error("Recruiter jobs loading error:", error);

        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Failed to load your jobs.");
        }
      } finally {
        setLoading(false); // Stops the loading indicator after the request finishes
      }
    }

    loadJobs();
  }, []);

  // Deletes a job after confirmation and removes it from the displayed list
  async function handleDelete(jobId: number) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this job?"
    );

    if (!confirmed) {
      return; // Cancels deletion if the recruiter does not confirm
    }

    try {
      setDeletingId(jobId);
      setError("");

      await apiRequest(`/jobs/${jobId}`, {
        method: "DELETE",
      });

      setJobs((currentJobs) =>
        currentJobs.filter((job) => job.id !== jobId) // Removes only the deleted job from the UI
      );
    } catch (error) {
      console.error("Job deletion error:", error);

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to delete job.");
      }
    } finally {
      setDeletingId(null); // Clears the deleting state
    }
  }

  // Loading screen displayed while recruiter jobs are being fetched
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">
            Loading your jobs...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-8">

          <div>
            <div className="flex items-center gap-2 text-sm text-blue-400 mb-3">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Recruiter Workspace
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              My Jobs
            </h1>

            <p className="text-slate-400 mt-2 text-sm sm:text-base">
              Manage your job postings, track availability and edit job details.
            </p>
          </div>

          <button
            onClick={() => router.push("/recruiter/jobs/create")} // Opens the existing job creation page
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition"
          >
            <span className="text-lg leading-none">+</span>
            Post New Job
          </button>
        </div>

        {/* Job Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">

          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-lg">
            <p className="text-sm text-slate-400">
              Total Jobs
            </p>
            <p className="text-3xl font-bold mt-2">
              {jobs.length} {/* Displays the total number of posted jobs */}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              All your job postings
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-lg">
            <p className="text-sm text-slate-400">
              Active Jobs
            </p>
            <p className="text-3xl font-bold text-emerald-400 mt-2">
              {jobs.filter((job) => job.is_active).length} {/* Counts active job postings */}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Currently available to candidates
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-lg">
            <p className="text-sm text-slate-400">
              Inactive Jobs
            </p>
            <p className="text-3xl font-bold text-slate-300 mt-2">
              {jobs.filter((job) => !job.is_active).length} {/* Counts inactive job postings */}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Currently unavailable to candidates
            </p>
          </div>

        </div>

        {/* Jobs Section Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-semibold">
              Your Job Postings
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              View, edit or remove your job listings.
            </p>
          </div>

          <span className="w-fit rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400">
            {jobs.length} Jobs
          </span>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Empty Jobs State */}
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 sm:p-14 text-center shadow-lg">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-slate-800 flex items-center justify-center text-3xl">
              📋
            </div>

            <h2 className="text-xl font-semibold mb-2">
              No jobs posted yet
            </h2>

            <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
              Create your first job posting to start receiving applications
              from candidates.
            </p>

            <button
              onClick={() => router.push("/recruiter/jobs/create")} // Opens job creation from the empty state
              className="rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition shadow-lg shadow-blue-600/20"
            >
              + Post a Job
            </button>
          </div>
        ) : (

          /* Displays all recruiter jobs as responsive cards */
          <div className="grid grid-cols-1 gap-5">
            {jobs.map((job) => (
              <section
                key={job.id} // Uses the unique job ID as the React list key
                className="group rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/70 p-5 sm:p-6 shadow-lg hover:border-blue-500/40 transition-all duration-200"
              >

                {/* Job Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">

                  <div className="min-w-0">
                    <div className="text-xs text-slate-500 font-medium mb-2">
                      JOB ID #{job.id}
                    </div>

                    <h3 className="text-xl sm:text-2xl font-semibold text-white group-hover:text-blue-400 transition-colors break-words">
                      {job.title}
                    </h3>

                    <p className="mt-2 text-sm text-slate-400">
                      <span className="text-blue-400 mr-2">📍</span>
                      {job.location || "Location not specified"}
                    </p>
                  </div>

                  {/* Indicates whether candidates can currently apply for this job */}
                  <span
                    className={
                      job.is_active
                        ? "w-fit rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400"
                        : "w-fit rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-400"
                    }
                  >
                    <span className="mr-1.5">●</span>
                    {job.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Job Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-xs text-slate-500 mb-2">
                      Job Type
                    </p>
                    <p className="text-sm font-medium text-slate-200">
                      {job.job_type}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-xs text-slate-500 mb-2">
                      Experience
                    </p>
                    <p className="text-sm font-medium text-slate-200">
                      {job.experience_min !== null &&
                      job.experience_max !== null
                        ? `${job.experience_min} - ${job.experience_max} years`
                        : job.experience_min !== null
                          ? `${job.experience_min}+ years`
                          : job.experience_max !== null
                            ? `Up to ${job.experience_max} years`
                            : "Not specified"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-xs text-slate-500 mb-2">
                      Salary Range
                    </p>
                    <p className="text-sm font-medium text-slate-200">
                      {job.salary_min !== null
                        ? `₹${job.salary_min.toLocaleString("en-IN")}`
                        : "Not specified"}{" "}
                      -{" "}
                      {job.salary_max !== null
                        ? `₹${job.salary_max.toLocaleString("en-IN")}`
                        : "Not specified"}
                    </p>
                  </div>

                </div>

                {/* Job Description */}
                <div className="mb-5">
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">
                    Job Description
                  </h4>
                  <p className="text-sm text-slate-400 leading-6 whitespace-pre-line">
                    {job.description}
                  </p>
                </div>

                {/* Optional Job Requirements */}
                {job.requirements && (
                  <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">
                      Requirements
                    </h4>
                    <p className="text-sm text-slate-400 leading-6 whitespace-pre-line">
                      {job.requirements}
                    </p>
                  </div>
                )}

                {/* Job Action Buttons */}
                <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-5">

                  <button
                    onClick={() =>
                      router.push(`/recruiter/jobs/${job.id}/edit`) // Opens the existing edit page for this job
                    }
                    className="rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition"
                  >
                    Edit Job
                  </button>

                  <button
                    onClick={() => router.push(`/jobs/${job.id}`)} // Opens the public job details page
                    className="rounded-xl border border-slate-700 bg-slate-950 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
                  >
                    View Job
                  </button>

                  <button
                    onClick={() => handleDelete(job.id)} // Requests confirmation before deleting this job
                    disabled={deletingId === job.id} // Prevents repeated deletion requests for the same job
                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/20 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === job.id ? "Deleting..." : "Delete Job"}
                  </button>

                </div>
              </section>
            ))}
          </div>
        )}

        {/* Dashboard Navigation */}
        <div className="mt-8">
          <button
            onClick={() => router.push("/dashboard")} // Returns to the recruiter dashboard
            className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            ← Back to Dashboard
          </button>
        </div>

      </div>
    </main>
  );
}
