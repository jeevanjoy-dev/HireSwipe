
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, apiFileRequest } from "../../../services/api";

interface Application {
  id: number;
  candidate_id: number;
  job_id: number;
  status: string;
  applied_at: string;
}

const statuses = [
  "Applied",
  "Shortlisted",
  "Rejected",
  "Selected",
];

// Returns a different badge color for each application status.
function getStatusStyle(status: string) {
  switch (status) {
    case "Shortlisted":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "Selected":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "Rejected":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }
}

export default function RecruiterApplicationsPage() {
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>([]); // Stores applications received by the recruiter
  const [loading, setLoading] = useState(true); // Tracks application loading state
  const [error, setError] = useState(""); // Stores API and application errors
  const [updatingId, setUpdatingId] = useState<number | null>(null); // Tracks status updates
  const [viewingResumeId, setViewingResumeId] = useState<number | null>(null); // Tracks resume retrieval

  useEffect(() => {
    async function loadApplications() {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("access_token"); // Checks recruiter authentication

        if (!token) {
          router.push("/login");
          return;
        }

        const data: Application[] = await apiRequest(
          "/applications/recruiter-applications"
        ); // Fetches all applications directly without individual detail requests

        setApplications(data); // Stores the returned application records
      } catch (error) {
        console.error("Applications loading error:", error);

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load applications."
        );
      } finally {
        setLoading(false);
      }
    }

    loadApplications();
  }, [router]);

  // Updates an individual application's status through the backend.
  async function updateStatus(
    applicationId: number,
    status: string
  ) {
    try {
      setUpdatingId(applicationId);
      setError("");

      const token = localStorage.getItem("access_token"); // Checks recruiter authentication

      if (!token) {
        router.push("/login");
        return;
      }

      const data = await apiRequest(
        `/applications/${applicationId}/status`,
        {
          method: "PUT",
          body: JSON.stringify({ status }),
        }
      );

      setApplications((currentApplications) =>
        currentApplications.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                status: data.status, // Updates only the application whose status changed
              }
            : application
        )
      );
    } catch (error) {
      console.error("Status update error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to update application status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  /**
   * Retrieves and opens a candidate's submitted resume.
   * PDFs open in a new tab; DOCX files are downloaded.
   */
  async function handleViewResume(applicationId: number) {
    let previewWindow: Window | null = null;
    let objectUrl: string | null = null;

    try {
      setViewingResumeId(applicationId);
      setError("");

      const token = localStorage.getItem("access_token"); // Checks recruiter authentication

      if (!token) {
        router.push("/login");
        return;
      }

      previewWindow = window.open("", "_blank"); // Opens a blank tab immediately to avoid popup blocking

      if (!previewWindow) {
        throw new Error(
          "Your browser blocked the resume tab. Allow pop-ups and try again."
        );
      }

      previewWindow.document.title = "Loading resume...";
      previewWindow.document.body.innerHTML =
        "<p style='font-family: sans-serif; padding: 24px;'>Loading candidate resume...</p>";

      const blob = await apiFileRequest(
        `/applications/${applicationId}/resume`
      ); // Retrieves the resume with JWT authentication

      objectUrl = URL.createObjectURL(blob);

      if (blob.type === "application/pdf") {
        previewWindow.location.href = objectUrl; // Opens PDF resumes directly in the browser

        window.setTimeout(() => {
          if (objectUrl) URL.revokeObjectURL(objectUrl); // Releases the temporary PDF URL
        }, 60000);
      } else if (
        blob.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        previewWindow.close(); // Closes the blank tab because DOCX cannot be previewed natively

        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `candidate-resume-${applicationId}.docx`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.setTimeout(() => {
          if (objectUrl) URL.revokeObjectURL(objectUrl); // Releases the temporary DOCX URL
        }, 60000);
      } else {
        previewWindow.close();
        throw new Error("Unsupported resume format.");
      }
    } catch (error) {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close();
      }

      console.error("Resume retrieval error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to retrieve candidate resume."
      );

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    } finally {
      setViewingResumeId(null);
    }
  }

  // Displays a loading screen while applications are fetched.
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">
            Loading applications...
          </p>
        </div>
      </main>
    );
  }

  // Displays an error screen if the initial request fails.
  if (error && applications.length === 0) {
    return (
      <main className="min-h-screen bg-slate-950 text-white px-4 py-10">
        <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 text-2xl">
            !
          </div>

          <h2 className="text-xl font-semibold mb-2">
            Unable to load applications
          </h2>

          <p className="text-slate-400 text-sm mb-6">
            {error}
          </p>

          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
          >
            Try Again
          </button>
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
              Applications
            </h1>

            <p className="text-slate-400 mt-2 text-sm sm:text-base">
              Review candidates and manage applications received for your jobs.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-slate-600 text-slate-200 text-sm font-medium transition-all"
          >
            <span>←</span>
            Back to Dashboard
          </button>
        </div>

        {/* Application Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">

          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-lg">
            <p className="text-sm text-slate-400">
              Total Applications
            </p>
            <p className="text-3xl font-bold mt-2">
              {applications.length}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Applications received
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-lg">
            <p className="text-sm text-slate-400">
              Shortlisted
            </p>
            <p className="text-3xl font-bold text-blue-400 mt-2">
              {applications.filter((app) => app.status === "Shortlisted").length}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Candidates shortlisted
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-lg">
            <p className="text-sm text-slate-400">
              Selected
            </p>
            <p className="text-3xl font-bold text-emerald-400 mt-2">
              {applications.filter((app) => app.status === "Selected").length}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Candidates selected
            </p>
          </div>

        </div>

        {/* Application List Heading */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-semibold">
              Received Applications
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Manage and update candidate application status.
            </p>
          </div>

          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 w-fit">
            {applications.length} Applications
          </span>
        </div>

        {/* Shows errors without hiding already loaded applications */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Empty State */}
        {applications.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 sm:p-14 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-slate-800 flex items-center justify-center text-3xl">
              📄
            </div>

            <h3 className="text-xl font-semibold mb-2">
              No applications yet
            </h3>

            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Applications submitted to your job postings will appear here.
              You can review candidates and manage their application status.
            </p>
          </div>
        ) : (

          /* Application Cards */
          <div className="space-y-4">
            {applications.map((application) => (
              <section
                key={application.id}
                className="group rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/70 p-5 sm:p-6 shadow-lg hover:border-blue-500/40 transition-all duration-200"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">

                  {/* Job and Candidate Information */}
                  <div className="flex-1 min-w-0">

                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className="text-xs text-slate-500 font-medium">
                        APPLICATION #{application.id}
                      </span>

                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full border ${getStatusStyle(application.status)}`}
                      >
                        {application.status}
                      </span>
                    </div>

                    <h3 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors">
                      Job Application #{application.job_id}
                    </h3>

                    {/* Displays available application details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 mt-5">

                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          Candidate ID
                        </p>
                        <p className="text-sm text-slate-200 font-medium">
                          #{application.candidate_id}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          Job ID
                        </p>
                        <p className="text-sm text-slate-200">
                          #{application.job_id}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          Applied On
                        </p>
                        <p className="text-sm text-slate-200">
                          {new Date(application.applied_at).toLocaleDateString(
                            undefined,
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </p>
                      </div>

                    </div>

                    {/* Candidate Resume Access */}
                    <div className="mt-6 pt-5 border-t border-slate-800">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            Candidate Resume
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            View the resume submitted with this application.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleViewResume(application.id)}
                          disabled={viewingResumeId === application.id}
                          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {viewingResumeId === application.id ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              Retrieving Resume...
                            </>
                          ) : (
                            <>
                              <span>📄</span>
                              View Resume
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Application Status Management */}
                  <div className="w-full lg:w-64 shrink-0 lg:border-l lg:border-slate-800 lg:pl-6">

                    <label
                      htmlFor={`status-${application.id}`}
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Update Application Status
                    </label>

                    <select
                      id={`status-${application.id}`}
                      value={application.status}
                      disabled={updatingId === application.id}
                      onChange={(event) =>
                        updateStatus(
                          application.id,
                          event.target.value
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    {/* Shows progress while the backend processes the status update */}
                    {updatingId === application.id ? (
                      <p className="text-xs text-blue-400 mt-3 flex items-center gap-2">
                        <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        Updating status...
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 mt-3">
                        Change the status to update this application.
                      </p>
                    )}

                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
