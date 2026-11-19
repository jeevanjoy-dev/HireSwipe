
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/services/api";

interface Job {
  id: number;
  title: string;
  description: string;
  location: string;
  job_type: string;
  experience_min: number;
  experience_max: number;
  salary_min?: number | null;
  salary_max?: number | null;
  requirements?: string[] | string | null;
  is_active: boolean;
  created_at: string;
  application_method: "Platform" | "Email" | "External";
  application_url?: string | null;
  application_email?: string | null;
}

type ReportReason =
  | "fake"
  | "misleading"
  | "payment"
  | "inappropriate"
  | "duplicate"
  | "impersonation"
  | "other";

const reportReasons: { value: ReportReason; label: string }[] = [
  { value: "fake", label: "Fake or fraudulent job" },
  { value: "misleading", label: "Misleading job information" },
  { value: "payment", label: "Requests payment or money" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "duplicate", label: "Duplicate job posting" },
  { value: "impersonation", label: "Company or recruiter impersonation" },
  { value: "other", label: "Other" },
];

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const jobId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Report states
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason | "">("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);
  const [hasReported, setHasReported] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await apiRequest(`/jobs/${jobId}`);

        setJob(data as Job);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading the job."
        );
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  /**
   * Handles applications according to the recruiter's selected method.
   */
  const handleApply = () => {
    if (!job) return;

    setMessage("");
    setError("");

    if (job.application_method === "Platform") {
      router.push(`/jobs/${jobId}/apply`);
      return;
    }

    if (job.application_method === "Email") {
      if (!job.application_email) {
        setError("The recruiter has not provided an application email.");
        return;
      }

      const subject = `Application for ${job.title}`;

      const body = `Dear Hiring Team,

I am interested in applying for the ${job.title} position at your organization.

I believe my skills and experience make me a suitable candidate for this position.

Please find my resume attached for your consideration.

Thank you for your time.

Best regards,
[Your Name]`;

      const gmailUrl = new URL("https://mail.google.com/mail/");

      gmailUrl.searchParams.set("view", "cm");
      gmailUrl.searchParams.set("fs", "1");
      gmailUrl.searchParams.set("to", job.application_email);
      gmailUrl.searchParams.set("su", subject);
      gmailUrl.searchParams.set("body", body);

      window.open(
        gmailUrl.toString(),
        "_blank",
        "noopener,noreferrer"
      );

      return;
    }

    if (job.application_method === "External") {
      if (!job.application_url) {
        setError("The recruiter has not provided an application URL.");
        return;
      }

      try {
        const applicationUrl = new URL(job.application_url);

        if (
          applicationUrl.protocol !== "http:" &&
          applicationUrl.protocol !== "https:"
        ) {
          throw new Error("Invalid application URL.");
        }

        window.location.assign(applicationUrl.toString());
      } catch {
        setError("The external application URL is invalid.");
      }
    }
  };

  /**
   * Open the report modal.
   */
  const handleOpenReport = () => {
    setReportError("");
    setReportSuccess(false);
    setReportReason("");
    setReportDescription("");
    setShowReportModal(true);
  };

  /**
   * Submit a job report to the backend.
   */
  const handleSubmitReport = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setReportError("");

    if (!reportReason) {
      setReportError("Please select a reason for reporting this job.");
      return;
    }

    const description = reportDescription.trim();

    if (description.length > 2000) {
      setReportError("Description cannot exceed 2000 characters.");
      return;
    }

    try {
      setReportSubmitting(true);

      await apiRequest("/job-reports/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: Number(jobId),
          reason: reportReason,
          description: description || null,
        }),
      });

      setReportSuccess(true);
      setHasReported(true);
      setShowReportModal(false);
      setReportDescription("");
      setReportReason("");
    } catch (err) {
      console.error("Job report submission error:", err);

      const errorMessage =
        err instanceof Error ? err.message : "";

      if (
        errorMessage.toLowerCase().includes("already reported") ||
        errorMessage.toLowerCase().includes("already reported this job") ||
        errorMessage.includes("409")
      ) {
        setHasReported(true);
        setReportError("You have already reported this job.");
      } else {
        setReportError(
          errorMessage || "Failed to submit your report. Please try again."
        );
      }
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <p className="text-slate-400">Loading job details...</p>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6">
        <p className="text-red-400 mb-5">{error}</p>

        <button
          onClick={() => router.push("/jobs")}
          className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
        >
          Back to Jobs
        </button>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white px-5 py-10">
      <div className="max-w-4xl mx-auto">

        {/* Back button */}
        <button
          onClick={() => router.push("/jobs")}
          className="mb-8 text-sm text-slate-400 hover:text-white transition"
        >
          ← Back to Jobs
        </button>

        {/* Job details */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8">

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {job.title}
              </h1>

              <p className="mt-2 text-slate-400">
                {job.location}
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-4 py-1.5 text-sm ${
                job.is_active
                  ? "bg-green-500/10 text-green-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {job.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          {/* Job information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-8">

            <div className="rounded-lg bg-slate-800/70 p-4">
              <p className="text-sm text-slate-400">Job Type</p>
              <p className="mt-1 font-medium">{job.job_type}</p>
            </div>

            <div className="rounded-lg bg-slate-800/70 p-4">
              <p className="text-sm text-slate-400">Experience</p>
              <p className="mt-1 font-medium">
                {job.experience_min}–{job.experience_max} years
              </p>
            </div>

            {job.salary_min != null && job.salary_max != null && (
              <div className="rounded-lg bg-slate-800/70 p-4">
                <p className="text-sm text-slate-400">Salary</p>
                <p className="mt-1 font-medium">
                  ₹{job.salary_min.toLocaleString("en-IN")} – ₹
                  {job.salary_max.toLocaleString("en-IN")}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mt-9">
            <h2 className="text-lg font-semibold">Job Description</h2>

            <p className="mt-3 whitespace-pre-line leading-7 text-slate-300">
              {job.description}
            </p>
          </div>

          {/* Requirements */}
          {job.requirements && (
            <div className="mt-9">
              <h2 className="text-lg font-semibold">Requirements</h2>

              {Array.isArray(job.requirements) ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-300">
                  {job.requirements.map((requirement, index) => (
                    <li key={index}>{requirement}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 whitespace-pre-line leading-7 text-slate-300">
                  {job.requirements}
                </p>
              )}
            </div>
          )}

          {/* Application method */}
          <div className="mt-9 border-t border-slate-800 pt-6">
            <h2 className="text-lg font-semibold">How to Apply</h2>

            <p className="mt-2 text-sm text-slate-400">
              Application method:{" "}
              <span className="font-medium text-blue-400">
                {job.application_method}
              </span>
            </p>

            {job.application_method === "Platform" && (
              <p className="mt-2 text-sm text-slate-400">
                Apply directly through HireSwipe. Your application will be
                tracked in your HireSwipe account.
              </p>
            )}

            {job.application_method === "Email" && (
              <p className="mt-2 text-sm text-slate-400">
                Gmail will open with the recruiter's email address and
                application message prefilled. Remember to attach your
                resume before sending.
              </p>
            )}

            {job.application_method === "External" && (
              <p className="mt-2 text-sm text-slate-400">
                You will be redirected to the company's external application
                website to complete your application.
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <p className="mt-5 text-sm text-red-400">{error}</p>
          )}

          {message && (
            <p className="mt-5 text-sm text-green-400">{message}</p>
          )}

          {/* Apply button */}
          <div className="mt-8">
            <button
              onClick={handleApply}
              disabled={!job.is_active}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {job.application_method === "Platform"
                ? "Apply Through HireSwipe"
                : job.application_method === "Email"
                ? "Apply Through Email"
                : "Apply on Company Website"}
            </button>

            {!job.is_active && (
              <p className="mt-3 text-center text-sm text-red-400">
                This job is currently inactive.
              </p>
            )}
          </div>

          {/* Report Job */}
          <div className="mt-6 border-t border-slate-800 pt-5">
            {reportSuccess || hasReported ? (
              <p className="text-center text-sm text-slate-400">
                You have already submitted a report for this job.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleOpenReport}
                className="w-full rounded-xl border border-red-500/40 px-6 py-3 font-medium text-red-400 transition hover:bg-red-500/10 hover:border-red-500"
              >
                Report this Job
              </button>
            )}

            {reportSuccess && (
              <p className="mt-3 text-center text-sm text-green-400">
                Your report has been submitted successfully. Our admin team
                will review it.
              </p>
            )}

            {reportError && !showReportModal && (
              <p className="mt-3 text-center text-sm text-red-400">
                {reportError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Report Job Modal */}
      {showReportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={(event) => {
            if (event.target === event.currentTarget && !reportSubmitting) {
              setShowReportModal(false);
            }
          }}
        >
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">

            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">
                  Report this Job
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Help us keep HireSwipe safe by telling us what's wrong.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                disabled={reportSubmitting}
                className="text-slate-400 hover:text-white text-xl disabled:opacity-50"
                aria-label="Close report modal"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmitReport}
              className="mt-6 space-y-5"
            >
              {/* Reason */}
              <div>
                <label
                  htmlFor="reportReason"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Reason for reporting
                </label>

                <select
                  id="reportReason"
                  value={reportReason}
                  onChange={(event) =>
                    setReportReason(event.target.value as ReportReason | "")
                  }
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-blue-500"
                >
                  <option value="">Select a reason</option>

                  {reportReasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="reportDescription"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Additional details{" "}
                  <span className="text-slate-500">(Optional)</span>
                </label>

                <textarea
                  id="reportDescription"
                  value={reportDescription}
                  onChange={(event) =>
                    setReportDescription(event.target.value)
                  }
                  rows={5}
                  maxLength={2000}
                  placeholder="Explain why you think this job should be reviewed..."
                  className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800 p-4 text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
                />

                <p className="mt-2 text-right text-xs text-slate-500">
                  {reportDescription.length}/2000
                </p>
              </div>

              {/* Modal error */}
              {reportError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                  {reportError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  disabled={reportSubmitting}
                  className="rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={reportSubmitting || !reportReason}
                  className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reportSubmitting ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
