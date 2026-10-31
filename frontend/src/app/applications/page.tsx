"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../services/api";

type Application = {
  id: number;
  candidate_id: number;
  job_id: number;
  status: string;
  applied_at: string;
};

type ApplicationDetail = {
  id: number;
  candidate_id: number;
  job_id: number;
  job_title: string;
  job_location: string | null;
  job_type: string;
  status: string;
  applied_at: string;
};

type ArchivedApplication = {
  id: number;
  candidate_id: number;
  job_id: number;
  job_title: string;
  job_location: string | null;
  job_type: string;
  status: string;
  applied_at: string;
};

type SavedJob = {
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
};

type Tab = "Saved" | "Applied" | "Interview" | "Archived";

/**
 * Display the candidate's saved, applied, interview, and archived jobs.
 */
export default function MyJobsPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("Applied");

  const [applications, setApplications] = useState<ApplicationDetail[]>([]);
  const [archivedApplications, setArchivedApplications] = useState<
    ArchivedApplication[]
  >([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [archivingId, setArchivingId] = useState<number | null>(null);

  useEffect(() => {
    /**
     * Load the candidate's applications and saved jobs.
     *
     * Returns:
     *     None. Updates application and saved-job state.
     */
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const applicationData: Application[] = await apiRequest(
          "/applications/my-applications",
          {
            method: "GET",
          }
        );

        const detailedApplications: ApplicationDetail[] = await Promise.all(
          applicationData.map(async (application) => {
            return await apiRequest(
              `/applications/${application.id}`,
              {
                method: "GET",
              }
            );
          })
        );

        setApplications(detailedApplications);

        try {
          const savedData: SavedJob[] = await apiRequest("/saved-jobs/", {
            method: "GET",
          });

          setSavedJobs(savedData);
        } catch (savedError) {
          console.error("Saved jobs loading error:", savedError);
          setSavedJobs([]);
        }

        try {
          const archivedData: ArchivedApplication[] = await apiRequest(
            "/applications/archived",
            {
              method: "GET",
            }
          );

          setArchivedApplications(archivedData);
        } catch (archivedError) {
          console.error("Archived applications loading error:", archivedError);
          setArchivedApplications([]);
        }
      } catch (error) {
        console.error("Applications loading error:", error);

        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Failed to load your jobs.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  /**
   * Archive a candidate application.
   *
   * Args:
   *     applicationId: ID of the application to archive.
   *
   * Returns:
   *     None. Updates the application lists after successful archiving.
   */
  async function handleArchive(applicationId: number) {
    try {
      setArchivingId(applicationId);
      setError("");

      await apiRequest(`/applications/${applicationId}/archive`, {
        method: "PUT",
      });

      const archivedApplication = applications.find(
        (application) => application.id === applicationId
      );

      setApplications((currentApplications) =>
        currentApplications.filter(
          (application) => application.id !== applicationId
        )
      );

      if (archivedApplication) {
        setArchivedApplications((currentArchived) => [
          ...currentArchived,
          {
            ...archivedApplication,
          },
        ]);
      }
    } catch (error) {
      console.error("Application archive error:", error);

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to archive application.");
      }
    } finally {
      setArchivingId(null);
    }
  }

  /**
   * Open a job detail page.
   *
   * Args:
   *     jobId: ID of the selected job.
   *
   * Returns:
   *     None. Navigates to the job detail page.
   */
  function viewJob(jobId: number) {
    router.push(`/jobs/${jobId}`);
  }

  const interviewApplications = applications.filter(
    (application) =>
      application.status === "Shortlisted" ||
      application.status === "Interview"
  );

  const statusClasses: Record<string, string> = {
    Applied:
      "bg-blue-500/20 text-blue-300 border border-blue-400/30",
    Shortlisted:
      "bg-purple-500/20 text-purple-300 border border-purple-400/30",
    Interview:
      "bg-purple-500/20 text-purple-300 border border-purple-400/30",
    Selected:
      "bg-green-500/20 text-green-300 border border-green-400/30",
    Rejected:
      "bg-red-500/20 text-red-300 border border-red-400/30",
  };

  function getStatusClass(status: string) {
    return (
      statusClasses[status] ||
      "bg-gray-500/20 text-gray-300 border border-gray-400/30"
    );
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function renderApplicationCard(application: ApplicationDetail) {
    return (
      <div
        key={application.id}
        className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-sm transition hover:border-blue-400/30 hover:bg-white/[0.07]"
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">
              {application.job_title}
            </h3>

            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-400">
              <span>
                📍 {application.job_location || "Location not specified"}
              </span>

              <span>💼 {application.job_type}</span>

              <span>
                Applied {formatDate(application.applied_at)}
              </span>
            </div>
          </div>

          <span
            className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${getStatusClass(
              application.status
            )}`}
          >
            {application.status}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => viewJob(application.job_id)}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white transition hover:from-blue-500 hover:to-purple-500"
          >
            View Job
          </button>

          <button
            onClick={() => handleArchive(application.id)}
            disabled={archivingId === application.id}
            className="rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {archivingId === application.id
              ? "Archiving..."
              : "Archive"}
          </button>
        </div>
      </div>
    );
  }

  function renderArchivedCard(application: ArchivedApplication) {
    return (
      <div
        key={application.id}
        className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-sm"
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">
              {application.job_title}
            </h3>

            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-400">
              <span>
                📍 {application.job_location || "Location not specified"}
              </span>

              <span>💼 {application.job_type}</span>

              <span>
                Applied {formatDate(application.applied_at)}
              </span>
            </div>
          </div>

          <span className="w-fit rounded-full border border-gray-400/20 bg-gray-500/20 px-3 py-1 text-sm text-gray-300">
            Archived
          </span>
        </div>

        <div className="mt-5">
          <button
            onClick={() => viewJob(application.job_id)}
            className="rounded-lg border border-blue-400/30 bg-blue-500/10 px-5 py-2.5 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20"
          >
            View Job
          </button>
        </div>
      </div>
    );
  }

  function renderSavedJobCard(job: SavedJob) {
    return (
      <div
        key={job.id}
        className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-sm transition hover:border-blue-400/30 hover:bg-white/[0.07]"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">
              {job.title}
            </h3>

            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-400">
              <span>
                📍 {job.location || "Location not specified"}
              </span>

              <span>💼 {job.job_type}</span>
            </div>
          </div>

          <span className="w-fit rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-sm text-blue-300">
            Saved
          </span>
        </div>

        <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-400">
          {job.description}
        </p>

        <div className="mt-5">
          <button
            onClick={() => viewJob(job.id)}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-medium text-white transition hover:from-blue-500 hover:to-purple-500"
          >
            View Job
          </button>
        </div>
      </div>
    );
  }

  function renderEmptyState(title: string, description: string) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-2xl">
          📂
        </div>

        <h3 className="text-lg font-semibold text-white">{title}</h3>

        <p className="mt-2 text-sm text-gray-400">{description}</p>
      </div>
    );
  }

  function renderActiveContent() {
    if (activeTab === "Saved") {
      if (savedJobs.length === 0) {
        return renderEmptyState(
          "No saved jobs yet",
          "Save interesting jobs and they will appear here."
        );
      }

      return (
        <div className="grid gap-5">
          {savedJobs.map((job) => renderSavedJobCard(job))}
        </div>
      );
    }

    if (activeTab === "Interview") {
      if (interviewApplications.length === 0) {
        return renderEmptyState(
          "No interview applications",
          "Applications shortlisted for interviews will appear here."
        );
      }

      return (
        <div className="grid gap-5">
          {interviewApplications.map((application) =>
            renderApplicationCard(application)
          )}
        </div>
      );
    }

    if (activeTab === "Archived") {
      if (archivedApplications.length === 0) {
        return renderEmptyState(
          "No archived applications",
          "Applications you archive will appear here."
        );
      }

      return (
        <div className="grid gap-5">
          {archivedApplications.map((application) =>
            renderArchivedCard(application)
          )}
        </div>
      );
    }

    if (applications.length === 0) {
      return renderEmptyState(
        "No applications yet",
        "Jobs you apply for will appear here."
      );
    }

    return (
      <div className="grid gap-5">
        {applications.map((application) =>
          renderApplicationCard(application)
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090d1a] px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <button
            onClick={() => router.push("/dashboard")}
            className="mb-8 text-sm text-blue-400 transition hover:text-blue-300"
          >
            ← Back to Dashboard
          </button>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-blue-500" />

            <p className="mt-4 text-gray-400">
              Loading your jobs...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090d1a] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="mb-6 text-sm text-blue-400 transition hover:text-blue-300"
          >
            ← Back to Dashboard
          </button>

          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
              CANDIDATE PORTAL
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              My Jobs
            </h1>

            <p className="mt-3 max-w-2xl text-gray-400">
              Manage your saved, applied, interview, and archived jobs.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["Saved", "Applied", "Interview", "Archived"] as Tab[]).map(
            (tab) => {
              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={
                    isActive
                      ? "rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/10 transition"
                      : "rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-gray-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                  }
                >
                  {tab}
                </button>
              );
            }
          )}
        </div>

        {/* Section */}
        <div>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                {activeTab}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {activeTab === "Saved" &&
                  "Jobs you saved for later."}

                {activeTab === "Applied" &&
                  "Track the jobs you have applied for."}

                {activeTab === "Interview" &&
                  "Applications that have progressed to the interview stage."}

                {activeTab === "Archived" &&
                  "Applications you have moved out of your active list."}
              </p>
            </div>

            <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-400 sm:block">
              {activeTab === "Saved" && `${savedJobs.length} saved`}
              {activeTab === "Applied" &&
                `${applications.length} applications`}
              {activeTab === "Interview" &&
                `${interviewApplications.length} interviews`}
              {activeTab === "Archived" &&
                `${archivedApplications.length} archived`}
            </div>
          </div>

          {renderActiveContent()}
        </div>

        {/* Browse Jobs */}
        <div className="mt-10 rounded-2xl border border-blue-400/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Looking for more opportunities?
              </h3>

              <p className="mt-1 text-sm text-gray-400">
                Browse available jobs and find your next opportunity.
              </p>
            </div>

            <button
              onClick={() => router.push("/jobs")}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:from-blue-500 hover:to-purple-500"
            >
              Browse Jobs
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}