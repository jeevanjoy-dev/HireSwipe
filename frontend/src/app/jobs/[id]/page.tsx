"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

interface Application {
  id: number;
  candidate_id: number;
  job_id: number;
  job_title: string;
  job_location: string | null;
  job_type: string;
  status: string;
  applied_at: string;
}

interface ApplicationSummary {
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

/**
 * Display applications submitted to the recruiter's jobs.
 */
export default function RecruiterApplicationsPage() {
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    /**
     * Load applications belonging to the authenticated recruiter.
     */
    async function loadApplications() {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("access_token");

        if (!token) {
          router.push("/login");
          return;
        }

        const data: ApplicationSummary[] = await apiRequest(
          "/applications/recruiter-applications"
        );

        const detailedApplications = await Promise.all(
          data.map(async (application) => {
            return await apiRequest(
              `/applications/${application.id}`
            );
          })
        );

        setApplications(detailedApplications);
      } catch (error) {
        console.error("Applications loading error:", error);

        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Failed to load applications.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadApplications();
  }, [router]);

  /**
   * Update the status of a recruiter's application.
   */
  async function updateStatus(
    applicationId: number,
    status: string
  ) {
    try {
      setUpdatingId(applicationId);
      setError("");

      const token = localStorage.getItem("access_token");

      if (!token) {
        router.push("/login");
        return;
      }

      const data = await apiRequest(
        `/applications/${applicationId}/status`,
        {
          method: "PUT",
          body: JSON.stringify({
            status,
          }),
        }
      );

      setApplications((currentApplications) =>
        currentApplications.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                status: data.status,
              }
            : application
        )
      );
    } catch (error) {
      console.error("Status update error:", error);

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to update application status.");
      }
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return <p>Loading applications...</p>;
  }

  if (error && applications.length === 0) {
    return <p>{error}</p>;
  }

  return (
    <main>
      <h1>Recruiter Applications</h1>

      {error && <p>{error}</p>}

      {applications.length === 0 ? (
        <p>No applications found for your jobs.</p>
      ) : (
        applications.map((application) => (
          <section key={application.id}>
            <h2>{application.job_title}</h2>

            <p>
              <strong>Candidate ID:</strong>{" "}
              {application.candidate_id}
            </p>

            <p>
              <strong>Location:</strong>{" "}
              {application.job_location || "Not specified"}
            </p>

            <p>
              <strong>Job Type:</strong>{" "}
              {application.job_type}
            </p>

            <p>
              <strong>Current Status:</strong>{" "}
              {application.status}
            </p>

            <p>
              <strong>Applied:</strong>{" "}
              {new Date(
                application.applied_at
              ).toLocaleDateString()}
            </p>

            <label>
              Update Status:{" "}
              <select
                value={application.status}
                disabled={updatingId === application.id}
                onChange={(event) =>
                  updateStatus(
                    application.id,
                    event.target.value
                  )
                }
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <hr />
          </section>
        ))
      )}

      <button onClick={() => router.push("/dashboard")}>
        Back to Dashboard
      </button>
    </main>
  );
}