"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../../../services/api";

type Job = {
  id: number;
  title: string;
  description: string;
  location: string | null;
  job_type: "Full-time" | "Part-time" | "Internship";
  experience_min: number | null;
  experience_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  requirements: string | null;
  is_active: boolean;
};

/**
 * Allow a recruiter to edit an existing job.
 */
export default function EditJobPage() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [jobType, setJobType] =
    useState<"Full-time" | "Part-time" | "Internship">("Full-time");
  const [experienceMin, setExperienceMin] = useState("");
  const [experienceMax, setExperienceMax] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [requirements, setRequirements] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    /**
     * Load the existing job details into the edit form.
     */
    async function loadJob() {
      try {
        setLoading(true);
        setError("");

        const data: Job = await apiRequest(
          `/jobs/${params.id}`,
          {
            method: "GET",
          }
        );

        setTitle(data.title);
        setDescription(data.description);
        setLocation(data.location || "");
        setJobType(data.job_type);
        setExperienceMin(
          data.experience_min !== null
            ? data.experience_min.toString()
            : ""
        );
        setExperienceMax(
          data.experience_max !== null
            ? data.experience_max.toString()
            : ""
        );
        setSalaryMin(
          data.salary_min !== null
            ? data.salary_min.toString()
            : ""
        );
        setSalaryMax(
          data.salary_max !== null
            ? data.salary_max.toString()
            : ""
        );
        setRequirements(data.requirements || "");
        setIsActive(data.is_active);
      } catch (error) {
        console.error("Job loading error:", error);
        setError("Failed to load job.");
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadJob();
    }
  }, [params.id]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    /**
     * Submit the edited job information to the backend.
     */
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const updatedJob = {
        title,
        description,
        location: location || null,
        job_type: jobType,
        experience_min:
          experienceMin === ""
            ? null
            : Number(experienceMin),
        experience_max:
          experienceMax === ""
            ? null
            : Number(experienceMax),
        salary_min:
          salaryMin === ""
            ? null
            : Number(salaryMin),
        salary_max:
          salaryMax === ""
            ? null
            : Number(salaryMax),
        requirements: requirements || null,
        is_active: isActive,
      };

      await apiRequest(`/jobs/${params.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedJob),
      });

      setMessage("Job updated successfully.");

      setTimeout(() => {
        router.push("/recruiter/jobs");
      }, 1000);
    } catch (error) {
      console.error("Job update error:", error);

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to update job.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <p>Loading job...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-3xl font-bold">
          Edit Job
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
              onChange={(event) =>
                setTitle(event.target.value)
              }
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
              required
              rows={6}
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
                setJobType(
                  event.target.value as
                    | "Full-time"
                    | "Part-time"
                    | "Internship"
                )
              }
              className="w-full rounded-md border p-3"
            >
              <option value="Full-time">
                Full-time
              </option>

              <option value="Part-time">
                Part-time
              </option>

              <option value="Internship">
                Internship
              </option>
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
              rows={5}
              className="w-full rounded-md border p-3"
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) =>
                setIsActive(event.target.checked)
              }
            />

            <span>Job is active</span>
          </label>

          {message && (
            <p className="text-green-600">{message}</p>
          )}

          {error && (
            <p className="text-red-600">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-5 py-2 text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/recruiter/jobs")
              }
              className="rounded-md border px-5 py-2"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}