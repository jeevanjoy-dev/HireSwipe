
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

type ReportStatus = "pending" | "under_review" | "resolved" | "dismissed";

interface JobReport {
  id: number;
  job_id: number;
  candidate_id: number;
  reason: string;
  description: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;

  candidate?: {
    id: number;
    name: string;
    email: string;
  };

  job?: {
    id: number;
    title: string;
    description?: string;
    location?: string;
    job_type?: string;
    is_active: boolean;
    moderation_status?: string;
    moderation_reason?: string | null;
  };

  recruiter?: {
    id: number;
    name: string;
    email: string;
    is_blocked: boolean;
    blocked_reason?: string | null;
  };

  company?: {
    id: number;
    name: string;
    verification_status?: string;
  };
}

interface ReportsResponse {
  total: number;
  skip: number;
  limit: number;
  reports: JobReport[];
}

const statusOptions: ReportStatus[] = [
  "pending",
  "under_review",
  "resolved",
  "dismissed",
];

const statusStyles: Record<ReportStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  under_review: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  resolved: "bg-green-500/10 text-green-500 border-green-500/30",
  dismissed: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

const formatStatus = (status: string) =>
  status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

const formatDate = (date?: string | null) => {
  if (!date) return "Not available";

  const parsed = new Date(date);

  return Number.isNaN(parsed.getTime())
    ? "Not available"
    : parsed.toLocaleString();
};

