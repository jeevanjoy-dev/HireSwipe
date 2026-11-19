"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

// --------------------------------------------------
// INTERFACES
// --------------------------------------------------

interface Candidate {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    email_verified: boolean;
    phone_verified: boolean;
    created_at: string;
    candidate_profile_id: number | null;
    location: string | null;
    has_resume: boolean;
    resume_filename: string | null;
    has_profile_photo: boolean;
}

interface CandidateListResponse {
    total: number;
    skip: number;
    limit: number;
    candidates: Candidate[];
}

interface CandidateProfileDetails {
    id: number;
    location: string | null;
    bio: string | null;
    has_resume: boolean;
    resume_filename: string | null;
    has_profile_photo: boolean;
}

interface CandidateDetails {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    email_verified: boolean;
    phone_verified: boolean;
    created_at: string;
    candidate_profile: CandidateProfileDetails | null;
}

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

function formatDate(value: string) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

// --------------------------------------------------
// CANDIDATES MANAGEMENT PAGE
// --------------------------------------------------

export default function CandidatesPage() {
    const router = useRouter();

    // Candidate list states
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [total, setTotal] = useState(0);

    // Authentication and loading states
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Search and pagination states
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);

    const limit = 10;
    const totalPages = Math.ceil(total / limit);

    // Candidate details modal states
    const [selectedCandidate, setSelectedCandidate] =
        useState<CandidateDetails | null>(null);

    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState("");

    // --------------------------------------------------
    // CHECK ADMIN ACCESS
    // --------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        async function checkAdmin() {
            try {
                const token = localStorage.getItem("access_token");

                if (!token) {
                    router.replace("/login");
                    return;
                }

                const user = await apiRequest("/auth/me");

                if (user.role !== "admin") {
                    router.replace("/dashboard");
                    return;
                }

                if (!cancelled) {
                    setAuthorized(true);
                }
            } catch (err) {
                console.error("Admin authentication failed:", err);

                if (!cancelled) {
                    localStorage.removeItem("access_token");
                    router.replace("/login");
                }
            }
        }

        checkAdmin();

        return () => {
            cancelled = true;
        };
    }, [router]);

    // --------------------------------------------------
    // LOAD CANDIDATES
    // --------------------------------------------------

    const loadCandidates = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams({
                skip: String(page * limit),
                limit: String(limit),
            });

            if (search) {
                params.set("search", search);
            }

            const response: CandidateListResponse = await apiRequest(
                `/admin/candidates?${params.toString()}`
            );

            setCandidates(response.candidates);
            setTotal(response.total);

        } catch (err) {
            console.error("Unable to load candidates:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load candidates."
            );

        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        if (authorized) {
            loadCandidates();
        }
    }, [authorized, loadCandidates]);

    // --------------------------------------------------
    // SEARCH CANDIDATES
    // --------------------------------------------------

    function handleSearch(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setPage(0);
        setSearch(searchInput.trim());
    }

    function clearSearch() {
        setSearchInput("");
        setSearch("");
        setPage(0);
    }

    // --------------------------------------------------
    // VIEW CANDIDATE DETAILS
    // --------------------------------------------------

    async function handleViewDetails(candidateId: number) {
        try {
            setSelectedCandidate(null);
            setDetailsLoading(true);
            setDetailsError("");

            const details: CandidateDetails = await apiRequest(
                `/admin/candidates/${candidateId}`
            );

            setSelectedCandidate(details);

        } catch (err) {
            console.error("Unable to load candidate details:", err);

            setDetailsError(
                err instanceof Error
                    ? err.message
                    : "Unable to load candidate details."
            );

        } finally {
            setDetailsLoading(false);
        }
    }

    function closeDetails() {
        setSelectedCandidate(null);
        setDetailsError("");
    }

    // --------------------------------------------------
    // LOGOUT
    // --------------------------------------------------

    function handleLogout() {
        localStorage.removeItem("access_token");
        router.replace("/login");
    }

    // --------------------------------------------------
    // LOADING
    // --------------------------------------------------

    if (!authorized) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                Checking admin access...
            </main>
        );
    }

    // --------------------------------------------------
    // PAGE UI
    // --------------------------------------------------

    return (
        <main className="min-h-screen bg-slate-950 text-white">

            {/* NAVIGATION */}

            <nav className="border-b border-slate-800 bg-slate-950">
                <div className="mx-auto max-w-7xl px-6 py-5 flex justify-between items-center">

                    <h1 className="text-2xl font-bold">
                        <span className="text-blue-500">Hire</span>
                        Swipe
                        <span className="ml-3 text-sm font-medium text-slate-400">
                            Admin Panel
                        </span>
                    </h1>

                    <div className="flex items-center gap-4">

                        <button
                            onClick={() => router.push("/admin/dashboard")}
                            className="text-sm text-slate-300 hover:text-white"
                        >
                            Dashboard
                        </button>

                        <button
                            onClick={handleLogout}
                            className="rounded-lg bg-red-600/20 px-4 py-2 text-sm text-red-400 hover:bg-red-600/30"
                        >
                            Logout
                        </button>

                    </div>
                </div>
            </nav>

            <div className="mx-auto max-w-7xl px-6 py-10">

                {/* PAGE HEADER */}

                <section className="mb-8">

                    <button
                        onClick={() => router.push("/admin/dashboard")}
                        className="mb-5 text-sm text-blue-400 hover:text-blue-300"
                    >
                        ← Back to Dashboard
                    </button>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                        <div>
                            <h2 className="text-3xl font-bold">
                                Candidates Management
                            </h2>

                            <p className="mt-2 text-slate-400">
                                View and manage registered candidate accounts.
                            </p>
                        </div>

                        {/* JOB REPORTS AND CANDIDATE COUNT */}

                        <div className="flex flex-col gap-3 sm:flex-row">

                            <button
                                onClick={() => router.push("/admin/job_reports")}
                                className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-left transition hover:border-red-500/60 hover:bg-red-500/20"
                            >
                                <span className="text-2xl">🚩</span>

                                <div>
                                    <p className="font-semibold text-red-400">
                                        Job Reports
                                    </p>

                                    <p className="mt-1 text-xs text-slate-400">
                                        Review candidate reports
                                    </p>
                                </div>

                                <span className="ml-2 text-red-400">
                                    →
                                </span>
                            </button>

                            <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
                                <p className="text-sm text-slate-400">
                                    Total Candidates
                                </p>

                                <p className="mt-1 text-2xl font-bold text-blue-400">
                                    {total}
                                </p>
                            </div>

                        </div>

                    </div>
                </section>

                {/* SEARCH */}

                <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">

                    <form
                        onSubmit={handleSearch}
                        className="flex flex-col gap-3 sm:flex-row"
                    >

                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search candidate by name or email..."
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                        />

                        <button
                            type="submit"
                            className="rounded-lg bg-blue-600 px-6 py-3 font-medium hover:bg-blue-500"
                        >
                            Search
                        </button>

                        <button
                            type="button"
                            onClick={clearSearch}
                            className="rounded-lg border border-slate-700 px-6 py-3 text-slate-300 hover:bg-slate-800"
                        >
                            Clear
                        </button>

                    </form>

                </section>

                {/* ERROR MESSAGE */}

                {error && (
                    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
                        {error}

                        <button
                            onClick={loadCandidates}
                            className="ml-3 underline hover:text-red-300"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* CANDIDATES TABLE */}

                <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

                    <div className="border-b border-slate-800 px-6 py-5">
                        <h3 className="text-xl font-semibold">
                            Registered Candidates
                        </h3>

                        <p className="mt-1 text-sm text-slate-400">
                            Candidate account and verification information.
                        </p>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-slate-400">
                            Loading candidates...
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center text-slate-400">
                            Unable to display candidate records.
                        </div>
                    ) : candidates.length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-lg font-semibold text-slate-300">
                                No candidates found
                            </p>

                            <p className="mt-2 text-sm text-slate-500">
                                Try another search term or check again later.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">

                            <table className="w-full min-w-[900px] text-left">

                                <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">

                                    <tr>
                                        <th className="px-6 py-4">
                                            Candidate
                                        </th>

                                        <th className="px-6 py-4">
                                            Phone
                                        </th>

                                        <th className="px-6 py-4">
                                            Location
                                        </th>

                                        <th className="px-6 py-4">
                                            Email
                                        </th>

                                        <th className="px-6 py-4">
                                            Phone
                                        </th>

                                        <th className="px-6 py-4">
                                            Action
                                        </th>
                                    </tr>

                                </thead>

                                <tbody className="divide-y divide-slate-800">

                                    {candidates.map((candidate) => (

                                        <tr
                                            key={candidate.id}
                                            className="hover:bg-slate-800/50"
                                        >

                                            <td className="px-6 py-5">

                                                <p className="font-semibold text-white">
                                                    {candidate.name}
                                                </p>

                                                <p className="mt-1 text-xs text-slate-500">
                                                    ID: {candidate.id}
                                                </p>

                                                <p className="mt-1 text-sm text-slate-400">
                                                    {candidate.email}
                                                </p>

                                            </td>

                                            <td className="px-6 py-5 text-sm text-slate-300">
                                                {candidate.phone || "Not provided"}
                                            </td>

                                            <td className="px-6 py-5 text-sm text-slate-300">
                                                {candidate.location || "Not provided"}
                                            </td>

                                            <td className="px-6 py-5">
                                                {candidate.email_verified ? (
                                                    <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                                                        Verified
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400">
                                                        Unverified
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-6 py-5">
                                                {candidate.phone_verified ? (
                                                    <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                                                        Verified
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400">
                                                        Unverified
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-6 py-5">

                                                <button
                                                    onClick={() =>
                                                        handleViewDetails(candidate.id)
                                                    }
                                                    className="rounded-lg border border-blue-500/40 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/10"
                                                >
                                                    View Details
                                                </button>

                                            </td>

                                        </tr>

                                    ))}

                                </tbody>

                            </table>

                        </div>
                    )}

                    {/* PAGINATION */}

                    {!loading && total > 0 && (

                        <div className="flex flex-col gap-4 border-t border-slate-800 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

                            <p className="text-sm text-slate-400">
                                Showing {page * limit + 1} to{" "}
                                {Math.min((page + 1) * limit, total)} of {total} candidates
                            </p>

                            <div className="flex items-center gap-3">

                                <button
                                    disabled={page === 0}
                                    onClick={() => setPage((previous) => previous - 1)}
                                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Previous
                                </button>

                                <span className="text-sm text-slate-400">
                                    Page {page + 1} of {Math.max(totalPages, 1)}
                                </span>

                                <button
                                    disabled={page + 1 >= totalPages}
                                    onClick={() => setPage((previous) => previous + 1)}
                                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Next
                                </button>

                            </div>

                        </div>
                    )}

                </section>

                {/* CANDIDATE DETAILS MODAL */}

                {(detailsLoading || detailsError || selectedCandidate) && (

                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                        onClick={closeDetails}
                    >

                        <div
                            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >

                            {/* MODAL HEADER */}

                            <div className="mb-6 flex items-center justify-between">

                                <h3 className="text-2xl font-bold">
                                    Candidate Details
                                </h3>

                                <button
                                    onClick={closeDetails}
                                    className="text-2xl text-slate-400 hover:text-white"
                                >
                                    ×
                                </button>

                            </div>

                            {detailsLoading ? (
                                <div className="py-12 text-center text-slate-400">
                                    Loading candidate details...
                                </div>
                            ) : detailsError ? (
                                <div className="py-8 text-center text-red-400">
                                    {detailsError}
                                </div>
                            ) : selectedCandidate && (

                                <div className="space-y-6">

                                    {/* BASIC INFORMATION */}

                                    <section className="rounded-xl border border-slate-800 bg-slate-950 p-5">

                                        <h4 className="mb-4 font-semibold text-blue-400">
                                            Account Information
                                        </h4>

                                        <div className="grid gap-4 sm:grid-cols-2">

                                            <div>
                                                <p className="text-xs text-slate-500">
                                                    Candidate ID
                                                </p>
                                                <p className="mt-1">
                                                    #{selectedCandidate.id}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-slate-500">
                                                    Full Name
                                                </p>
                                                <p className="mt-1">
                                                    {selectedCandidate.name}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-slate-500">
                                                    Email
                                                </p>
                                                <p className="mt-1 break-all">
                                                    {selectedCandidate.email}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-slate-500">
                                                    Phone
                                                </p>
                                                <p className="mt-1">
                                                    {selectedCandidate.phone || "Not provided"}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-slate-500">
                                                    Registered On
                                                </p>
                                                <p className="mt-1">
                                                    {formatDate(selectedCandidate.created_at)}
                                                </p>
                                            </div>

                                        </div>

                                    </section>

                                    {/* VERIFICATION */}

                                    <section className="rounded-xl border border-slate-800 bg-slate-950 p-5">

                                        <h4 className="mb-4 font-semibold text-blue-400">
                                            Verification Status
                                        </h4>

                                        <div className="flex flex-wrap gap-3">

                                            <span className={`rounded-full px-3 py-2 text-sm ${
                                                selectedCandidate.email_verified
                                                    ? "bg-green-500/10 text-green-400"
                                                    : "bg-yellow-500/10 text-yellow-400"
                                            }`}>
                                                Email: {selectedCandidate.email_verified ? "Verified" : "Unverified"}
                                            </span>

                                            <span className={`rounded-full px-3 py-2 text-sm ${
                                                selectedCandidate.phone_verified
                                                    ? "bg-green-500/10 text-green-400"
                                                    : "bg-yellow-500/10 text-yellow-400"
                                            }`}>
                                                Phone: {selectedCandidate.phone_verified ? "Verified" : "Unverified"}
                                            </span>

                                        </div>

                                    </section>

                                    {/* PROFILE INFORMATION */}

                                    <section className="rounded-xl border border-slate-800 bg-slate-950 p-5">

                                        <h4 className="mb-4 font-semibold text-blue-400">
                                            Candidate Profile
                                        </h4>

                                        {selectedCandidate.candidate_profile ? (

                                            <div className="space-y-4">

                                                <div>
                                                    <p className="text-xs text-slate-500">
                                                        Profile ID
                                                    </p>
                                                    <p className="mt-1">
                                                        {selectedCandidate.candidate_profile.id}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-slate-500">
                                                        Location
                                                    </p>
                                                    <p className="mt-1">
                                                        {selectedCandidate.candidate_profile.location || "Not provided"}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-slate-500">
                                                        Bio
                                                    </p>
                                                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                                                        {selectedCandidate.candidate_profile.bio || "No bio provided."}
                                                    </p>
                                                </div>

                                            </div>

                                        ) : (

                                            <p className="text-sm text-slate-400">
                                                This candidate has not created a profile yet.
                                            </p>

                                        )}

                                    </section>

                                    {/* RESUME AND PHOTO */}

                                    <section className="rounded-xl border border-slate-800 bg-slate-950 p-5">

                                        <h4 className="mb-4 font-semibold text-blue-400">
                                            Documents and Profile Photo
                                        </h4>

                                        {selectedCandidate.candidate_profile ? (

                                            <div className="space-y-4">

                                                <div>
                                                    <p className="text-xs text-slate-500">
                                                        Resume
                                                    </p>

                                                    {selectedCandidate.candidate_profile.has_resume ? (
                                                        <p className="mt-1 text-sm text-green-400">
                                                            ✓ {selectedCandidate.candidate_profile.resume_filename || "Resume uploaded"}
                                                        </p>
                                                    ) : (
                                                        <p className="mt-1 text-sm text-slate-400">
                                                            No resume uploaded
                                                        </p>
                                                    )}
                                                </div>

                                                <div>
                                                    <p className="text-xs text-slate-500">
                                                        Profile Photo
                                                    </p>

                                                    <p className="mt-1 text-sm">
                                                        {selectedCandidate.candidate_profile.has_profile_photo ? (
                                                            <span className="text-green-400">
                                                                ✓ Profile photo uploaded
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">
                                                                No profile photo
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>

                                            </div>

                                        ) : (

                                            <p className="text-sm text-slate-400">
                                                No candidate documents or profile information available.
                                            </p>

                                        )}

                                    </section>

                                </div>

                            )}

                            <div className="mt-6 flex justify-end">

                                <button
                                    onClick={closeDetails}
                                    className="rounded-lg bg-slate-700 px-5 py-2 hover:bg-slate-600"
                                >
                                    Close
                                </button>

                            </div>

                        </div>

                    </div>
                )}

                {/* FOOTER */}

                <footer className="mt-16 border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
                    HireSwipe • Platform Administration
                </footer>

            </div>
        </main>
    );
}