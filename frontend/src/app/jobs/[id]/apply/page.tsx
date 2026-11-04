
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../../services/api";

interface Job {
  id: number;
  title: string;
  location: string | null;
  job_type: string;
  application_method: "Platform" | "Email" | "External";
}

/**
 * Display the application form for candidates applying through HireSwipe.
 */
export default function JobApplicationPage() {
  const params = useParams();
  const router = useRouter();

  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [aboutYourself, setAboutYourself] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    /**
     * Load job details before displaying the application form.
     */
    async function loadJob() {
      try {
        setLoading(true);
        setError("");

        const jobData: Job = await apiRequest(`/jobs/${jobId}`, {
          method: "GET",
        });

        if (jobData.application_method !== "Platform") {
          router.replace(`/jobs/${jobId}`);
          return;
        }

        setJob(jobData);
      } catch (error) {
        console.error("Job loading error:", error);

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load job details."
        );
      } finally {
        setLoading(false);
      }
    }

    if (jobId) {
      loadJob();
    }
  }, [jobId, router]);

  /**
   * Submit the candidate's introduction as a job application.
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    const introduction = aboutYourself.trim();

    if (introduction.length < 20) {
      setError("Please write at least 20 characters about yourself.");
      return;
    }

    if (introduction.length > 2000) {
      setError("Your introduction cannot exceed 2000 characters.");
      return;
    }

    try {
      setSubmitting(true);

      await apiRequest("/applications/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: Number(jobId),
          about_yourself: introduction,
        }),
      });

      setSuccess(true);
    } catch (error) {
      console.error("Application submission error:", error);

      if (error instanceof Error) {
        if (error.message.toLowerCase().includes("already applied")) {
          setError("You have already applied for this job.");
        } else {
          setError(error.message);
        }
      } else {
        setError("Failed to submit your application.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="text-slate-300">Loading application form...</p>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-green-500/30 bg-slate-900 p-8 text-center">
            <div className="mb-4 text-5xl">✓</div>

            <h1 className="text-3xl font-bold text-green-400">
              Application Submitted!
            </h1>

            <p className="mt-4 text-slate-300">
              Your application for {job?.title} has been submitted
              successfully.
            </p>

            <p className="mt-2 text-sm text-slate-400">
              The recruiter can now review your introduction.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                onClick={() => router.push("/applications")}
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
              >
                View My Applications
              </button>

              <button
                onClick={() => router.push("/jobs")}
                className="rounded-lg border border-slate-600 px-6 py-3 font-semibold hover:border-blue-500"
              >
                Browse More Jobs
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error && !job) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-red-300">
            {error}
          </div>

          <button
            onClick={() => router.push("/jobs")}
            className="mt-6 text-sm text-slate-400 hover:text-white"
          >
            ← Back to Jobs
          </button>
        </div>
      </main>
    );
  }

  if (!job) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">

        {/* Back Button */}
        <button
          type="button"
          onClick={() => router.push(`/jobs/${jobId}`)}
          className="mb-6 text-sm text-slate-400 transition hover:text-white"
        >
          ← Back to Job Details
        </button>

        {/* Page Heading */}
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">
            HireSwipe Application
          </p>

          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Apply for {job.title}
          </h1>

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
            <span>📍 {job.location || "Location not specified"}</span>
            <span>💼 {job.job_type}</span>
          </div>

          <p className="mt-5 leading-7 text-slate-400">
            Complete the following sections to submit your application.
            Introduce yourself and tell the recruiter why you are suitable
            for this position.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-lg sm:p-8"
        >

          {/* About Yourself */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold">
                1. Tell me about yourself
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Introduce yourself to the recruiter. Talk about your
                background, skills, experience, achievements and why
                you are interested in this job.
              </p>
            </div>

            <textarea
              value={aboutYourself}
              onChange={(event) => setAboutYourself(event.target.value)}
              placeholder="Hello! My name is... I have experience in..."
              rows={8}
              minLength={20}
              maxLength={2000}
              required
              className="w-full resize-y rounded-xl border border-slate-700 bg-slate-800 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />

            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>Minimum 20 characters</span>
              <span>{aboutYourself.length}/2000</span>
            </div>
          </section>

          {/* Resume Upload Placeholder */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold">
                2. Upload your resume
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Attach your latest resume so the recruiter can review
                your qualifications.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/50 px-6 py-10 text-center">
              <div className="mb-4 rounded-full bg-slate-700 p-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-blue-400"
                >
                  <path d="M12 16V4" />
                  <path d="m7 9 5-5 5 5" />
                  <path d="M20 16.5v2A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-2" />
                </svg>
              </div>

              <h3 className="font-semibold">
                Resume Upload
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                PDF and DOCX formats
              </p>

              <span className="mt-4 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-400">
                Coming Soon
              </span>

              <p className="mt-3 text-xs text-slate-500">
                Resume upload functionality will be available in a future update.
              </p>
            </div>
          </section>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="border-t border-slate-700 pt-6">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 px-8 py-4 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting Application..." : "Submit Application"}
            </button>

            <p className="mt-3 text-center text-xs text-slate-500">
              Please review your introduction before submitting.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