export default function AdminJobReportsPage() {
  const router = useRouter();

  const [reports, setReports] = useState<JobReport[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedReport, setSelectedReport] = useState<JobReport | null>(null);

  const [filterStatus, setFilterStatus] = useState("all");
  const [reviewStatus, setReviewStatus] =
    useState<ReportStatus>("under_review");
  const [adminNotes, setAdminNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const query = new URLSearchParams({
        skip: "0",
        limit: "100",
      });

      if (filterStatus !== "all") {
        query.set("status", filterStatus);
      }

      const response = (await apiRequest(
        `/job-reports/admin?${query.toString()}`
      )) as ReportsResponse;

      setReports(response.reports || []);
      setTotal(response.total || 0);
    } catch (err) {
      console.error("Failed to fetch job reports:", err);
      setError("Unable to load job reports. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const openReport = async (reportId: number) => {
    try {
      setDetailsLoading(true);
      setSelectedReport(null);
      setAdminNotes("");

      const response = (await apiRequest(
        `/job-reports/admin/${reportId}`
      )) as JobReport;

      setSelectedReport(response);
      setReviewStatus(
        response.status === "pending" ? "under_review" : response.status
      );
      setAdminNotes(response.admin_notes || "");
    } catch (err) {
      console.error("Failed to fetch report details:", err);
      alert("Unable to load report details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const submitReview = async () => {
    if (!selectedReport) return;

    if (
      selectedReport.status === "resolved" ||
      selectedReport.status === "dismissed"
    ) {
      alert("This report has already been finalized.");
      return;
    }

    if (
      reviewStatus !== "under_review" &&
      reviewStatus !== "resolved" &&
      reviewStatus !== "dismissed"
    ) {
      alert("Please select a valid review status.");
      return;
    }

    try {
      setReviewLoading(true);

      await apiRequest(
        `/job-reports/admin/${selectedReport.id}/review`,
        {
          method: "PUT",
          body: JSON.stringify({
            status: reviewStatus,
            admin_notes: adminNotes.trim() || null,
          }),
        }
      );

      alert("Report review updated successfully.");

      setSelectedReport(null);
      await fetchReports();
    } catch (err) {
      console.error("Failed to update report:", err);
      alert("Unable to update report. Please try again.");
    } finally {
      setReviewLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedReport(null);
    setAdminNotes("");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="text-sm text-gray-400 hover:text-white mb-3"
            >
              ← Back to Dashboard
            </button>

            <h1 className="text-3xl font-bold">Job Reports</h1>

            <p className="text-gray-400 mt-2">
              Review candidate reports and investigate suspicious job postings.
            </p>
          </div>

          <button
            onClick={fetchReports}
            className="px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-800"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statusOptions.map((status) => {
            const count = reports.filter(
              (report) => report.status === status
            ).length;

            return (
              <div
                key={status}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5"
              >
                <p className="text-gray-400 text-sm">
                  {formatStatus(status)}
                </p>
                <p className="text-2xl font-bold mt-2">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Reports list */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-gray-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Submitted Reports</h2>
              <p className="text-sm text-gray-400 mt-1">
                {total} total reports
              </p>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm"
            >
              <option value="all">All Reports</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-5 text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-10 text-center text-gray-400">
              Loading reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              No job reports found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-800/70 text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="p-4">Report ID</th>
                    <th className="p-4">Job ID</th>
                    <th className="p-4">Reason</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Submitted</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {reports.map((report) => (
                    <tr
                      key={report.id}
                      className="border-t border-gray-800 hover:bg-gray-800/40"
                    >
                      <td className="p-4 font-medium">#{report.id}</td>
                      <td className="p-4">#{report.job_id}</td>
                      <td className="p-4 capitalize">
                        {report.reason.replaceAll("_", " ")}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full border text-xs ${
                            statusStyles[report.status]
                          }`}
                        >
                          {formatStatus(report.status)}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">
                        {formatDate(report.created_at)}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => openReport(report.id)}
                          className="text-blue-400 hover:text-blue-300 font-medium"
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Report details modal */}
        {(detailsLoading || selectedReport) && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">

              {detailsLoading ? (
                <div className="p-12 text-center text-gray-400">
                  Loading report details...
                </div>
              ) : selectedReport ? (
                <>
                  <div className="p-6 border-b border-gray-800 flex justify-between items-start gap-4">
                    <div>
                      <h2 className="text-2xl font-bold">
                        Report #{selectedReport.id}
                      </h2>
                      <p className="text-gray-400 text-sm mt-1">
                        Submitted {formatDate(selectedReport.created_at)}
                      </p>
                    </div>

                    <button
                      onClick={closeDetails}
                      className="text-gray-400 hover:text-white text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-6 space-y-6">

                    {/* Report information */}
                    <section>
                      <h3 className="text-lg font-semibold mb-3">
                        Report Information
                      </h3>

                      <div className="bg-gray-800/60 rounded-xl p-4 space-y-3">
                        <p>
                          <span className="text-gray-400">Reason: </span>
                          <span className="capitalize">
                            {selectedReport.reason.replaceAll("_", " ")}
                          </span>
                        </p>

                        <p>
                          <span className="text-gray-400">Status: </span>
                          {formatStatus(selectedReport.status)}
                        </p>

                        <p>
                          <span className="text-gray-400">Description:</span>
                        </p>

                        <p className="text-gray-300 whitespace-pre-wrap">
                          {selectedReport.description || "No description provided."}
                        </p>
                      </div>
                    </section>

                    {/* Candidate information */}
                    <section>
                      <h3 className="text-lg font-semibold mb-3">
                        Reporting Candidate
                      </h3>

                      <div className="bg-gray-800/60 rounded-xl p-4 space-y-2">
                        <p>
                          <span className="text-gray-400">Name: </span>
                          {selectedReport.candidate?.name || "Not available"}
                        </p>
                        <p>
                          <span className="text-gray-400">Email: </span>
                          {selectedReport.candidate?.email || "Not available"}
                        </p>
                        <p>
                          <span className="text-gray-400">Candidate ID: </span>
                          {selectedReport.candidate?.id ?? selectedReport.candidate_id}
                        </p>
                      </div>
                    </section>

                    {/* Job information */}
                    <section>
                      <h3 className="text-lg font-semibold mb-3">
                        Reported Job
                      </h3>

                      <div className="bg-gray-800/60 rounded-xl p-4 space-y-2">
                        <p>
                          <span className="text-gray-400">Job title: </span>
                          {selectedReport.job?.title || "Not available"}
                        </p>
                        <p>
                          <span className="text-gray-400">Job ID: </span>
                          #{selectedReport.job_id}
                        </p>
                        <p>
                          <span className="text-gray-400">Location: </span>
                          {selectedReport.job?.location || "Not available"}
                        </p>
                        <p>
                          <span className="text-gray-400">Job type: </span>
                          {selectedReport.job?.job_type || "Not available"}
                        </p>
                        <p>
                          <span className="text-gray-400">Active: </span>
                          {selectedReport.job?.is_active ? "Yes" : "No"}
                        </p>
                        <p>
                          <span className="text-gray-400">Moderation status: </span>
                          {selectedReport.job?.moderation_status || "Not available"}
                        </p>

                        {selectedReport.job?.moderation_reason && (
                          <p>
                            <span className="text-gray-400">Moderation reason: </span>
                            {selectedReport.job.moderation_reason}
                          </p>
                        )}
                      </div>
                    </section>

                    {/* Recruiter information */}
                    <section>
                      <h3 className="text-lg font-semibold mb-3">
                        Recruiter Information
                      </h3>

                      <div className="bg-gray-800/60 rounded-xl p-4 space-y-2">
                        <p>
                          <span className="text-gray-400">Name: </span>
                          {selectedReport.recruiter?.name || "Not available"}
                        </p>
                        <p>
                          <span className="text-gray-400">Email: </span>
                          {selectedReport.recruiter?.email || "Not available"}
                        </p>
                        <p>
                          <span className="text-gray-400">Recruiter ID: </span>
                          {selectedReport.recruiter?.id ?? "Not available"}
                        </p>
                        <p>
                          <span className="text-gray-400">Blocked: </span>
                          {selectedReport.recruiter
                            ? selectedReport.recruiter.is_blocked
                              ? "Yes"
                              : "No"
                            : "Not available"}
                        </p>

                        {selectedReport.recruiter?.blocked_reason && (
                          <p>
                            <span className="text-gray-400">Block reason: </span>
                            {selectedReport.recruiter.blocked_reason}
                          </p>
                        )}
                      </div>
                    </section>

                    {/* Company information */}
                    <section>
                      <h3 className="text-lg font-semibold mb-3">
                        Company Information
                      </h3>

                      <div className="bg-gray-800/60 rounded-xl p-4 space-y-2">
                        <p>
                          <span className="text-gray-400">Company: </span>
                          {selectedReport.company?.name || "Not available"}
                        </p>
                        <p>
                          <span className="text-gray-400">Company ID: </span>
                          {selectedReport.company?.id ?? "Not available"}
                        </p>
                        <p>
                          <span className="text-gray-400">Verification: </span>
                          {selectedReport.company?.verification_status || "Not available"}
                        </p>
                      </div>
                    </section>

                    {/* Admin review */}
                    <section className="border-t border-gray-800 pt-6">
                      <h3 className="text-lg font-semibold mb-3">
                        Admin Investigation & Review
                      </h3>

                      <p className="text-sm text-gray-400 mb-4">
                        Admin notes are private and are not shown to the reporting
                        candidate or recruiter.
                      </p>

                      {selectedReport.status === "resolved" ||
                      selectedReport.status === "dismissed" ? (
                        <div className="bg-gray-800/60 rounded-xl p-4 space-y-3">
                          <p>
                            This report has been finalized as{" "}
                            <strong>
                              {formatStatus(selectedReport.status)}
                            </strong>.
                          </p>
                          <p className="text-gray-400 text-sm">
                            Reviewed at: {formatDate(selectedReport.reviewed_at)}
                          </p>
                          <p className="text-gray-400 text-sm">
                            Admin notes:
                          </p>
                          <p className="whitespace-pre-wrap">
                            {selectedReport.admin_notes || "No admin notes."}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">
                              Review Status
                            </label>

                            <select
                              value={reviewStatus}
                              onChange={(e) =>
                                setReviewStatus(e.target.value as ReportStatus)
                              }
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3"
                            >
                              <option value="under_review">Under Review</option>
                              <option value="resolved">Resolved</option>
                              <option value="dismissed">Dismissed</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm text-gray-400 mb-2">
                              Private Admin Notes
                            </label>

                            <textarea
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              rows={4}
                              maxLength={3000}
                              placeholder="Add investigation findings and internal notes..."
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 resize-y"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {adminNotes.length}/3000 characters
                            </p>
                          </div>

                          <button
                            onClick={submitReview}
                            disabled={reviewLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-5 py-3 font-semibold"
                          >
                            {reviewLoading ? "Saving Review..." : "Save Review"}
                          </button>
                        </div>
                      )}
                    </section>
                  </div>

                  <div className="p-6 border-t border-gray-800 flex justify-end">
                    <button
                      onClick={closeDetails}
                      className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
