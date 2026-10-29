"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
        const token = localStorage.getItem("access_token");

        if (!token) {
          router.push("/login");
          return;
        }

        const response = await fetch(
          "http://127.0.0.1:8000/applications/recruiter-applications",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem("access_token");
            router.push("/login");
            return;
          }

          if (response.status === 403) {
            throw new Error(
              "Only recruiters can view recruiter applications."
            );
          }

          throw new Error(
            data.detail || "Failed to load applications."
          );
        }

        const detailedApplications = await Promise.all(
          data.map(async (application: {
            id: number;
            candidate_id: number;
            job_id: number;
            status: string;
            applied_at: string;
          }) => {
            const detailResponse = await fetch(
              `http://127.0.0.1:8000/applications/${application.id}`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            const detailData = await detailResponse.json();

            if (!detailResponse.ok) {
              throw new Error(
                detailData.detail ||
                  "Failed to load application details."
              );
            }

            return detailData;
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

      const response = await fetch(
        `http://127.0.0.1:8000/applications/${applicationId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }

        if (response.status === 403) {
          throw new Error(
            "You are not allowed to update this application."
          );
        }

        throw new Error(
          data.detail || "Failed to update application status."
        );
      }

      setApplications((currentApplications) =>
        currentApplications.map((application) =>
          application.id === applicationId
            ? { ...application, status: data.status }
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
              <strong>Job Type:</strong> {application.job_type}
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