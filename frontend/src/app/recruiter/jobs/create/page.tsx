
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../../services/api";

type ApplicationMethod = "Platform" | "Email" | "External";

export default function CreateJobPage() {
  const router = useRouter();

  const [title, setTitle] = useState(""); // Stores the job title
  const [description, setDescription] = useState(""); // Stores the job description
  const [location, setLocation] = useState(""); // Stores the job location
  const [jobType, setJobType] = useState("Full-time"); // Stores the selected employment type
  const [experienceMin, setExperienceMin] = useState(""); // Minimum required experience
  const [experienceMax, setExperienceMax] = useState(""); // Maximum required experience
  const [salaryMin, setSalaryMin] = useState(""); // Minimum salary offered
  const [salaryMax, setSalaryMax] = useState(""); // Maximum salary offered
  const [requirements, setRequirements] = useState(""); // Stores required skills and qualifications

  const [applicationMethod, setApplicationMethod] =
    useState<ApplicationMethod>("Platform"); // Determines how candidates apply
  const [applicationUrl, setApplicationUrl] = useState(""); // External application link
  const [applicationEmail, setApplicationEmail] = useState(""); // HR email for email applications

  const [loading, setLoading] = useState(false); // Tracks job submission progress
  const [message, setMessage] = useState(""); // Displays successful submission feedback
  const [error, setError] = useState(""); // Displays submission errors

  // Submits the new job details to the FastAPI backend
  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
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
            experienceMin === "" ? null : Number(experienceMin), // Converts experience input into a number
          experience_max:
            experienceMax === "" ? null : Number(experienceMax),
          salary_min:
            salaryMin === "" ? null : Number(salaryMin), // Converts salary input into a number
          salary_max:
            salaryMax === "" ? null : Number(salaryMax),
          requirements: requirements || null,

          application_method: applicationMethod, // Sends the selected application method

          application_url:
            applicationMethod === "External"
              ? applicationUrl
              : null, // Sends URL only for external applications

          application_email:
            applicationMethod === "Email"
              ? applicationEmail
              : null, // Sends HR email only for email applications
        }),
      });

      setMessage("Job posted successfully.");

      console.log("Created job:", data);

      // Redirects to My Jobs after successful job creation
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
      setLoading(false); // Re-enables the submit button after the request
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="max-w-4xl mx-auto">

        {/* Page Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/recruiter/jobs")} // Returns to the recruiter's job listings
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition mb-6"
          >
            <span>←</span>
            Back to My Jobs
          </button>

          <div className="flex items-center gap-2 text-sm text-blue-400 mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Recruiter Workspace
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Post a Job
          </h1>

          <p className="text-slate-400 mt-2 text-sm sm:text-base">
            Create a new opportunity and connect with potential candidates.
          </p>
        </div>

        {/* Main Job Creation Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/70 shadow-xl overflow-hidden"
        >
          {/* Form Section Header */}
          <div className="px-5 sm:px-8 py-6 border-b border-slate-800">
            <h2 className="text-lg font-semibold">
              Job Information
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter the details candidates will see in your job posting.
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
                placeholder="e.g. Junior Python Developer"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            {/* Job Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description <span className="text-red-400">*</span>
              </label>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the role, responsibilities and expectations..."
                required
                rows={6}
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

            {/* Employment Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Job Type
              </label>

              <select
                value={jobType}
                onChange={(event) => setJobType(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Internship">Internship</option>
              </select>
            </div>

            {/* Experience Requirements */}
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
                    placeholder="e.g. 2"
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
                    Minimum Salary (₹)
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={salaryMin}
                    onChange={(event) => setSalaryMin(event.target.value)}
                    placeholder="e.g. 300000"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Maximum Salary (₹)
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={salaryMax}
                    onChange={(event) => setSalaryMax(event.target.value)}
                    placeholder="e.g. 500000"
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
                placeholder="e.g. Python, FastAPI, PostgreSQL, Git"
                rows={4}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition resize-y"
              />
            </div>

            {/* Application Method Selection */}
            <div className="border-t border-slate-800 pt-7">
              <h3 className="text-lg font-semibold text-slate-200 mb-2">
                Application Settings
              </h3>

              <p className="text-sm text-slate-500 mb-5">
                Choose how candidates should submit their applications.
              </p>

              <label className="block text-sm font-medium text-slate-300 mb-2">
                Application Method
              </label>

              <select
                value={applicationMethod}
                onChange={(event) =>
                  setApplicationMethod(
                    event.target.value as ApplicationMethod
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              >
                <option value="Platform">
                  Apply through HireSwipe
                </option>
                <option value="Email">
                  Apply through Email
                </option>
                <option value="External">
                  Apply through External Website
                </option>
              </select>

              {/* Shows HR email field only when Email is selected */}
              {applicationMethod === "Email" && (
                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    HR Application Email
                  </label>

                  <input
                    type="email"
                    value={applicationEmail}
                    onChange={(event) => setApplicationEmail(event.target.value)}
                    placeholder="e.g. careers@company.com"
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />

                  <p className="text-xs text-slate-500 mt-2">
                    Candidates will use this email address to contact your recruitment team.
                  </p>
                </div>
              )}

              {/* Shows external URL field only when External is selected */}
              {applicationMethod === "External" && (
                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    External Application URL
                  </label>

                  <input
                    type="url"
                    value={applicationUrl}
                    onChange={(event) => setApplicationUrl(event.target.value)}
                    placeholder="https://company.com/careers"
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />

                  <p className="text-xs text-slate-500 mt-2">
                    Candidates will be redirected to this website to apply.
                  </p>
                </div>
              )}

              {/* Explains the selected application method */}
              {applicationMethod === "Platform" && (
                <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <p className="text-sm text-blue-300 font-medium">
                    HireSwipe Applications
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Candidates will apply directly through HireSwipe. You can manage their applications from your recruiter dashboard.
                  </p>
                </div>
              )}
            </div>

            {/* Success and Error Messages */}
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
              onClick={() => router.push("/dashboard")} // Cancels job creation and returns to the dashboard
              className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading} // Prevents multiple job creation requests
              className="rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {loading ? "Posting Job..." : "Post Job"}
            </button>

          </div>
        </form>
      </div>
    </main>
  );
}
