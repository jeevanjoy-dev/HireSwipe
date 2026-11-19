"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../../services/api";

type ApplicationMethod = "Platform" | "Email" | "External";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Company {
  id: number;
  name: string;
  verification_status: string;
}

interface RecruiterProfile {
  id: number;
  user_id: number;
  company: Company | null;
}

interface RecruiterAccessStatus {
  is_restricted: boolean;
  blocked_type: "individual" | "primary_recruiter" | null;
  reason: string | null;
  message: string;
}

function isNotFound(error: unknown): boolean {
  if (
    error &&
    typeof error === "object" &&
    "status" in error
  ) {
    if ((error as { status?: number }).status === 404) {
      return true;
    }
  }

  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("not found")
  );
}

export default function CreateJobPage() {
  const router = useRouter();

  // --------------------------------------------------
  // COMPANY VERIFICATION ACCESS
  // --------------------------------------------------

  const [accessLoading, setAccessLoading] = useState(true);
  const [companyVerified, setCompanyVerified] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [accessStatus, setAccessStatus] =
    useState<RecruiterAccessStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkCompanyVerification() {
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          router.replace("/login");
          return;
        }

        // 1. Verify the logged-in user.
        const userData: User = await apiRequest("/auth/me");

        if (userData.role !== "recruiter") {
          router.replace("/dashboard");
          return;
        }

        // 2. Check whether this recruiter is blocked individually
        // or through the company's primary recruiter.
        const status: RecruiterAccessStatus = await apiRequest(
          "/jobs/recruiter-access-status"
        );

        if (cancelled) return;

        setAccessStatus(status);

        if (status.is_restricted) {
          setCompanyVerified(false);
          setAccessError(status.message);
          return;
        }

        // 3. Check whether the recruiter is a Company Admin.
        let company: Company | null = null;

        try {
          company = await apiRequest(
            "/companies/my-admin-company"
          );
        } catch (error) {
          if (!isNotFound(error)) {
            throw error;
          }
        }

        // 4. If not a Company Admin, check Secondary Recruiter profile.
        if (!company) {
          let profile: RecruiterProfile | null = null;

          try {
            profile = await apiRequest("/recruiter/profile");
          } catch (error) {
            if (!isNotFound(error)) {
              throw error;
            }
          }

          company = profile?.company || null;
        }

        if (cancelled) return;

        // 5. Block recruiters without an associated company.
        if (!company) {
          setCompanyVerified(false);
          setAccessError(
            "You must be associated with a company before posting jobs."
          );
          return;
        }

        // 6. Allow job creation only for verified companies.
        if (company.verification_status !== "verified") {
          setCompanyVerified(false);
          setAccessError(
            "Your company must be verified by the HireSwipe Admin before you can post jobs."
          );
          return;
        }

        setCompanyVerified(true);
        setAccessError("");
      } catch (error) {
        console.error(
          "Company verification check failed:",
          error
        );

        const status =
          error &&
          typeof error === "object" &&
          "status" in error
            ? (error as { status?: number }).status
            : undefined;

        if (status === 401) {
          localStorage.removeItem("access_token");
          router.replace("/login");
          return;
        }

        if (!cancelled) {
          setCompanyVerified(false);
          setAccessError(
            error instanceof Error
              ? error.message
              : "Unable to verify your company. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setAccessLoading(false);
        }
      }
    }

    checkCompanyVerification();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // --------------------------------------------------
  // JOB FORM STATES
  // --------------------------------------------------

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [jobType, setJobType] = useState("Full-time");
  const [experienceMin, setExperienceMin] = useState("");
  const [experienceMax, setExperienceMax] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [requirements, setRequirements] = useState("");

  const [applicationMethod, setApplicationMethod] =
    useState<ApplicationMethod>("Platform");

  const [applicationUrl, setApplicationUrl] = useState("");
  const [applicationEmail, setApplicationEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // --------------------------------------------------
  // SUBMIT JOB
  // --------------------------------------------------

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    // Additional frontend protection.
    if (
      !companyVerified ||
      accessLoading ||
      accessStatus?.is_restricted
    ) {
      setError(
        accessStatus?.is_restricted
          ? accessStatus.message
          : "Your company must be verified before you can post a job."
      );
      return;
    }

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

          application_method: applicationMethod,

          application_url:
            applicationMethod === "External"
              ? applicationUrl
              : null,

          application_email:
            applicationMethod === "Email"
              ? applicationEmail
              : null,
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

  // --------------------------------------------------
  // ACCESS CHECK LOADING
  // --------------------------------------------------

  if (accessLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />

          <p className="text-slate-300">
            Checking company verification...
          </p>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // RECRUITER ACCESS RESTRICTED
  // --------------------------------------------------

  if (accessStatus?.is_restricted) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full rounded-2xl border border-red-500/30 bg-slate-900 p-8 text-center shadow-xl">
          <div className="text-5xl mb-5">🚫</div>

          <h1 className="text-2xl font-bold text-red-400">
            {accessStatus.blocked_type === "individual"
              ? "Recruiter Account Blocked"
              : "Company Recruitment Access Restricted"}
          </h1>

          <p className="mt-4 text-slate-300">
            {accessStatus.message}
          </p>

          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-left">
            <p className="text-sm font-semibold text-red-300">
              Reason for restriction
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {accessStatus.reason || "No reason provided."}
            </p>
          </div>

          <p className="mt-4 text-sm text-slate-400">
            Job creation is unavailable until this restriction is lifted.
          </p>

          <button
            type="button"
            onClick={() => router.push("/recruiter/dashboard")}
            className="mt-7 w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-sm font-semibold transition"
          >
            Back to Recruiter Dashboard
          </button>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // COMPANY NOT VERIFIED
  // --------------------------------------------------

  if (!companyVerified) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full rounded-2xl border border-yellow-500/30 bg-slate-900 p-8 text-center shadow-xl">

          <div className="text-5xl mb-5">
            🔒
          </div>

          <h1 className="text-2xl font-bold">
            Company Verification Required
          </h1>

          <p className="mt-4 text-slate-400 leading-relaxed">
            {accessError ||
              "Your company must be verified before you can post jobs on HireSwipe."}
          </p>

          <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <p className="text-sm text-yellow-400">
              Job posting is currently unavailable.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push("/recruiter/dashboard")
            }
            className="mt-7 w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-sm font-semibold transition"
          >
            Back to Recruiter Dashboard
          </button>

        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // VERIFIED COMPANY - JOB CREATION FORM
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-slate-950 text-white px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="max-w-4xl mx-auto">

        {/* PAGE HEADER */}

        <div className="mb-8">

          <button
            type="button"
            onClick={() =>
              router.push("/recruiter/jobs")
            }
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

          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs text-green-400">
            <span>✓</span>
            Company Verified
          </div>

        </div>

        {/* MAIN JOB CREATION FORM */}

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/70 shadow-xl overflow-hidden"
        >

          {/* FORM HEADER */}

          <div className="px-5 sm:px-8 py-6 border-b border-slate-800">
            <h2 className="text-lg font-semibold">
              Job Information
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Enter the details candidates will see in your job posting.
            </p>
          </div>

          <div className="p-5 sm:p-8 space-y-7">

            {/* JOB TITLE */}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Job Title <span className="text-red-400">*</span>
              </label>

              <input
                type="text"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="e.g. Junior Python Developer"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            {/* JOB DESCRIPTION */}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description <span className="text-red-400">*</span>
              </label>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Describe the role, responsibilities and expectations..."
                required
                rows={6}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition resize-y"
              />
            </div>

            {/* LOCATION */}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Job Location
              </label>

              <input
                type="text"
                value={location}
                onChange={(event) =>
                  setLocation(event.target.value)
                }
                placeholder="e.g. Kochi, Kerala"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            {/* EMPLOYMENT TYPE */}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Job Type
              </label>

              <select
                value={jobType}
                onChange={(event) =>
                  setJobType(event.target.value)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Internship">Internship</option>
              </select>
            </div>

            {/* EXPERIENCE REQUIREMENTS */}

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
                    onChange={(event) =>
                      setExperienceMin(event.target.value)
                    }
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
                    onChange={(event) =>
                      setExperienceMax(event.target.value)
                    }
                    placeholder="e.g. 2"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>

              </div>
            </div>

            {/* SALARY RANGE */}

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
                    onChange={(event) =>
                      setSalaryMin(event.target.value)
                    }
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
                    onChange={(event) =>
                      setSalaryMax(event.target.value)
                    }
                    placeholder="e.g. 500000"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>

              </div>
            </div>

            {/* JOB REQUIREMENTS */}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Requirements
              </label>

              <textarea
                value={requirements}
                onChange={(event) =>
                  setRequirements(event.target.value)
                }
                placeholder="e.g. Python, FastAPI, PostgreSQL, Git"
                rows={4}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition resize-y"
              />
            </div>

            {/* APPLICATION SETTINGS */}

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

              {/* EMAIL APPLICATION */}

              {applicationMethod === "Email" && (
                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-5">

                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    HR Application Email
                  </label>

                  <input
                    type="email"
                    value={applicationEmail}
                    onChange={(event) =>
                      setApplicationEmail(event.target.value)
                    }
                    placeholder="e.g. careers@company.com"
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />

                  <p className="text-xs text-slate-500 mt-2">
                    Candidates will use this email address to contact your recruitment team.
                  </p>

                </div>
              )}

              {/* EXTERNAL APPLICATION */}

              {applicationMethod === "External" && (
                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-5">

                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    External Application URL
                  </label>

                  <input
                    type="url"
                    value={applicationUrl}
                    onChange={(event) =>
                      setApplicationUrl(event.target.value)
                    }
                    placeholder="https://company.com/careers"
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />

                  <p className="text-xs text-slate-500 mt-2">
                    Candidates will be redirected to this website to apply.
                  </p>

                </div>
              )}

              {/* PLATFORM APPLICATION */}

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

            {/* SUCCESS MESSAGE */}

            {message && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                {message}
              </div>
            )}

            {/* ERROR MESSAGE */}

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

          </div>

          {/* FORM ACTION BUTTONS */}

          <div className="px-5 sm:px-8 py-5 border-t border-slate-800 bg-slate-950/40 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">

            <button
              type="button"
              onClick={() =>
                router.push("/dashboard")
              }
              className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                loading ||
                !companyVerified ||
                accessStatus?.is_restricted === true
              }
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