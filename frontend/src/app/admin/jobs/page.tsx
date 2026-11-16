
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

// Job information shown in the jobs table.
interface Job {
  id: number;
  title: string;
  location: string | null;
  job_type: string;
  experience_min: number | null;
  experience_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  application_method: string;
  is_active: boolean;
  created_at: string;

  recruiter: {
    id: number;
    name: string;
    email: string;
  };

  company: {
    id: number;
    name: string;
  } | null;
}

// Complete job information shown in the details modal.
interface JobDetails extends Job {
  description: string;
  requirements: string | null;
  application_url: string | null;
  application_email: string | null;

  recruiter: {
    id: number;
    name: string;
    email: string;
    designation: string | null;
  };

  company: {
    id: number;
    name: string;
    website: string | null;
    location: string | null;
  } | null;
}

interface JobsResponse {
  total: number;
  skip: number;
  limit: number;
  jobs: Job[];
}

export default function AdminJobsPage() {
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedJob, setSelectedJob] =
    useState<JobDetails | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);

  const limit = 10;
  const totalPages = Math.ceil(total / limit);

  // Check admin access and load jobs.
  useEffect(() => {
    let cancelled = false;

    const loadJobs = async () => {
      setLoading(true);
      setError("");

      try {
        // Verify the logged-in user's role.
        const user = await apiRequest("/auth/me");

        if (user.role !== "admin") {
          router.replace("/login");
          return;
        }

        // Build the jobs API URL.
        const params = new URLSearchParams({
          skip: String(page * limit),
          limit: String(limit),
        });

        if (search.trim()) {
          params.append("search", search.trim());
        }

        const response: JobsResponse = await apiRequest(
          `/admin/jobs?${params.toString()}`
        );

        if (!cancelled) {
          setJobs(response.jobs);
          setTotal(response.total);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Jobs loading error:", err);
          setError("Unable to load jobs. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadJobs();

    return () => {
      cancelled = true;
    };
  }, [page, search, router]);

  // Fetch complete details for the selected job.
  const viewJobDetails = async (jobId: number) => {
    setDetailsLoading(true);
    setSelectedJob(null);
    setError("");

    try {
      const response: JobDetails = await apiRequest(
        `/admin/jobs/${jobId}`
      );

      setSelectedJob(response);
    } catch (err) {
      console.error("Job details error:", err);
      setError("Unable to load job details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  // Format dates for display.
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Format salary range.
  const formatSalary = (
    min: number | null,
    max: number | null
  ) => {
    if (min === null && max === null) {
      return "Not specified";
    }

    const formatAmount = (amount: number) =>
      `₹${amount.toLocaleString("en-IN")}`;

    if (min !== null && max !== null) {
      return `${formatAmount(min)} - ${formatAmount(max)}`;
    }

    if (min !== null) {
      return `From ${formatAmount(min)}`;
    }

    return `Up to ${formatAmount(max!)}`;
  };

  const formatExperience = (
    min: number | null,
    max: number | null
  ) => {
    if (min === null && max === null) {
      return "Not specified";
    }

    if (min !== null && max !== null) {
      return `${min} - ${max} years`;
    }

    if (min !== null) {
      return `${min}+ years`;
    }

    return `Up to ${max} years`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-5 md:p-8">

      {/* Page header */}
      <div className="max-w-7xl mx-auto">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">

          <div>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="text-sm text-slate-400 hover:text-blue-400 mb-3"
            >
              ← Back to Dashboard
            </button>

            <h1 className="text-3xl font-bold">
              Jobs Management
            </h1>

            <p className="text-slate-400 mt-2">
              View and monitor all jobs posted on HireSwipe.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
            <p className="text-sm text-slate-400">
              Total Jobs
            </p>
            <p className="text-2xl font-bold text-blue-400">
              {total}
            </p>
          </div>

        </div>

        {/* Search */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">

          <label className="block text-sm text-slate-400 mb-2">
            Search jobs
          </label>

          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by job title, recruiter or company..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500"
          />

        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-950/40 border border-red-800 text-red-300 rounded-lg p-4 mb-5">
            {error}
          </div>
        )}

        {/* Jobs table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">

          <div className="p-5 border-b border-slate-800">
            <h2 className="text-lg font-semibold">
              All Jobs
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              Loading jobs...
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No jobs found.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left min-w-[850px]">

                <thead className="bg-slate-950 text-slate-400 text-sm">
                  <tr>
                    <th className="p-4">Job</th>
                    <th className="p-4">Company</th>
                    <th className="p-4">Recruiter</th>
                    <th className="p-4">Job Type</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Posted</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="border-t border-slate-800 hover:bg-slate-800/40"
                    >
                      <td className="p-4">
                        <p className="font-medium">
                          {job.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Job ID: #{job.id}
                        </p>
                      </td>

                      <td className="p-4 text-sm text-slate-300">
                        {job.company?.name || "Not associated"}
                      </td>

                      <td className="p-4">
                        <p className="text-sm">
                          {job.recruiter.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {job.recruiter.email}
                        </p>
                      </td>

                      <td className="p-4 text-sm text-slate-300">
                        {job.job_type}
                      </td>

                      <td className="p-4">
                        {job.is_active ? (
                          <span className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs">
                            Active
                          </span>
                        ) : (
                          <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs">
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-sm text-slate-400">
                        {formatDate(job.created_at)}
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => viewJobDetails(job.id)}
                          className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && total > limit && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-5 border-t border-slate-800">

              <p className="text-sm text-slate-400">
                Showing {page * limit + 1} -{" "}
                {Math.min((page + 1) * limit, total)} of {total} jobs
              </p>

              <div className="flex gap-3">

                <button
                  disabled={page === 0}
                  onClick={() => setPage((prev) => prev - 1)}
                  className="px-4 py-2 rounded-lg bg-slate-800 disabled:opacity-40 hover:bg-slate-700"
                >
                  Previous
                </button>

                <span className="px-3 py-2 text-sm text-slate-400">
                  Page {page + 1} of {totalPages}
                </span>

                <button
                  disabled={(page + 1) * limit >= total}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="px-4 py-2 rounded-lg bg-slate-800 disabled:opacity-40 hover:bg-slate-700"
                >
                  Next
                </button>

              </div>
            </div>
          )}

        </div>
      </div>

      {/* Job details modal */}
      {(selectedJob || detailsLoading) && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">

          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">

            {detailsLoading ? (
              <div className="p-12 text-center text-slate-400">
                Loading job details...
              </div>
            ) : selectedJob && (
              <>
                <div className="flex justify-between items-start p-6 border-b border-slate-800">

                  <div>
                    <h2 className="text-2xl font-bold">
                      {selectedJob.title}
                    </h2>

                    <p className="text-slate-400 mt-2">
                      Job ID: #{selectedJob.id}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedJob(null)}
                    className="text-slate-400 hover:text-white text-2xl"
                    aria-label="Close job details"
                  >
                    ×
                  </button>

                </div>

                <div className="p-6 space-y-6">

                  {/* Status and basic information */}
                  <div className="flex flex-wrap gap-3">

                    <span className={`px-3 py-1 rounded-full text-sm ${
                      selectedJob.is_active
                        ? "bg-green-500/10 text-green-400"
                        : "bg-slate-700 text-slate-300"
                    }`}>
                      {selectedJob.is_active ? "Active" : "Inactive"}
                    </span>

                    <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-sm">
                      {selectedJob.job_type}
                    </span>

                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                    <div>
                      <p className="text-sm text-slate-500">
                        Location
                      </p>
                      <p className="mt-1">
                        {selectedJob.location || "Not specified"}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Experience Required
                      </p>
                      <p className="mt-1">
                        {formatExperience(
                          selectedJob.experience_min,
                          selectedJob.experience_max
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Salary
                      </p>
                      <p className="mt-1">
                        {formatSalary(
                          selectedJob.salary_min,
                          selectedJob.salary_max
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Application Method
                      </p>
                      <p className="mt-1">
                        {selectedJob.application_method}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-500">
                        Posted Date
                      </p>
                      <p className="mt-1">
                        {formatDate(selectedJob.created_at)}
                      </p>
                    </div>

                  </div>

                  {/* Description */}
                  <div>
                    <h3 className="font-semibold mb-2">
                      Job Description
                    </h3>
                    <p className="text-slate-300 whitespace-pre-wrap leading-7">
                      {selectedJob.description}
                    </p>
                  </div>

                  {/* Requirements */}
                  <div>
                    <h3 className="font-semibold mb-2">
                      Requirements
                    </h3>
                    <p className="text-slate-300 whitespace-pre-wrap leading-7">
                      {selectedJob.requirements || "No requirements specified."}
                    </p>
                  </div>

                  {/* Application information */}
                  <div>
                    <h3 className="font-semibold mb-3">
                      Application Information
                    </h3>

                    {selectedJob.application_url && (
                      <p className="text-sm text-slate-300 mb-2 break-all">
                        Application URL: {selectedJob.application_url}
                      </p>
                    )}

                    {selectedJob.application_email && (
                      <p className="text-sm text-slate-300 break-all">
                        Application Email: {selectedJob.application_email}
                      </p>
                    )}

                  </div>

                  {/* Recruiter information */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">

                    <h3 className="font-semibold mb-3">
                      Recruiter Information
                    </h3>

                    <p className="text-sm text-slate-300">
                      {selectedJob.recruiter.name}
                    </p>

                    <p className="text-sm text-slate-400 mt-1">
                      {selectedJob.recruiter.email}
                    </p>

                    <p className="text-sm text-slate-400 mt-1">
                      {selectedJob.recruiter.designation || "Designation not specified"}
                    </p>

                    <p className="text-xs text-slate-500 mt-2">
                      Recruiter ID: #{selectedJob.recruiter.id}
                    </p>

                  </div>

                  {/* Company information */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">

                    <h3 className="font-semibold mb-3">
                      Company Information
                    </h3>

                    {selectedJob.company ? (
                      <>
                        <p className="text-slate-300">
                          {selectedJob.company.name}
                        </p>

                        <p className="text-sm text-slate-400 mt-1">
                          {selectedJob.company.location || "Location not specified"}
                        </p>

                        {selectedJob.company.website && (
                          <p className="text-sm text-blue-400 mt-1 break-all">
                            {selectedJob.company.website}
                          </p>
                        )}

                        <p className="text-xs text-slate-500 mt-2">
                          Company ID: #{selectedJob.company.id}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">
                        No company associated with this recruiter.
                      </p>
                    )}

                  </div>

                </div>

                <div className="p-5 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500"
                  >
                    Close
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
