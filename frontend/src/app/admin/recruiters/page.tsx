
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type RecruiterType =
    | "company_admin"
    | "secondary_recruiter"
    | "unassociated"
    | "pending";

interface RecruiterCompany {
    id: number;
    name: string;
    verification_status?: string | null;
    website?: string | null;
    location?: string | null;
}

interface Recruiter {
    id: number;
    name: string;
    email: string;
    email_verified: boolean;

    recruiter_profile_id: number | null;
    designation: string | null;
    profile_photo: string | null;

    recruiter_type: RecruiterType;
    company: RecruiterCompany | null;

    is_blocked: boolean;
    blocked_reason: string | null;
    blocked_at: string | null;
}

interface RecruiterDetails extends Recruiter {
    recruiter_profile: {
        id: number;
        designation: string | null;
        profile_photo: string | null;
    } | null;

    pending_join_requests: number;
}

// --------------------------------------------------
// LABEL HELPERS
// --------------------------------------------------

function recruiterTypeLabel(type: RecruiterType) {
    switch (type) {
        case "company_admin":
            return "Company Admin";
        case "secondary_recruiter":
            return "Secondary Recruiter";
        case "pending":
            return "Pending";
        default:
            return "Unassociated";
    }
}

function recruiterTypeStyle(type: RecruiterType) {
    switch (type) {
        case "company_admin":
            return "bg-purple-500/10 text-purple-400 border-purple-500/20";
        case "secondary_recruiter":
            return "bg-blue-500/10 text-blue-400 border-blue-500/20";
        case "pending":
            return "bg-amber-500/10 text-amber-400 border-amber-500/20";
        default:
            return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
}

// --------------------------------------------------
// MAIN PAGE
// --------------------------------------------------

export default function RecruitersManagementPage() {
    const router = useRouter();

    const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [emailFilter, setEmailFilter] = useState("all");
    const [accountFilter, setAccountFilter] = useState("all");

    const [selectedRecruiter, setSelectedRecruiter] =
        useState<RecruiterDetails | null>(null);

    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState("");

    // Moderation states
    const [blockReason, setBlockReason] = useState("");
    const [showBlockForm, setShowBlockForm] = useState(false);
    const [blockLoading, setBlockLoading] = useState(false);
    const [blockError, setBlockError] = useState("");
    const [blockSuccess, setBlockSuccess] = useState("");

    // --------------------------------------------------
    // LOAD RECRUITERS
    // --------------------------------------------------

    const loadRecruiters = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const user = await apiRequest("/auth/me");

            if (user.role !== "admin") {
                router.replace("/dashboard");
                return;
            }

            const data = await apiRequest<Recruiter[]>(
                "/admin/recruiters"
            );

            setRecruiters(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load recruiters."
            );
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        loadRecruiters();
    }, [loadRecruiters]);

    // --------------------------------------------------
    // FILTER RECRUITERS
    // --------------------------------------------------

    const filteredRecruiters = useMemo(() => {
        return recruiters.filter((recruiter) => {
            const searchText = search.toLowerCase().trim();

            const matchesSearch =
                recruiter.name?.toLowerCase().includes(searchText) ||
                recruiter.email?.toLowerCase().includes(searchText) ||
                recruiter.company?.name?.toLowerCase().includes(searchText) ||
                recruiter.designation?.toLowerCase().includes(searchText);

            const matchesType =
                typeFilter === "all" ||
                recruiter.recruiter_type === typeFilter;

            const matchesEmail =
                emailFilter === "all" ||
                (emailFilter === "verified" && recruiter.email_verified) ||
                (emailFilter === "unverified" && !recruiter.email_verified);

            const matchesAccount =
                accountFilter === "all" ||
                (accountFilter === "blocked" && recruiter.is_blocked) ||
                (accountFilter === "active" && !recruiter.is_blocked);

            return (
                matchesSearch &&
                matchesType &&
                matchesEmail &&
                matchesAccount
            );
        });
    }, [
        recruiters,
        search,
        typeFilter,
        emailFilter,
        accountFilter,
    ]);

    // --------------------------------------------------
    // SUMMARY STATISTICS
    // --------------------------------------------------

    const totalRecruiters = recruiters.length;

    const companyAdmins = recruiters.filter(
        (r) => r.recruiter_type === "company_admin"
    ).length;

    const secondaryRecruiters = recruiters.filter(
        (r) => r.recruiter_type === "secondary_recruiter"
    ).length;

    const unassociatedRecruiters = recruiters.filter(
        (r) =>
            r.recruiter_type === "unassociated" ||
            r.recruiter_type === "pending"
    ).length;

    const blockedRecruiters = recruiters.filter(
        (r) => r.is_blocked
    ).length;

    // --------------------------------------------------
    // VIEW RECRUITER DETAILS
    // --------------------------------------------------

    async function openRecruiterDetails(recruiterId: number) {
        try {
            setSelectedRecruiter(null);
            setDetailsLoading(true);
            setDetailsError("");

            setBlockError("");
            setBlockSuccess("");
            setBlockReason("");
            setShowBlockForm(false);

            const details = await apiRequest<RecruiterDetails>(
                `/admin/recruiters/${recruiterId}`
            );

            setSelectedRecruiter(details);
        } catch (err) {
            setDetailsError(
                err instanceof Error
                    ? err.message
                    : "Unable to load recruiter details."
            );
        } finally {
            setDetailsLoading(false);
        }
    }

    // --------------------------------------------------
    // BLOCK / UNBLOCK RECRUITER
    // --------------------------------------------------

    async function handleRecruiterBlock() {
        if (!selectedRecruiter || blockLoading) return;

        const recruiterId = selectedRecruiter.id;
        const isCurrentlyBlocked = selectedRecruiter.is_blocked;

        if (!isCurrentlyBlocked && !blockReason.trim()) {
            setBlockError("Please provide a reason for blocking.");
            return;
        }

        try {
            setBlockLoading(true);
            setBlockError("");
            setBlockSuccess("");

            if (isCurrentlyBlocked) {
                await apiRequest(
                    `/admin/recruiters/${recruiterId}/unblock`,
                    {
                        method: "PUT",
                    }
                );

                setBlockSuccess("Recruiter unblocked successfully.");
            } else {
                await apiRequest(
                    `/admin/recruiters/${recruiterId}/block`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            reason: blockReason.trim(),
                        }),
                    }
                );

                setBlockSuccess("Recruiter blocked successfully.");
            }

            // Refresh the table without leaving the modal.
            const updatedRecruiters = await apiRequest<Recruiter[]>(
                "/admin/recruiters"
            );

            setRecruiters(
                Array.isArray(updatedRecruiters)
                    ? updatedRecruiters
                    : []
            );

            // Refresh selected recruiter details.
            const updatedDetails = await apiRequest<RecruiterDetails>(
                `/admin/recruiters/${recruiterId}`
            );

            setSelectedRecruiter(updatedDetails);

            setBlockReason("");
            setShowBlockForm(false);

        } catch (err) {
            setBlockError(
                err instanceof Error
                    ? err.message
                    : "Unable to update recruiter status."
            );
        } finally {
            setBlockLoading(false);
        }
    }

    // --------------------------------------------------
    // LOGOUT
    // --------------------------------------------------

    function handleLogout() {
        localStorage.removeItem("access_token");
        router.replace("/login");
    }

    // --------------------------------------------------
    // LOADING SCREEN
    // --------------------------------------------------

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="mt-4 text-slate-400">
                        Loading recruiters...
                    </p>
                </div>
            </main>
        );
    }

    // --------------------------------------------------
    // PAGE UI
    // --------------------------------------------------

    return (
        <main className="min-h-screen bg-slate-950 text-white">

            {/* HEADER */}

            <header className="border-b border-slate-800 bg-slate-900/80">
                <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">

                    <div>
                        <button
                            onClick={() => router.push("/admin/dashboard")}
                            className="text-sm text-blue-400 hover:text-blue-300 mb-2"
                        >
                            ← Back to Dashboard
                        </button>

                        <h1 className="text-2xl font-bold">
                            Recruiters Management
                        </h1>

                        <p className="text-sm text-slate-400 mt-1">
                            Manage and review registered recruiters on HireSwipe.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={loadRecruiters}
                            className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 transition"
                        >
                            ↻ Refresh
                        </button>

                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">

                {/* ERROR MESSAGE */}

                {error && (
                    <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
                        {error}
                        <button
                            onClick={loadRecruiters}
                            className="ml-3 underline"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* SUMMARY CARDS */}

                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">

                    <SummaryCard
                        title="Total Recruiters"
                        value={totalRecruiters}
                        icon="👥"
                        color="blue"
                    />

                    <SummaryCard
                        title="Company Admins"
                        value={companyAdmins}
                        icon="🏢"
                        color="purple"
                    />

                    <SummaryCard
                        title="Secondary Recruiters"
                        value={secondaryRecruiters}
                        icon="🤝"
                        color="green"
                    />

                    <SummaryCard
                        title="Not Yet Associated"
                        value={unassociatedRecruiters}
                        icon="⏳"
                        color="amber"
                    />

                    <SummaryCard
                        title="Blocked Recruiters"
                        value={blockedRecruiters}
                        icon="🚫"
                        color="red"
                    />

                </section>

                {/* RECRUITER LIST */}

                <section className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">

                    {/* SECTION HEADER */}

                    <div className="p-6 border-b border-slate-800">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-semibold">
                                    All Recruiters
                                </h2>

                                <p className="text-sm text-slate-400 mt-1">
                                    {filteredRecruiters.length} of {totalRecruiters} recruiters
                                </p>
                            </div>
                        </div>

                        {/* SEARCH AND FILTERS */}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">

                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search name, email, company..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500"
                            />

                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500"
                            >
                                <option value="all">All Recruiter Types</option>
                                <option value="company_admin">Company Admin</option>
                                <option value="secondary_recruiter">Secondary Recruiter</option>
                                <option value="pending">Pending</option>
                                <option value="unassociated">Unassociated</option>
                            </select>

                            <select
                                value={emailFilter}
                                onChange={(e) => setEmailFilter(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500"
                            >
                                <option value="all">All Email Statuses</option>
                                <option value="verified">Email Verified</option>
                                <option value="unverified">Email Not Verified</option>
                            </select>

                            <select
                                value={accountFilter}
                                onChange={(e) => setAccountFilter(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500"
                            >
                                <option value="all">All Account Statuses</option>
                                <option value="active">Active</option>
                                <option value="blocked">Blocked</option>
                            </select>

                        </div>
                    </div>

                    {/* TABLE */}

                    <div className="overflow-x-auto">

                        <table className="w-full text-left min-w-[950px]">

                            <thead className="bg-slate-950/70 text-slate-400 text-xs uppercase">
                                <tr>
                                    <th className="px-6 py-4">Recruiter</th>
                                    <th className="px-6 py-4">Company</th>
                                    <th className="px-6 py-4">Recruiter Type</th>
                                    <th className="px-6 py-4">Email Status</th>
                                    <th className="px-6 py-4">Account Status</th>
                                    <th className="px-6 py-4">Action</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-800">

                                {filteredRecruiters.map((recruiter) => (

                                    <tr
                                        key={recruiter.id}
                                        className="hover:bg-slate-800/40 transition"
                                    >

                                        {/* RECRUITER */}

                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">

                                                <div className="w-10 h-10 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center font-semibold">
                                                    {recruiter.name?.charAt(0)?.toUpperCase() || "R"}
                                                </div>

                                                <div>
                                                    <p className="font-medium">
                                                        {recruiter.name}
                                                    </p>

                                                    <p className="text-xs text-slate-400">
                                                        {recruiter.email}
                                                    </p>

                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {recruiter.designation || "Designation not provided"}
                                                    </p>
                                                </div>

                                            </div>
                                        </td>

                                        {/* COMPANY */}

                                        <td className="px-6 py-5">
                                            {recruiter.company ? (
                                                <>
                                                    <p className="font-medium">
                                                        {recruiter.company.name}
                                                    </p>

                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {recruiter.company.verification_status || "Status unavailable"}
                                                    </p>
                                                </>
                                            ) : (
                                                <span className="text-slate-500 text-sm">
                                                    No company
                                                </span>
                                            )}
                                        </td>

                                        {/* RECRUITER TYPE */}

                                        <td className="px-6 py-5">
                                            <span className={`px-3 py-1.5 rounded-full border text-xs font-medium ${recruiterTypeStyle(recruiter.recruiter_type)}`}>
                                                {recruiterTypeLabel(recruiter.recruiter_type)}
                                            </span>
                                        </td>

                                        {/* EMAIL STATUS */}

                                        <td className="px-6 py-5">
                                            {recruiter.email_verified ? (
                                                <span className="text-green-400 text-sm">
                                                    ✓ Verified
                                                </span>
                                            ) : (
                                                <span className="text-amber-400 text-sm">
                                                    Not verified
                                                </span>
                                            )}
                                        </td>

                                        {/* ACCOUNT STATUS */}

                                        <td className="px-6 py-5">
                                            {recruiter.is_blocked ? (
                                                <div>
                                                    <span className="px-3 py-1.5 rounded-full border border-red-500/20 bg-red-500/10 text-red-400 text-xs font-medium">
                                                        Blocked
                                                    </span>
                                                    {recruiter.blocked_reason && (
                                                        <p className="text-xs text-slate-500 mt-2 max-w-[180px] truncate">
                                                            {recruiter.blocked_reason}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="px-3 py-1.5 rounded-full border border-green-500/20 bg-green-500/10 text-green-400 text-xs font-medium">
                                                    Active
                                                </span>
                                            )}
                                        </td>

                                        {/* ACTION */}

                                        <td className="px-6 py-5">
                                            <button
                                                onClick={() => openRecruiterDetails(recruiter.id)}
                                                className="px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition text-sm"
                                            >
                                                View Details
                                            </button>
                                        </td>

                                    </tr>

                                ))}

                                {filteredRecruiters.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="text-center py-12 text-slate-500"
                                        >
                                            No recruiters found matching your filters.
                                        </td>
                                    </tr>
                                )}

                            </tbody>
                        </table>

                    </div>
                </section>
            </div>

            {/* RECRUITER DETAILS MODAL */}

            {(detailsLoading || detailsError || selectedRecruiter) && (

                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">

                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">

                        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                            <h2 className="text-xl font-bold">
                                Recruiter Details
                            </h2>

                            <button
                                onClick={() => {
                                    setSelectedRecruiter(null);
                                    setDetailsError("");
                                    setBlockError("");
                                    setBlockSuccess("");
                                    setShowBlockForm(false);
                                    setBlockReason("");
                                }}
                                className="text-slate-400 hover:text-white text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-6">

                            {detailsLoading && (
                                <p className="text-slate-400 text-center py-8">
                                    Loading recruiter details...
                                </p>
                            )}

                            {detailsError && (
                                <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                    {detailsError}
                                </div>
                            )}

                            {selectedRecruiter && (
                                <>

                                    {/* PROFILE */}

                                    <div className="flex items-center gap-4 mb-7">

                                        <div className="w-16 h-16 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center text-2xl font-bold">
                                            {selectedRecruiter.name?.charAt(0)?.toUpperCase() || "R"}
                                        </div>

                                        <div>
                                            <h3 className="text-xl font-bold">
                                                {selectedRecruiter.name}
                                            </h3>

                                            <p className="text-slate-400 text-sm">
                                                {selectedRecruiter.email}
                                            </p>

                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <span className={`px-3 py-1 rounded-full border text-xs ${recruiterTypeStyle(selectedRecruiter.recruiter_type)}`}>
                                                    {recruiterTypeLabel(selectedRecruiter.recruiter_type)}
                                                </span>

                                                {selectedRecruiter.is_blocked ? (
                                                    <span className="px-3 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-400 text-xs">
                                                        Blocked
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 rounded-full border border-green-500/20 bg-green-500/10 text-green-400 text-xs">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                    </div>

                                    {/* ACCOUNT INFORMATION */}

                                    <DetailSection title="Account Information">

                                        <DetailRow
                                            label="Recruiter ID"
                                            value={selectedRecruiter.id}
                                        />

                                        <DetailRow
                                            label="Email Verification"
                                            value={selectedRecruiter.email_verified ? "Verified" : "Not verified"}
                                        />

                                        <DetailRow
                                            label="Account Status"
                                            value={selectedRecruiter.is_blocked ? "Blocked" : "Active"}
                                        />

                                        <DetailRow
                                            label="Designation"
                                            value={selectedRecruiter.recruiter_profile?.designation || "Not provided"}
                                        />

                                        <DetailRow
                                            label="Profile ID"
                                            value={selectedRecruiter.recruiter_profile?.id ?? "No profile"}
                                        />

                                    </DetailSection>

                                    {/* BLOCKING INFORMATION */}

                                    {selectedRecruiter.is_blocked && (
                                        <DetailSection title="Blocking Information">

                                            <DetailRow
                                                label="Blocking Reason"
                                                value={selectedRecruiter.blocked_reason || "Not provided"}
                                            />

                                            <DetailRow
                                                label="Blocked At"
                                                value={
                                                    selectedRecruiter.blocked_at
                                                        ? new Date(selectedRecruiter.blocked_at).toLocaleString()
                                                        : "Not available"
                                                }
                                            />

                                        </DetailSection>
                                    )}

                                    {/* RECRUITER MODERATION */}

                                    <DetailSection title="Recruiter Moderation">

                                        {blockError && (
                                            <div className="p-3 text-sm text-red-400 bg-red-500/10 rounded-lg mb-3">
                                                {blockError}
                                            </div>
                                        )}

                                        {blockSuccess && (
                                            <div className="p-3 text-sm text-green-400 bg-green-500/10 rounded-lg mb-3">
                                                {blockSuccess}
                                            </div>
                                        )}

                                        {selectedRecruiter.is_blocked ? (
                                            <div className="space-y-4">
                                                <p className="text-sm text-slate-400">
                                                    This recruiter is currently blocked.
                                                    Their jobs are hidden from candidates,
                                                    and they cannot create or edit jobs.
                                                </p>

                                                <button
                                                    onClick={handleRecruiterBlock}
                                                    disabled={blockLoading}
                                                    className="w-full px-4 py-3 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 transition"
                                                >
                                                    {blockLoading
                                                        ? "Please wait..."
                                                        : "Unblock Recruiter"}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">

                                                <p className="text-sm text-slate-400">
                                                    Blocking this recruiter prevents
                                                    them from creating or editing jobs
                                                    and hides their jobs from candidates.
                                                </p>

                                                {!showBlockForm ? (
                                                    <button
                                                        onClick={() => {
                                                            setShowBlockForm(true);
                                                            setBlockError("");
                                                            setBlockSuccess("");
                                                        }}
                                                        className="w-full px-4 py-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition"
                                                    >
                                                        Block Recruiter
                                                    </button>
                                                ) : (
                                                    <div className="space-y-3">

                                                        <label className="block text-sm text-slate-300">
                                                            Reason for blocking
                                                        </label>

                                                        <textarea
                                                            value={blockReason}
                                                            onChange={(e) => setBlockReason(e.target.value)}
                                                            placeholder="Enter the reason for blocking this recruiter..."
                                                            maxLength={1000}
                                                            rows={4}
                                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-red-500 resize-y"
                                                        />

                                                        <p className="text-xs text-slate-500 text-right">
                                                            {blockReason.length}/1000
                                                        </p>

                                                        <div className="flex flex-wrap gap-3">

                                                            <button
                                                                onClick={handleRecruiterBlock}
                                                                disabled={blockLoading || !blockReason.trim()}
                                                                className="flex-1 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                            >
                                                                {blockLoading
                                                                    ? "Blocking..."
                                                                    : "Confirm Block"}
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setShowBlockForm(false);
                                                                    setBlockReason("");
                                                                    setBlockError("");
                                                                }}
                                                                disabled={blockLoading}
                                                                className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition"
                                                            >
                                                                Cancel
                                                            </button>

                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                    </DetailSection>

                                    {/* COMPANY INFORMATION */}

                                    <DetailSection title="Company Information">

                                        <DetailRow
                                            label="Company"
                                            value={selectedRecruiter.company?.name || "Not associated"}
                                        />

                                        <DetailRow
                                            label="Company ID"
                                            value={selectedRecruiter.company?.id ?? "—"}
                                        />

                                        <DetailRow
                                            label="Location"
                                            value={selectedRecruiter.company?.location || "Not provided"}
                                        />

                                        <DetailRow
                                            label="Website"
                                            value={selectedRecruiter.company?.website || "Not provided"}
                                        />

                                        <DetailRow
                                            label="Verification Status"
                                            value={selectedRecruiter.company?.verification_status || "Not applicable"}
                                        />

                                    </DetailSection>

                                    {/* JOIN REQUESTS */}

                                    <DetailSection title="Join Request Information">

                                        <DetailRow
                                            label="Pending Join Requests"
                                            value={selectedRecruiter.pending_join_requests}
                                        />

                                    </DetailSection>

                                </>
                            )}

                        </div>

                        <div className="p-6 border-t border-slate-800 flex justify-end">
                            <button
                                onClick={() => {
                                    setSelectedRecruiter(null);
                                    setDetailsError("");
                                    setBlockError("");
                                    setBlockSuccess("");
                                    setShowBlockForm(false);
                                    setBlockReason("");
                                }}
                                className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                            >
                                Close
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </main>
    );
}

// --------------------------------------------------
// SUMMARY CARD COMPONENT
// --------------------------------------------------

function SummaryCard({
    title,
    value,
    icon,
    color,
}: {
    title: string;
    value: number;
    icon: string;
    color: "blue" | "purple" | "green" | "amber" | "red";
}) {
    const colors = {
        blue: "border-blue-500/20 bg-blue-500/5",
        purple: "border-purple-500/20 bg-purple-500/5",
        green: "border-green-500/20 bg-green-500/5",
        amber: "border-amber-500/20 bg-amber-500/5",
        red: "border-red-500/20 bg-red-500/5",
    };

    return (
        <div className={`rounded-2xl border p-5 ${colors[color]}`}>
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{title}</p>
                <span className="text-2xl">{icon}</span>
            </div>

            <p className="text-3xl font-bold mt-4">
                {value}
            </p>
        </div>
    );
}

// --------------------------------------------------
// DETAIL SECTION COMPONENT
// --------------------------------------------------

function DetailSection({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="mb-6">
            <h4 className="font-semibold text-slate-200 mb-3">
                {title}
            </h4>

            <div className="rounded-xl border border-slate-800 divide-y divide-slate-800">
                {children}
            </div>
        </section>
    );
}

// --------------------------------------------------
// DETAIL ROW COMPONENT
// --------------------------------------------------

function DetailRow({
    label,
    value,
}: {
    label: string;
    value: string | number;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="text-sm text-slate-400">
                {label}
            </span>

            <span className="text-sm text-white text-right break-all">
                {value}
            </span>
        </div>
    );
}
