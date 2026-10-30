"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../../services/api";

/**
 * Display the recruiter job creation form.
 */
export default function CreateJobPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [jobType, setJobType] = useState("Full-time");
  const [experienceMin, setExperienceMin] = useState("");
  const [experienceMax, setExperienceMax] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [requirements, setRequirements] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    /**
     * Submit a new job to the FastAPI backend.
     *
     * Args:
     *     event: Form submission event.
     *
     * Returns:
     *     None. Creates the job and redirects to the recruiter dashboard.
     */
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const data = await apiRequest("/jobs/", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          location: location || null,
          job_type: jobType,
          experience_min:
            experienceMin === "" ? null : Number(experienceMin),
          experience_max:
            experienceMax === "" ? null : Number(experienceMax),
          salary_min:
            salaryMin === "" ? null : Number(salaryMin),
          salary_max:
            salaryMax === "" ? null : Number(salaryMax),
          requirements: requirements || null,
        }),
      });

      setMessage("Job posted successfully.");

      console.log("Created job:", data);

      setTimeout(() => {
        router.push("/recruiter/jobs");
      }, 1000);
    } catch (error) {
      console.error("Job creation error:", error);

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to post job.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-3xl font-bold">
          Post a Job
        </h1>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg border bg-white p-6 shadow-sm"
        >
          <div>
            <label className="mb-2 block font-medium">
              Job Title
            </label>

            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Junior Python Developer"
              required
              className="w-full rounded-md border p-3"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Description
            </label>

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Describe the role and responsibilities..."
              required
              rows={5}
              className="w-full rounded-md border p-3"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Location
            </label>

            <input
              type="text"
              value={location}
              onChange={(event) =>
                setLocation(event.target.value)
              }
              placeholder="e.g. Kochi"
              className="w-full rounded-md border p-3"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Job Type
            </label>

            <select
              value={jobType}
              onChange={(event) =>
                setJobType(event.target.value)
              }
              className="w-full rounded-md border p-3"
            >
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Internship">Internship</option>
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block font-medium">
                Minimum Experience
              </label>

              <input
                type="number"
                min="0"
                value={experienceMin}
                onChange={(event) =>
                  setExperienceMin(event.target.value)
                }
                placeholder="e.g. 0"
                className="w-full rounded-md border p-3"
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">
                Maximum Experience
              </label>

              <input
                type="number"
                min="0"
                value={experienceMax}
                onChange={(event) =>
                  setExperienceMax(event.target.value)
                }
                placeholder="e.g. 2"
                className="w-full rounded-md border p-3"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block font-medium">
                Minimum Salary
              </label>

              <input
                type="number"
                min="0"
                value={salaryMin}
                onChange={(event) =>
                  setSalaryMin(event.target.value)
                }
                placeholder="e.g. 300000"
                className="w-full rounded-md border p-3"
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">
                Maximum Salary
              </label>

              <input
                type="number"
                min="0"
                value={salaryMax}
                onChange={(event) =>
                  setSalaryMax(event.target.value)
                }
                placeholder="e.g. 500000"
                className="w-full rounded-md border p-3"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Requirements
            </label>

            <textarea
              value={requirements}
              onChange={(event) =>
                setRequirements(event.target.value)
              }
              placeholder="e.g. Python, FastAPI, PostgreSQL, Git"
              rows={4}
              className="w-full rounded-md border p-3"
            />
          </div>

          {message && (
            <p className="text-green-600">{message}</p>
          )}

          {error && (
            <p className="text-red-600">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-6 py-3 text-white disabled:opacity-50"
            >
              {loading ? "Posting..." : "Post Job"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-md border px-6 py-3"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}