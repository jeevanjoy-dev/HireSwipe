
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

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
  moderation_status: string;
  moderation_reason: string | null;

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

interface JobDetails extends Job {
  description: string;
  requirements: string | null;
  application_url: string | null;
  application_email: string | null;
  moderated_at: string | null;
  moderated_by: number | null;

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

interface ReapprovalRequest {
  id: number;
  job_id: number;
  recruiter_id: number;
  status: "pending" | "approved" | "rejected";
  recruiter_message: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: number | null;

  job: {
    id: number;
    title: string;
    location: string | null;
    job_type: string;
    is_active: boolean;
    moderation_status: string;
    moderation_reason: string | null;
  };

  recruiter: {
    id: number;
    name: string;
    email: string;
    is_blocked: boolean;
    blocked_reason: string | null;
  };

  company: {
    id: number;
    name: string;
    verification_status: string;
  } | null;
}

interface ReviewResponse {
  message: string;
  request_id: number;
  job_id: number;
  request_status: string;
  moderation_status: string;
  is_active: boolean;
  admin_notes: string | null;
  reviewed_at: string;
}

type ModerationStatus = "hidden" | "deactivated";

interface ModerationResponse {
  message: string;
  job_id: number;
  moderation_status: string;
  is_active: boolean;
}

// --------------------------------------------------
// ADMIN JOBS PAGE
// --------------------------------------------------

export default function AdminJobsPage() {
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Job details modal
  const [selectedJob, setSelectedJob] =
    useState<JobDetails | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);

  // Reapproval requests
  const [reapprovalRequests, setReapprovalRequests] =
    useState<ReapprovalRequest[]>([]);

  const [reapprovalLoading, setReapprovalLoading] =
    useState(false);

  const [reviewingRequestId, setReviewingRequestId] =
    useState<number | null>(null);

  const [adminNotes, setAdminNotes] =
    useState<Record<number, string>>({});

  // Job moderation
  const [moderationStatus, setModerationStatus] =
    useState<ModerationStatus>("hidden");

  const [moderationReason, setModerationReason] =
    useState("");

  const [moderatingJob, setModeratingJob] =
    useState(false);

  const limit = 10;
  const totalPages = Math.ceil(total / limit);

  // --------------------------------------------------
  // LOAD JOBS
  // --------------------------------------------------

  const loadJobs = async () => {
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

    setJobs(response.jobs);
    setTotal(response.total);
  };

  // --------------------------------------------------
  // LOAD REAPPROVAL REQUESTS
  // --------------------------------------------------

  const loadReapprovalRequests = async () => {
    setReapprovalLoading(true);

    try {
      const response: ReapprovalRequest[] = await apiRequest(
        "/admin/job-reapproval-requests"
      );

      setReapprovalRequests(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load reapproval requests."
      );
    } finally {
      setReapprovalLoading(false);
    }
  };

  // --------------------------------------------------
  // INITIAL LOAD AND AUTHENTICATION
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setLoading(true);
      setError("");

