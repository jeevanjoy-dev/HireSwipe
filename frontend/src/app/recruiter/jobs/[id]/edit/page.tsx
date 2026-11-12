
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "../../../../../services/api";

interface Job {
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
}

export default function EditJobPage() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true); // Tracks initial job loading
  const [saving, setSaving] = useState(false); // Prevents duplicate form submissions
  const [message, setMessage] = useState(""); // Displays successful update feedback
  const [error, setError] = useState(""); // Displays API and validation errors

  const [title, setTitle] = useState(""); // Stores the job title
  const [description, setDescription] = useState(""); // Stores the job description
  const [location, setLocation] = useState(""); // Stores the job location
  const [jobType, setJobType] =
    useState<"Full-time" | "Part-time" | "Internship">("Full-time");
  const [experienceMin, setExperienceMin] = useState(""); // Minimum experience in years
  const [experienceMax, setExperienceMax] = useState(""); // Maximum experience in years
  const [salaryMin, setSalaryMin] = useState(""); // Minimum salary
  const [salaryMax, setSalaryMax] = useState(""); // Maximum salary
  const [requirements, setRequirements] = useState(""); // Stores job requirements
  const [isActive, setIsActive] = useState(true); // Controls job visibility

  useEffect(() => {
    // Loads the existing job details when the page opens
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

        // Populates the form with the existing job information
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

  // Handles form submission and sends updated job details to the backend
  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      // Converts input values into the data types expected by the API
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
        body: JSON.stringify(updatedJob), // Sends the updated job as JSON
      });

      setMessage("Job updated successfully.");

      // Returns to the recruiter jobs page after successful update
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

  // Loading screen displayed while existing job details are fetched
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">
            Loading job details...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="max-w-4xl mx-auto">

        {/* Page Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/recruiter/jobs")}
            className="text-sm text-slate-400 hover:text-blue-400 transition flex items-center gap-2 mb-6"
          >
            <span>←</span>
            Back to My Jobs
          </button>

          <div className="flex items-center gap-2 text-sm text-blue-400 mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Recruiter Workspace
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Edit Job
          </h1>

          <p className="text-slate-400 mt-2 text-sm sm:text-base">
            Update your job information and manage its availability.
          </p>
        </div>

        {/* Main Edit Form Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/70 shadow-xl overflow-hidden"
        >
          {/* Form Heading */}
          <div className="px-5 sm:px-8 py-6 border-b border-slate-800">
            <h2 className="text-lg font-semibold">
              Job Information
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Make changes to the details of your job posting.
            </p>
          </div>

          <div className="p-5 sm:p-8 space-y-7">

            {/* Job Title */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Job Title <span className="text-red-400">*</span>
              </label>

              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                placeholder="e.g. Junior Python Developer"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            {/* Job Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Job Description <span className="text-red-400">*</span>
              </label>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                rows={6}
                placeholder="Describe the role, responsibilities and expectations..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition resize-y"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Job Location
              </label>

              <input
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="e.g. Kochi, Kerala"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            {/* Job Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
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
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Internship">Internship</option>
              </select>
            </div>

            {/* Experience Range */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-4">
                Experience Requirements
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Minimum Experience (Years)
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={experienceMin}
                    onChange={(event) => setExperienceMin(event.target.value)}
                    placeholder="e.g. 0"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Maximum Experience (Years)
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={experienceMax}
                    onChange={(event) => setExperienceMax(event.target.value)}
                    placeholder="e.g. 3"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>
              </div>
            </div>

            {/* Salary Range */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-4">
                Salary Range
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Minimum Salary
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={salaryMin}
                    onChange={(event) => setSalaryMin(event.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Maximum Salary
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={salaryMax}
                    onChange={(event) => setSalaryMax(event.target.value)}
                    placeholder="e.g. 30000"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>
              </div>
            </div>

            {/* Job Requirements */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Requirements
              </label>

              <textarea
                value={requirements}
                onChange={(event) => setRequirements(event.target.value)}
                rows={5}
                placeholder="List the skills, qualifications and requirements..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition resize-y"
              />
            </div>

            {/* Job Availability Toggle */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Job Availability
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Control whether candidates can see and apply for this job.
                </p>
              </div>

              <label className="inline-flex items-center gap-3 cursor-pointer">
                <span className={`text-sm font-medium ${isActive ? "text-emerald-400" : "text-slate-500"}`}>
                  {isActive ? "Active" : "Inactive"}
                </span>

                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="sr-only peer"
                />

                {/* Visual toggle controlled by the existing isActive state */}
                <span className="relative w-11 h-6 rounded-full bg-slate-700 peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
              </label>
            </div>

            {/* Success and Error Feedback */}
            {message && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                {message}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

          </div>

          {/* Form Action Buttons */}
          <div className="px-5 sm:px-8 py-5 border-t border-slate-800 bg-slate-950/40 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">

            <button
              type="button"
              onClick={() => router.push("/recruiter/jobs")}
              className="px-6 py-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-sm font-medium transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>

          </div>
        </form>
      </div>
    </main>
  );
}
