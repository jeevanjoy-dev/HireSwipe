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

/**
 * Display the authenticated candidate's submitted job applications.
 */
export default function ApplicationsPage() {
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    /**
     * Load the candidate's applications from the FastAPI backend.
     */
    async function loadApplications() {
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          router.push("/login");
          return;
        }

        const response = await fetch(
          "http://127.0.0.1:8000/applications/my-applications",
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

          throw new Error(
            data.detail || "Failed to load applications."
          );
        }

        /*
         * The list endpoint returns application IDs and basic data.
         * Fetch each application's detailed information to get job details.
         */
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
                detailData.detail || "Failed to load application details."
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

  if (loading) {
    return <p>Loading applications...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <main>
      <h1>My Applications</h1>

      {applications.length === 0 ? (
        <p>You have not applied for any jobs yet.</p>
      ) : (
        applications.map((application) => (
          <section key={application.id}>
            <h2>{application.job_title}</h2>

            <p>
              <strong>Location:</strong>{" "}
              {application.job_location || "Not specified"}
            </p>

            <p>
              <strong>Job Type:</strong> {application.job_type}
            </p>

            <p>
              <strong>Status:</strong> {application.status}
            </p>

            <p>
              <strong>Applied:</strong>{" "}
              {new Date(application.applied_at).toLocaleDateString()}
            </p>

            <hr />
          </section>
        ))
      )}

      <button onClick={() => router.push("/jobs")}>
        Browse Jobs
      </button>
    </main>
  );
}