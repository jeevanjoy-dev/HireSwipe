"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../services/api";

type Job = {
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
};

type JobListResponse = {
  total: number;
  skip: number;
  limit: number;
  jobs: Job[];
};

const PAGE_SIZE = 2;

export default function JobsPage() {
  /**
   * Display the HireSwipe job browsing page.
   *
   * Provides job search, filtering, pagination, and navigation
   * to individual job details using the HireSwipe dashboard theme.
   */
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [jobType, setJobType] = useState("");
  const [experienceMin, setExperienceMin] = useState("");
  const [experienceMax, setExperienceMax] = useState("");

  async function loadJobs(currentSkip = 0) {
    /**
     * Fetch jobs from the backend using the selected filters and page.
     *
     * Args:
     *     currentSkip: Number of matching jobs to skip.
     *
     * Returns:
     *     None. Updates the jobs, total, skip, loading, and message state.
     */
    try {
      setLoading(true);
      setMessage("");

      const params = new URLSearchParams();

      params.append("skip", currentSkip.toString());
      params.append("limit", PAGE_SIZE.toString());

      if (keyword) {
        params.append("keyword", keyword);
      }

      if (location) {
        params.append("location", location);
      }

      if (jobType) {
        params.append("job_type", jobType);
      }

      if (experienceMin) {
        params.append("experience_min", experienceMin);
      }

      if (experienceMax) {
        params.append("experience_max", experienceMax);
      }

      const data: JobListResponse = await apiRequest(
        `/jobs/?${params.toString()}`,
        {
          method: "GET",
        }
      );

      setJobs(data.jobs);
      setTotal(data.total);
      setSkip(data.skip);
    } catch (error) {
      console.error("Job loading error:", error);
      setMessage("Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs(0);
  }, []);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    /**
     * Submit the job search form and return to the first page.
     *
     * Args:
     *     event: Form submission event.
     *
     * Returns:
     *     None. Loads the first page of filtered jobs.
     */
    event.preventDefault();
    loadJobs(0);
  }

  function handleClearFilters() {
    /**
     * Clear all filters and reload the first page of jobs.
     *
     * Returns:
     *     None. Resets filters and loads all active jobs.
     */
    setKeyword("");
    setLocation("");
    setJobType("");
    setExperienceMin("");
    setExperienceMax("");

    loadJobs(0);
  }

  function handleNextPage() {
    /**
     * Load the next page of matching jobs.
     *
     * Returns:
     *     None. Loads the next page when more jobs are available.
     */
    if (skip + PAGE_SIZE < total) {
      loadJobs(skip + PAGE_SIZE);
    }
  }

  function handlePreviousPage() {
    /**
     * Load the previous page of matching jobs.
     *
     * Returns:
     *     None. Loads the previous page when the current page is not the first.
     */
    if (skip > 0) {
      loadJobs(Math.max(0, skip - PAGE_SIZE));
    }
  }

  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="min-h-screen bg-[#070b1a] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-8 text-sm font-medium text-blue-400 transition hover:text-blue-300"
        >
          ← Back to Dashboard
        </button>

        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-400">
            HIREsWIPE
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Browse Jobs
          </h1>

          <p className="mt-2 text-gray-400">
            Find the right opportunity and take the next step in your career.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="mb-10 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-[#111936] to-[#0c1228] p-6 shadow-xl shadow-blue-950/20"
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">
              Search Jobs
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Search and filter opportunities based on your preferences.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="text"
              placeholder="Search jobs..."
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#080d20] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />

            <input
              type="text"
              placeholder="Location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#080d20] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />

            <select
              value={jobType}
              onChange={(event) => setJobType(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#080d20] px-4 py-3 text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All job types</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Internship">Internship</option>
            </select>

            <input
              type="number"
              placeholder="Minimum experience"
              min="0"
              value={experienceMin}
              onChange={(event) => setExperienceMin(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#080d20] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />

            <input
              type="number"
              placeholder="Maximum experience"
              min="0"
              value={experienceMax}
              onChange={(event) => setExperienceMax(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#080d20] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:from-blue-500 hover:to-indigo-500"
            >
              Search Jobs
            </button>

            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              Clear Filters
            </button>
          </div>
        </form>

        {message && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-[#111936] p-10 text-center">
            <p className="text-gray-400">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111936] to-[#0c1228] p-12 text-center shadow-xl">
            <div className="mb-4 text-5xl">🔍</div>

            <h2 className="text-xl font-semibold text-white">
              No jobs found
            </h2>

            <p className="mt-2 text-gray-400">
              Try changing your search filters to find more opportunities.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Available Jobs
                </h2>

                <p className="mt-1 text-sm text-gray-400">
                  {total} {total === 1 ? "job" : "jobs"} found
                </p>
              </div>

              <div className="rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
                Page {currentPage} of {totalPages}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="group rounded-2xl border border-blue-500/15 bg-gradient-to-br from-[#111936] to-[#0c1228] p-6 shadow-xl shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-blue-500/40 hover:shadow-blue-950/30"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-white transition group-hover:text-blue-300">
                        {job.title}
                      </h2>

                      <p className="mt-2 text-sm text-gray-400">
                        📍 {job.location || "Location not specified"}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
                      {job.job_type}
                    </span>
                  </div>

                  <div className="mb-5 grid gap-3 rounded-xl border border-white/5 bg-black/10 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Experience
                      </p>

                      <p className="mt-1 text-sm font-medium text-gray-200">
                        {job.experience_min !== null &&
                        job.experience_max !== null
                          ? `${job.experience_min} - ${job.experience_max} years`
                          : "Not specified"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Salary
                      </p>

                      <p className="mt-1 text-sm font-medium text-gray-200">
                        {job.salary_min !== null ||
                        job.salary_max !== null
                          ? `₹${job.salary_min ?? 0} - ₹${
                              job.salary_max ?? "Not specified"
                            }`
                          : "Not specified"}
                      </p>
                    </div>
                  </div>

                  <p className="mb-6 line-clamp-3 text-sm leading-6 text-gray-400">
                    {job.description}
                  </p>

                  <button
                    onClick={() => router.push(`/jobs/${job.id}`)}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:from-blue-500 hover:to-indigo-500"
                  >
                    View Job →
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-10 flex items-center justify-center gap-4">
              <button
                onClick={handlePreviousPage}
                disabled={skip === 0}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-medium text-gray-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                ← Previous
              </button>

              <span className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-5 py-3 text-sm font-medium text-blue-300">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={skip + PAGE_SIZE >= total}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-medium text-gray-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}