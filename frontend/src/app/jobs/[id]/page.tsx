"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Job {
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
}

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadJob() {
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          setError("Please login to view this job.");
          return;
        }

        const response = await fetch(
          `http://127.0.0.1:8000/jobs/${params.id}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          console.error("Job API error:", response.status, data);

          if (response.status === 401) {
            throw new Error(
              "Your session has expired. Please login again."
            );
          }

          throw new Error(
            data.detail ||
              `Failed to load job. Status: ${response.status}`
          );
        }

        setJob(data);
      } catch (error) {
        console.error("Job loading error:", error);

        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Failed to load job.");
        }
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadJob();
    }
  }, [params.id]);

  async function handleApply() {
    setApplying(true);
    setMessage("");
    setError("");

    try {
      const token = localStorage.getItem("access_token");

      if (!token) {
        setError("Please login before applying for a job.");
        return;
      }

      const response = await fetch(
        "http://127.0.0.1:8000/applications/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            job_id: Number(params.id),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Your session has expired. Please login again."
          );
        }

        if (response.status === 403) {
          throw new Error(
            "Only candidates can apply for jobs."
          );
        }

        if (response.status === 409) {
          throw new Error(
            "You have already applied for this job."
          );
        }

        throw new Error(
          data.detail || "Failed to apply for this job."
        );
      }

      setMessage("Application submitted successfully.");
    } catch (error) {
      console.error("Application error:", error);

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to apply for this job.");
      }
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return <p>Loading job...</p>;
  }

  if (error && !job) {
    return <p>{error}</p>;
  }

  if (!job) {
    return <p>Job not found.</p>;
  }

  return (
    <main>
      <h1>{job.title}</h1>

      <p>
        <strong>Location:</strong>{" "}
        {job.location || "Not specified"}
      </p>

      <p>
        <strong>Job Type:</strong> {job.job_type}
      </p>

      <p>
        <strong>Experience:</strong>{" "}
        {job.experience_min ?? 0} years -{" "}
        {job.experience_max ?? "No maximum"} years
      </p>

      <p>
        <strong>Salary:</strong>{" "}
        {job.salary_min !== null
          ? `₹${job.salary_min}`
          : "Not specified"}{" "}
        -{" "}
        {job.salary_max !== null
          ? `₹${job.salary_max}`
          : "Not specified"}
      </p>

      <hr />

      <h2>Description</h2>
      <p>{job.description}</p>

      <h2>Requirements</h2>
      <p>
        {job.requirements || "No requirements specified."}
      </p>

      <button
        onClick={handleApply}
        disabled={applying || !job.is_active}
      >
        {applying ? "Applying..." : "Apply for Job"}
      </button>

      {message && <p>{message}</p>}

      {error && <p>{error}</p>}

      <br />

      <button onClick={() => router.push("/jobs")}>
        Back to Jobs
      </button>
    </main>
  );
}