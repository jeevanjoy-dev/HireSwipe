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
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="mb-6 text-3xl font-bold">Browse Jobs</h1>

      <form
        onSubmit={handleSearch}
        className="mb-8 rounded-lg border bg-white p-6 shadow-sm"
      >
        <h2 className="mb-4 text-xl font-semibold">Search Jobs</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            type="text"
            placeholder="Search jobs..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="rounded-md border p-3"
          />

          <input
            type="text"
            placeholder="Location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="rounded-md border p-3"
          />

          <select
            value={jobType}
            onChange={(event) => setJobType(event.target.value)}
            className="rounded-md border p-3"
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
            className="rounded-md border p-3"
          />

          <input
            type="number"
            placeholder="Maximum experience"
            min="0"
            value={experienceMax}
            onChange={(event) => setExperienceMax(event.target.value)}
            className="rounded-md border p-3"
          />
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-5 py-2 text-white"
          >
            Search
          </button>

          <button
            type="button"
            onClick={handleClearFilters}
            className="rounded-md border px-5 py-2"
          >
            Clear
          </button>
        </div>
      </form>

      {message && <p className="mb-4 text-red-500">{message}</p>}

      {loading ? (
        <p>Loading jobs...</p>
      ) : jobs.length === 0 ? (
        <p>No jobs found.</p>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-lg border bg-white p-6 shadow-sm"
              >
                <h2 className="mb-2 text-xl font-semibold">{job.title}</h2>

                <p className="mb-2 text-gray-600">
                  📍 {job.location || "Not specified"}
                </p>

                <p className="mb-2 text-gray-600">
                  💼 {job.job_type}
                </p>

                <p className="mb-4 text-gray-600">
                  Experience:{" "}
                  {job.experience_min !== null &&
                  job.experience_max !== null
                    ? `${job.experience_min} - ${job.experience_max} years`
                    : "Not specified"}
                </p>

                <p className="mb-4 text-gray-700">{job.description}</p>

                <button
                onClick={() => router.push(`/jobs/${job.id}`)}
                className="rounded-md bg-blue-600 px-4 py-2 text-white">
                View Job
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={handlePreviousPage}
              disabled={skip === 0}
              className="rounded-md border px-5 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <span>
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={handleNextPage}
              disabled={skip + PAGE_SIZE >= total}
              className="rounded-md border px-5 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}