      try {
        const user = await apiRequest("/auth/me");

        if (user.role !== "admin") {
          router.replace("/login");
          return;
        }

        const params = new URLSearchParams({
          skip: String(page * limit),
          limit: String(limit),
        });

        if (search.trim()) {
          params.append("search", search.trim());
        }

        const [jobsResponse, requestsResponse] = await Promise.all([
          apiRequest<JobsResponse>(
            `/admin/jobs?${params.toString()}`
          ),
          apiRequest<ReapprovalRequest[]>(
            "/admin/job-reapproval-requests"
          ),
        ]);

        if (!cancelled) {
          setJobs(jobsResponse.jobs);
          setTotal(jobsResponse.total);
          setReapprovalRequests(requestsResponse);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load admin data."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReapprovalLoading(false);
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [page, search, router]);

  // --------------------------------------------------
  // VIEW JOB DETAILS
  // --------------------------------------------------

  const viewJobDetails = async (jobId: number) => {
    setDetailsLoading(true);
    setSelectedJob(null);
    setError("");

    setModerationReason("");
    setModerationStatus("hidden");

    try {
      const response: JobDetails = await apiRequest(
        `/admin/jobs/${jobId}`
      );

      setSelectedJob(response);

      if (response.moderation_status === "hidden") {
        setModerationStatus("hidden");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load job details."
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  // --------------------------------------------------
  // REVIEW JOB REAPPROVAL REQUEST
  // --------------------------------------------------

  const reviewReapprovalRequest = async (
    requestId: number,
    decision: "approved" | "rejected"
  ) => {
    const confirmed = window.confirm(
      `Are you sure you want to ${decision} this job reapproval request?`
    );

    if (!confirmed) return;

    setReviewingRequestId(requestId);
    setError("");

    try {
      const response: ReviewResponse = await apiRequest(
        `/admin/job-reapproval-requests/${requestId}/review`,
        {
          method: "PUT",
          body: JSON.stringify({
            status: decision,
            admin_notes: adminNotes[requestId]?.trim() || null,
          }),
        }
      );

      window.alert(response.message);

      await Promise.all([
        loadReapprovalRequests(),
        loadJobs(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to review this request."
      );
    } finally {
      setReviewingRequestId(null);
    }
  };

  // --------------------------------------------------
  // MODERATE JOB
  // --------------------------------------------------

  const moderateJob = async () => {
    if (!selectedJob) return;

    const reason = moderationReason.trim();

    if (!reason) {
      setError("Please enter a reason for moderation.");
      return;
    }

    if (reason.length > 3000) {
      setError("Reason cannot exceed 3000 characters.");
      return;
    }

    const actionLabel =
      moderationStatus === "hidden"
        ? "hide"
        : "permanently deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} this job?`
    );

    if (!confirmed) return;

    setModeratingJob(true);
    setError("");

    try {
      const response: ModerationResponse = await apiRequest(
        `/admin/jobs/${selectedJob.id}/moderation`,
        {
          method: "PUT",
          body: JSON.stringify({
            moderation_status: moderationStatus,
            reason: reason,
          }),
        }
      );

      window.alert(
        response.message || "Job moderation completed successfully."
      );

      setModerationReason("");
      setSelectedJob(null);

      await loadJobs();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to moderate this job."
      );
    } finally {
      setModeratingJob(false);
    }
  };

  // --------------------------------------------------
  // FORMAT HELPERS
  // --------------------------------------------------

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatSalary = (
    min: number | null,
    max: number | null
  ) => {
    if (min === null && max === null) return "Not specified";

    const formatAmount = (amount: number) =>
      `₹${amount.toLocaleString("en-IN")}`;

    if (min !== null && max !== null) {
      return `${formatAmount(min)} - ${formatAmount(max)}`;
    }

    if (min !== null) return `From ${formatAmount(min)}`;

    return `Up to ${formatAmount(max!)}`;
  };

  const formatExperience = (
    min: number | null,
    max: number | null
  ) => {
    if (min === null && max === null) return "Not specified";

    if (min !== null && max !== null) {
      return `${min} - ${max} years`;
    }

    if (min !== null) return `${min}+ years`;

    return `Up to ${max} years`;
  };

  // --------------------------------------------------
  // JSX
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-950 text-white p-5 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* PAGE HEADER */}

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
              View, monitor and moderate all jobs posted on HireSwipe.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
            <p className="text-sm text-slate-400">Total Jobs</p>
            <p className="text-2xl font-bold text-blue-400">
              {total}
            </p>
          </div>
        </div>

        {/* ERROR MESSAGE */}

        {error && (
          <div className="bg-red-950/40 border border-red-800 text-red-300 rounded-lg p-4 mb-5">
            {error}
          </div>
        )}

        {/* ==========================================
            JOB REAPPROVAL REQUESTS
        ========================================== */}

        <div className="bg-slate-900 border border-slate-800 rounded-xl mb-6">
          <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Job Reapproval Requests
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                Review jobs submitted by recruiters for reapproval.
              </p>
            </div>

            <button
              onClick={loadReapprovalRequests}
              disabled={reapprovalLoading}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm disabled:opacity-50"
            >
              {reapprovalLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {reapprovalLoading ? (
            <div className="p-8 text-center text-slate-400">
              Loading reapproval requests...
            </div>
          ) : reapprovalRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No job reapproval requests found.
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {reapprovalRequests.map((request) => (
                <div
                  key={request.id}
                  className="border border-slate-700 rounded-xl p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {request.job.title}
                      </h3>

                      <p className="text-sm text-slate-400 mt-1">
                        Request ID: #{request.id} · Job ID: #{request.job_id}
                      </p>

                      <p className="text-xs text-slate-500 mt-1">
                        Submitted: {formatDate(request.created_at)}
                      </p>
                    </div>

                    <span
                      className={`h-fit px-3 py-1 rounded-full text-xs font-medium ${
                        request.status === "pending"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : request.status === "approved"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {request.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 rounded-lg p-4">
                    <div>
                      <p className="text-xs text-slate-500">Location</p>
                      <p className="text-sm mt-1">
                        {request.job.location || "Not specified"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Job Type</p>
                      <p className="text-sm mt-1">
                        {request.job.job_type}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Moderation Status
                      </p>
                      <p className="text-sm mt-1">
                        {request.job.moderation_status}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Company</p>
                      <p className="text-sm mt-1">
                        {request.company?.name || "Not associated"}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-950 rounded-lg p-4">
                    <h4 className="text-sm font-semibold mb-2">
                      Recruiter Information
                    </h4>

                    <p className="text-sm text-slate-300">
                      {request.recruiter.name}
                    </p>

                    <p className="text-sm text-slate-400 mt-1">
                      {request.recruiter.email}
                    </p>

                    {request.recruiter.is_blocked && (
                      <div className="mt-3">
                        <p className="text-sm text-red-400">
                          This recruiter is currently blocked.
                        </p>

                        {request.recruiter.blocked_reason && (
                          <p className="text-xs text-red-300 mt-1">
                            Reason: {request.recruiter.blocked_reason}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2">
                      Company Verification
                    </h4>

                    <p className="text-sm text-slate-300">
                      {request.company
                        ? request.company.verification_status
                        : "Company not found"}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2">
                      Recruiter's Message
                    </h4>

                    <p className="text-sm text-slate-300 whitespace-pre-wrap bg-slate-950 rounded-lg p-3">
                      {request.recruiter_message || "No message provided."}
                    </p>
                  </div>

                  {request.job.moderation_reason && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">
                        Previous Moderation Reason
                      </h4>

                      <p className="text-sm text-red-300 bg-red-950/30 rounded-lg p-3">
                        {request.job.moderation_reason}
                      </p>
                    </div>
                  )}

                  {request.status === "pending" && (
                    <div className="border-t border-slate-700 pt-4">
                      <label className="block text-sm text-slate-400 mb-2">
                        Admin Notes
                      </label>

                      <textarea
                        value={adminNotes[request.id] || ""}
                        onChange={(e) =>
                          setAdminNotes((prev) => ({
                            ...prev,
                            [request.id]: e.target.value,
                          }))
                        }
                        rows={3}
                        maxLength={3000}
                        placeholder="Enter feedback or reason for your decision..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500"
                      />

                      <div className="flex flex-wrap gap-3 mt-4">
                        <button
                          onClick={() =>
                            reviewReapprovalRequest(request.id, "approved")
                          }
                          disabled={
                            reviewingRequestId !== null ||
                            request.recruiter.is_blocked ||
                            request.company?.verification_status !== "verified"
                          }
                          className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {reviewingRequestId === request.id
                            ? "Processing..."
                            : "Approve"}
                        </button>

                        <button
                          onClick={() =>
                            reviewReapprovalRequest(request.id, "rejected")
                          }
                          disabled={reviewingRequestId !== null}
                          className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Reject
                        </button>
                      </div>

                      {(request.recruiter.is_blocked ||
                        request.company?.verification_status !== "verified") && (
                        <p className="text-xs text-yellow-400 mt-3">
                          Approval is unavailable because the recruiter is blocked
                          or the company is not verified.
                        </p>
                      )}
                    </div>
                  )}

                  {request.status !== "pending" && (
                    <div className="border-t border-slate-700 pt-4">
                      <p className="text-sm text-slate-400">
                        Admin Notes: {request.admin_notes || "No notes provided."}
                      </p>

                      {request.reviewed_at && (
                        <p className="text-xs text-slate-500 mt-2">
                          Reviewed: {formatDate(request.reviewed_at)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* JOB SEARCH */}

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

        {/* ALL JOBS TABLE */}

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800">
            <h2 className="text-lg font-semibold">All Jobs</h2>
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
              <table className="w-full text-left min-w-[950px]">
                <thead className="bg-slate-950 text-slate-400 text-sm">
                  <tr>
                    <th className="p-4">Job</th>
                    <th className="p-4">Company</th>
                    <th className="p-4">Recruiter</th>
                    <th className="p-4">Job Type</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Moderation</th>
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
                        <p className="font-medium">{job.title}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Job ID: #{job.id}
                        </p>
                      </td>

                      <td className="p-4 text-sm text-slate-300">
                        {job.company?.name || "Not associated"}
                      </td>

                      <td className="p-4">
                        <p className="text-sm">{job.recruiter.name}</p>
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

                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs ${
                            job.moderation_status === "normal"
                              ? "bg-green-500/10 text-green-400"
                              : job.moderation_status === "deactivated"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-yellow-500/10 text-yellow-400"
                          }`}
                        >
                          {job.moderation_status || "normal"}
                        </span>
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

          {/* PAGINATION */}

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

      {/* ==========================================
          JOB DETAILS AND MODERATION MODAL
      ========================================== */}

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

                  {/* STATUS */}

                  <div className="flex flex-wrap gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${
                        selectedJob.is_active
                          ? "bg-green-500/10 text-green-400"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {selectedJob.is_active ? "Active" : "Inactive"}
                    </span>

                    <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-sm">
                      {selectedJob.job_type}
                    </span>

                    <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-sm">
                      {selectedJob.moderation_status}
                    </span>
                  </div>

                  {/* BASIC INFORMATION */}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <p className="text-sm text-slate-500">Location</p>
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
                      <p className="text-sm text-slate-500">Salary</p>
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
                      <p className="text-sm text-slate-500">Posted Date</p>
                      <p className="mt-1">
                        {formatDate(selectedJob.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* DESCRIPTION */}

                  <div>
                    <h3 className="font-semibold mb-2">Job Description</h3>
                    <p className="text-slate-300 whitespace-pre-wrap leading-7">
                      {selectedJob.description}
                    </p>
                  </div>

                  {/* REQUIREMENTS */}

                  <div>
                    <h3 className="font-semibold mb-2">Requirements</h3>
                    <p className="text-slate-300 whitespace-pre-wrap leading-7">
                      {selectedJob.requirements || "No requirements specified."}
                    </p>
                  </div>

                  {/* APPLICATION INFORMATION */}

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

                  {/* RECRUITER INFORMATION */}

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

                  {/* COMPANY INFORMATION */}

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

                  {/* JOB MODERATION */}

                  <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-5 space-y-4">
                    <div>
                      <h3 className="font-semibold text-red-400">
                        Job Moderation
                      </h3>

                      <p className="text-sm text-slate-400 mt-1">
                        Hide or permanently deactivate this job and provide
                        a reason for the recruiter.
                      </p>
                    </div>

                    {selectedJob.moderation_reason && (
                      <div className="bg-slate-950 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">
                          Current moderation reason
                        </p>

                        <p className="text-sm text-red-300 whitespace-pre-wrap">
                          {selectedJob.moderation_reason}
                        </p>
                      </div>
                    )}

                    {selectedJob.moderation_status === "deactivated" ? (
                      <p className="text-sm text-red-400">
                        This job has been permanently deactivated.
                        It cannot be moderated again through this action.
                      </p>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm text-slate-400 mb-2">
                            Moderation Action
                          </label>

                          <select
                            value={moderationStatus}
                            onChange={(e) =>
                              setModerationStatus(
                                e.target.value as ModerationStatus
                              )
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white"
                          >
                            <option value="hidden">
                              Hide Job — Allow Reapproval
                            </option>

                            <option value="deactivated">
                              Permanently Deactivate Job
                            </option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm text-slate-400 mb-2">
                            Reason for Moderation *
                          </label>

                          <textarea
                            value={moderationReason}
                            onChange={(e) =>
                              setModerationReason(e.target.value)
                            }
                            rows={4}
                            maxLength={3000}
                            placeholder="Explain why this job is being moderated..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-red-500"
                          />

                          <p className="text-xs text-slate-500 mt-1">
                            {moderationReason.length}/3000 characters
                          </p>
                        </div>

                        <button
                          onClick={moderateJob}
                          disabled={
                            moderatingJob ||
                            !moderationReason.trim()
                          }
                          className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {moderatingJob
                            ? "Processing..."
                            : moderationStatus === "hidden"
                            ? "Hide Job"
                            : "Deactivate Job"}
                        </button>
                      </>
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
