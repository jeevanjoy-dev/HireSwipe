
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

interface Candidate {
  id: number;
  user_id: number;
  name: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  profile_resume_available?: boolean;
}

interface Job {
  id: number;
  title: string;
  description?: string;
  location?: string | null;
  job_type: string;
  is_active?: boolean;
}

interface Recruiter {
  id: number;
  user_id?: number;
  name?: string;
  email?: string;
  designation?: string | null;
}

interface Company {
  id: number;
  name: string;
  location?: string | null;
  website?: string | null;
}

interface Application {
  id: number;
  status: string;
  is_archived: boolean;
  applied_at: string;
  has_resume: boolean;
  candidate: Candidate;
  job: Job;
  recruiter: Recruiter;
  company: Company | null;
}

interface ApplicationDetails extends Application {
  about_yourself?: string | null;
}

interface ApplicationsResponse {
  total: number;
  skip: number;
  limit: number;
  applications: Application[];
}

const PAGE_SIZE = 10;

export default function AdminApplicationsPage() {
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [archiveFilter, setArchiveFilter] = useState("all");

  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedApplication, setSelectedApplication] =
    useState<ApplicationDetails | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        skip: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (statusFilter.trim()) {
        params.set("application_status", statusFilter.trim());
      }

      if (archiveFilter !== "all") {
        params.set("is_archived", archiveFilter);
      }

      const response = await apiRequest<ApplicationsResponse>(
        `/admin/applications?${params.toString()}`
      );

      setApplications(response.applications);
      setTotal(response.total);
    } catch (err) {
      console.error("Applications loading error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load applications."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, archiveFilter]);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = await apiRequest<{ role: string }>("/auth/me");

        if (user.role !== "admin") {
          router.replace("/login");
          return;
        }

        fetchApplications();
      } catch (err) {
        console.error("Admin verification failed:", err);
        router.replace("/login");
      }
    };

    checkAdmin();
  }, [router, fetchApplications]);

  const openApplicationDetails = async (applicationId: number) => {
    try {
      setDetailsLoading(true);
      setSelectedApplication(null);

      const response = await apiRequest<ApplicationDetails>(
        `/admin/applications/${applicationId}`
      );

      setSelectedApplication(response);
    } catch (err) {
      console.error("Application details error:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Unable to load application details."
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const applyFilters = () => {
    setPage(0);
    fetchApplications();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="text-sm text-blue-400 hover:text-blue-300 mb-3"
            >
              ← Back to Dashboard
            </button>

            <h1 className="text-3xl font-bold">
              Applications Management
            </h1>

            <p className="text-slate-400 mt-2">
              Monitor candidate applications across HireSwipe.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-4">
            <p className="text-sm text-slate-400">
              Total Applications
            </p>
            <p className="text-3xl font-bold text-blue-400">
              {total}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

            <div className="md:col-span-2">
              <label className="block text-sm text-slate-400 mb-2">
                Search
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
                placeholder="Candidate, job title, company..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Application Status
              </label>
              <input
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
                placeholder="e.g. Applied"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Archive Status
              </label>
              <select
                value={archiveFilter}
                onChange={(e) => {
                  setArchiveFilter(e.target.value);
                  setPage(0);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="all">All Applications</option>
                <option value="false">Not Archived</option>
                <option value="true">Archived</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={applyFilters}
              className="bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg font-medium"
            >
              Apply Filters
            </button>

            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setArchiveFilter("all");
                setPage(0);
              }}
              className="bg-slate-800 hover:bg-slate-700 px-5 py-2.5 rounded-lg"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Applications Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              Loading applications...
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchApplications}
                className="bg-blue-600 px-5 py-2 rounded-lg"
              >
                Try Again
              </button>
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No applications found.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-800/70 text-slate-400 text-sm">
                    <tr>
                      <th className="p-4">Candidate</th>
                      <th className="p-4">Job</th>
                      <th className="p-4">Company</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Applied Date</th>
                      <th className="p-4">Resume</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {applications.map((application) => (
                      <tr
                        key={application.id}
                        className="border-t border-slate-800 hover:bg-slate-800/40"
                      >
                        <td className="p-4">
                          <p className="font-medium">
                            {application.candidate.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {application.candidate.email}
                          </p>
                        </td>

                        <td className="p-4">
                          <p className="font-medium">
                            {application.job.title}
                          </p>
                          <p className="text-xs text-slate-400">
                            {application.job.job_type}
                          </p>
                        </td>

                        <td className="p-4 text-sm text-slate-300">
                          {application.company?.name || "Not available"}
                        </td>

                        <td className="p-4">
                          <span className="inline-block px-3 py-1 rounded-full text-xs bg-blue-500/15 text-blue-400">
                            {application.status}
                          </span>

                          {application.is_archived && (
                            <p className="text-xs text-amber-400 mt-1">
                              Archived
                            </p>
                          )}
                        </td>

                        <td className="p-4 text-sm text-slate-400">
                          {formatDate(application.applied_at)}
                        </td>

                        <td className="p-4">
                          {application.has_resume ? (
                            <span className="text-green-400 text-sm">
                              Available
                            </span>
                          ) : (
                            <span className="text-slate-500 text-sm">
                              Not uploaded
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          <button
                            onClick={() =>
                              openApplicationDetails(application.id)
                            }
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

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-5 border-t border-slate-800">
                <p className="text-sm text-slate-400">
                  Showing {page * PAGE_SIZE + 1} to{" "}
                  {Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                </p>

                <div className="flex gap-3">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((previous) => previous - 1)}
                    className="px-4 py-2 rounded-lg bg-slate-800 disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="px-3 py-2 text-sm text-slate-400">
                    Page {page + 1} of {Math.max(totalPages, 1)}
                  </span>

                  <button
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((previous) => previous + 1)}
                    className="px-4 py-2 rounded-lg bg-slate-800 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Details Loading */}
      {detailsLoading && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-slate-900 rounded-xl p-8 text-slate-300">
            Loading application details...
          </div>
        </div>
      )}

      {/* Application Details Modal */}
      {selectedApplication && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setSelectedApplication(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-7">
              <div>
                <p className="text-sm text-blue-400">
                  Application #{selectedApplication.id}
                </p>
                <h2 className="text-2xl font-bold mt-1">
                  Application Details
                </h2>
              </div>

              <button
                onClick={() => setSelectedApplication(null)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Candidate */}
            <section className="mb-7">
              <h3 className="text-lg font-semibold mb-3">
                Candidate Information
              </h3>

              <div className="bg-slate-950 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Name</p>
                  <p>{selectedApplication.candidate.name}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p>{selectedApplication.candidate.email}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p>{selectedApplication.candidate.phone || "Not provided"}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Location</p>
                  <p>{selectedApplication.candidate.location || "Not provided"}</p>
                </div>
              </div>
            </section>

            {/* Job */}
            <section className="mb-7">
              <h3 className="text-lg font-semibold mb-3">
                Job Information
              </h3>

              <div className="bg-slate-950 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-slate-500">Job Title</p>
                  <p className="font-medium">
                    {selectedApplication.job.title}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Company</p>
                  <p>
                    {selectedApplication.company?.name || "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Job Location</p>
                  <p>
                    {selectedApplication.job.location || "Not specified"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Job Description</p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">
                    {selectedApplication.job.description || "Not available"}
                  </p>
                </div>
              </div>
            </section>

            {/* Recruiter */}
            <section className="mb-7">
              <h3 className="text-lg font-semibold mb-3">
                Recruiter Information
              </h3>

              <div className="bg-slate-950 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Recruiter</p>
                  <p>
                    {selectedApplication.recruiter.name || "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p>
                    {selectedApplication.recruiter.email || "Not available"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Designation</p>
                  <p>
                    {selectedApplication.recruiter.designation || "Not provided"}
                  </p>
                </div>
              </div>
            </section>

            {/* Application */}
            <section className="mb-7">
              <h3 className="text-lg font-semibold mb-3">
                Application Information
              </h3>

              <div className="bg-slate-950 rounded-xl p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <p className="text-blue-400">
                      {selectedApplication.status}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Applied Date</p>
                    <p>{formatDate(selectedApplication.applied_at)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Archived</p>
                    <p>
                      {selectedApplication.is_archived ? "Yes" : "No"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Application Resume
                    </p>
                    <p className={selectedApplication.has_resume ? "text-green-400" : "text-slate-400"}>
                      {selectedApplication.has_resume ? "Available" : "Not uploaded"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-2">
                    About Yourself
                  </p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">
                    {selectedApplication.about_yourself || "No additional information provided."}
                  </p>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedApplication(null)}
                className="bg-slate-800 hover:bg-slate-700 px-6 py-2.5 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
