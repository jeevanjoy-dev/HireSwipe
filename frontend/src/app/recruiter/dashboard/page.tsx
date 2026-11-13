"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

// --------------------------------------------------
// INTERFACES
// --------------------------------------------------

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

interface Company {
    id: number;
    admin_user_id: number;
    name: string;
    description: string | null;
    location: string | null;
    website: string | null;
}

interface RecruiterProfile {
    id: number;
    user_id: number;
    designation: string | null;
    company: Company | null;
}

interface JoinRequest {
    id: number;
    recruiter_id: number;
    company_id: number;
    status: "pending" | "approved" | "rejected";
    created_at: string;
    reviewed_at: string | null;
    reviewed_by_user_id: number | null;
    recruiter_name: string;
    recruiter_email: string;
}

type RecruiterAccess =
    | {
          type: "admin";
          company: Company;
          profile: RecruiterProfile | null;
      }
    | {
          type: "secondary";
          company: Company;
          profile: RecruiterProfile;
      }
    | {
          type: "pending";
          company: null;
          profile: RecruiterProfile | null;
      }
    | {
          type: "unassociated";
          company: null;
          profile: RecruiterProfile | null;
      };

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

function isNotFound(error: unknown): boolean {
    if (error && typeof error === "object" && "status" in error) {
        if ((error as { status?: number }).status === 404) {
            return true;
        }
    }

    return (
        error instanceof Error &&
        error.message.toLowerCase().includes("not found")
    );
}

// --------------------------------------------------
// RECRUITER DASHBOARD
// --------------------------------------------------

export default function RecruiterDashboardPage() {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);

    const [recruiterAccess, setRecruiterAccess] =
        useState<RecruiterAccess | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Notification states
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [notificationError, setNotificationError] = useState("");
    const [reviewingRequestId, setReviewingRequestId] =
        useState<number | null>(null);

    // --------------------------------------------------
    // LOAD RECRUITER DASHBOARD
    // --------------------------------------------------

    useEffect(() => {
        let cancelled = false;

        async function loadDashboard() {
            try {
                const token = localStorage.getItem("access_token");

                if (!token) {
                    router.replace("/login");
                    return;
                }

                const userData: User = await apiRequest("/auth/me");

                if (userData.role !== "recruiter") {
                    router.replace("/dashboard");
                    return;
                }

                if (cancelled) return;

                setUser(userData);

                // 1. Check whether this recruiter is a Company Admin.
                let adminCompany: Company | null = null;

                try {
                    adminCompany = await apiRequest(
                        "/companies/my-admin-company"
                    );
                } catch (err) {
                    if (!isNotFound(err)) {
                        throw err;
                    }
                }

                if (adminCompany) {
                    let adminProfile: RecruiterProfile | null = null;

                    try {
                        adminProfile = await apiRequest(
                            "/recruiter/profile"
                        );
                    } catch (err) {
                        if (!isNotFound(err)) {
                            throw err;
                        }
                    }

                    if (cancelled) return;

                    setRecruiterAccess({
                        type: "admin",
                        company: adminCompany,
                        profile: adminProfile,
                    });

                    return;
                }

                // 2. Check whether the recruiter has a profile.
                let profileData: RecruiterProfile | null = null;

                try {
                    profileData = await apiRequest("/recruiter/profile");
                } catch (err) {
                    if (!isNotFound(err)) {
                        throw err;
                    }
                }

                // 3. Check whether the recruiter is associated with a company.
                if (profileData?.company) {
                    if (cancelled) return;

                    setRecruiterAccess({
                        type: "secondary",
                        company: profileData.company,
                        profile: profileData,
                    });

                    return;
                }

                // 4. Check join requests.
                const requests: JoinRequest[] = await apiRequest(
                    "/companies/join-requests/me"
                );

                const latestRequest = requests[0];

                if (latestRequest?.status === "approved") {
                    router.replace("/recruiter/onboarding");
                    return;
                }

                if (cancelled) return;

                if (latestRequest?.status === "pending") {
                    setRecruiterAccess({
                        type: "pending",
                        company: null,
                        profile: profileData,
                    });

                    return;
                }

                // 5. No company association.
                setRecruiterAccess({
                    type: "unassociated",
                    company: null,
                    profile: profileData,
                });
            } catch (err) {
                console.error("Recruiter dashboard error:", err);

                const status =
                    err && typeof err === "object" && "status" in err
                        ? (err as { status?: number }).status
                        : undefined;

                if (status === 401) {
                    localStorage.removeItem("access_token");
                    router.replace("/login");
                    return;
                }

                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load recruiter dashboard."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadDashboard();

        return () => {
            cancelled = true;
        };
    }, [router]);

    // --------------------------------------------------
    // LOAD COMPANY ADMIN NOTIFICATIONS
    // --------------------------------------------------

    useEffect(() => {
        if (recruiterAccess?.type !== "admin") {
            setJoinRequests([]);
            return;
        }

        let cancelled = false;

        const companyId = recruiterAccess.company.id;

        async function loadJoinRequests() {
            try {
                const requests: JoinRequest[] = await apiRequest(
                    `/companies/join-requests/company/${companyId}`
                );

                if (!cancelled) {
                    setJoinRequests(requests);
                    setNotificationError("");
                }
            } catch (err) {
                console.error("Unable to load join requests:", err);

                if (!cancelled) {
                    setNotificationError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load join requests."
                    );
                }
            }
        }

        // Load immediately.
        loadJoinRequests();

        // Refresh every 30 seconds.
        const interval = window.setInterval(
            loadJoinRequests,
            30000
        );

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [recruiterAccess]);

    // --------------------------------------------------
    // APPROVE / REJECT JOIN REQUEST
    // --------------------------------------------------

    const handleJoinRequestReview = async (
        requestId: number,
        decision: "approved" | "rejected"
    ) => {
        try {
            setReviewingRequestId(requestId);
            setNotificationError("");

            await apiRequest(`/companies/join-requests/${requestId}`, {
                method: "PUT",
                body: JSON.stringify({
                    status: decision,
                }),
            });

            // Immediately remove the reviewed request.
            setJoinRequests((previousRequests) =>
                previousRequests.filter(
                    (request) => request.id !== requestId
                )
            );
        } catch (error: unknown) {
            setNotificationError(
                error instanceof Error
                    ? error.message
                    : "Failed to review join request."
            );

            // Refresh notifications if the request was already reviewed.
            const companyId =
                recruiterAccess?.type === "admin"
                    ? recruiterAccess.company.id
                    : null;

            if (companyId !== null) {
                try {
                    const updatedRequests: JoinRequest[] = await apiRequest(
                        `/companies/join-requests/company/${companyId}`
                    );

                    setJoinRequests(updatedRequests);
                } catch {
                    console.error("Could not refresh join requests.");
                }
            }
        } finally {
            setReviewingRequestId(null);
        }
    };

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

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                Loading recruiter dashboard...
            </main>
        );
    }

    // --------------------------------------------------
    // ERROR
    // --------------------------------------------------

    if (error) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <p className="text-red-400">{error}</p>
            </main>
        );
    }

    if (!user || !recruiterAccess) {
        return null;
    }

    const company = recruiterAccess.company;
    const profile = recruiterAccess.profile;

    // --------------------------------------------------
    // DASHBOARD UI
    // --------------------------------------------------

    return (
        <main className="min-h-screen bg-slate-950 text-white">

            {/* NAVIGATION */}

            <nav className="border-b border-slate-800">
                <div className="mx-auto max-w-7xl px-6 py-5 flex justify-between items-center">

                    <h1 className="text-2xl font-bold">
                        <span className="text-blue-500">Hire</span>
                        Swipe
                    </h1>

                    <div className="flex items-center gap-4">

                        {/* COMPANY ADMIN NOTIFICATION BELL */}

                        {recruiterAccess.type === "admin" && (
                            <div className="relative">

                                <button
                                    onClick={() =>
                                        setNotificationOpen(
                                            (previous) => !previous
                                        )
                                    }
                                    className="relative rounded-lg border border-slate-700 p-3 hover:border-blue-500 transition"
                                    aria-label="Join request notifications"
                                    aria-expanded={notificationOpen}
                                >
                                    <span className="text-xl">
                                        🔔
                                    </span>

                                    {joinRequests.length > 0 && (
                                        <span className="absolute -top-2 -right-2 min-w-5 h-5 rounded-full bg-red-600 px-1 text-xs font-bold flex items-center justify-center">
                                            {joinRequests.length > 99
                                                ? "99+"
                                                : joinRequests.length}
                                        </span>
                                    )}
                                </button>

                                {/* NOTIFICATION DROPDOWN */}

                                {notificationOpen && (
                                    <div className="absolute right-0 top-14 z-50 w-80 sm:w-96 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">

                                        {/* DROPDOWN HEADER */}

                                        <div className="flex justify-between items-center border-b border-slate-800 p-4">

                                            <h3 className="font-semibold">
                                                Join Requests
                                            </h3>

                                            <span className="text-sm text-blue-400">
                                                {joinRequests.length} pending
                                            </span>
                                        </div>

                                        {/* REQUEST LIST */}

                                        <div className="max-h-96 overflow-y-auto">

                                            {notificationError && (
                                                <div className="p-4 text-sm text-red-400">
                                                    {notificationError}

                                                    <button
                                                        onClick={() => {
                                                            setNotificationError("");
                                                        }}
                                                        className="block mt-2 text-blue-400 hover:text-blue-300"
                                                    >
                                                        Dismiss
                                                    </button>
                                                </div>
                                            )}

                                            {joinRequests.length === 0 &&
                                                !notificationError && (
                                                    <div className="p-6 text-center">
                                                        <div className="text-3xl mb-3">
                                                            🔔
                                                        </div>

                                                        <p className="text-slate-400">
                                                            No pending join requests.
                                                        </p>
                                                    </div>
                                                )}

                                            {joinRequests.map((request) => (
                                                <div
                                                    key={request.id}
                                                    className="border-b border-slate-800 p-4"
                                                >

                                                    {/* RECRUITER INFORMATION */}

                                                    <div className="flex items-start gap-3">

                                                        <div className="h-10 w-10 shrink-0 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-semibold">
                                                            {(
                                                                request.recruiter_name ||
                                                                request.recruiter_email ||
                                                                "R"
                                                            )
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </div>

                                                        <div className="min-w-0 flex-1">

                                                            <h4 className="font-semibold text-sm">
                                                                {request.recruiter_name ||
                                                                    "Unknown Recruiter"}
                                                            </h4>

                                                            <p className="text-xs text-slate-400 break-all mt-1">
                                                                {request.recruiter_email}
                                                            </p>

                                                            <p className="text-xs text-slate-500 mt-2">
                                                                Requested to join your company
                                                            </p>

                                                            <p className="text-xs text-slate-500 mt-1">
                                                                {new Date(
                                                                    request.created_at
                                                                ).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* APPROVE / REJECT BUTTONS */}

                                                    <div className="flex gap-2 mt-4">

                                                        <button
                                                            disabled={
                                                                reviewingRequestId !== null
                                                            }
                                                            onClick={() =>
                                                                handleJoinRequestReview(
                                                                    request.id,
                                                                    "approved"
                                                                )
                                                            }
                                                            className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium hover:bg-green-500 disabled:opacity-50"
                                                        >
                                                            {reviewingRequestId ===
                                                            request.id
                                                                ? "Processing..."
                                                                : "Approve"}
                                                        </button>

                                                        <button
                                                            disabled={
                                                                reviewingRequestId !== null
                                                            }
                                                            onClick={() =>
                                                                handleJoinRequestReview(
                                                                    request.id,
                                                                    "rejected"
                                                                )
                                                            }
                                                            className="flex-1 rounded-lg bg-red-600/20 border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-600/30 disabled:opacity-50"
                                                        >
                                                            {reviewingRequestId ===
                                                            request.id
                                                                ? "Processing..."
                                                                : "Reject"}
                                                        </button>

                                                    </div>
                                                </div>
                                            ))}

                                        </div>

                                        {/* DROPDOWN FOOTER */}

                                        <div className="border-t border-slate-800 p-3">

                                            <button
                                                onClick={() =>
                                                    setNotificationOpen(false)
                                                }
                                                className="w-full text-center text-sm text-slate-400 hover:text-white"
                                            >
                                                Close
                                            </button>

                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* LOGOUT */}

                        <button
                            onClick={handleLogout}
                            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-red-500"
                        >
                            Logout
                        </button>

                    </div>
                </div>
            </nav>

            {/* MAIN DASHBOARD */}

            <div className="mx-auto max-w-7xl px-6 py-10">

                {/* WELCOME */}

                <section className="mb-10">
                    <p className="text-blue-400 text-sm uppercase tracking-wider mb-2">
                        Recruiter Portal
                    </p>

                    <h2 className="text-4xl font-bold">
                        Welcome, {user.name}
                    </h2>

                    <p className="mt-2 text-slate-400">
                        Manage your recruitment activities.
                    </p>
                </section>

                {/* COMPANY ADMIN */}

                {recruiterAccess.type === "admin" && company && (
                    <section className="mb-10 rounded-2xl border border-blue-500/30 bg-slate-900 p-6">

                        <h3 className="text-xl font-semibold text-blue-400">
                            Company Admin
                        </h3>

                        <p className="mt-2 text-slate-300">
                            You are the administrator of {company.name}.
                        </p>

                        <button
                            onClick={() =>
                                router.push("/recruiter/company_verification")
                            }
                            className="mt-5 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500"
                        >
                            Company Verification
                        </button>

                        {!profile && (
                            <button
                                onClick={() =>
                                    router.push("/recruiter/onboarding")
                                }
                                className="mt-4 rounded-lg bg-blue-600 px-5 py-2 hover:bg-blue-500"
                            >
                                Complete Recruiter Profile
                            </button>
                        )}

                    </section>
                )}

                {/* SECONDARY RECRUITER */}

                {recruiterAccess.type === "secondary" && company && (
                    <section className="mb-10 rounded-2xl border border-green-500/30 bg-slate-900 p-6">

                        <h3 className="text-xl font-semibold text-green-400">
                            Secondary Recruiter
                        </h3>

                        <p className="mt-2 text-slate-300">
                            You are associated with {company.name}.
                        </p>

                    </section>
                )}

                {/* PENDING REQUEST */}

                {recruiterAccess.type === "pending" && (
                    <section className="mb-10 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6">

                        <h3 className="text-xl font-semibold text-yellow-400">
                            Join Request Pending
                        </h3>

                        <p className="mt-2 text-slate-300">
                            Your request to join a company is waiting for
                            approval from the Company Admin.
                        </p>

                    </section>
                )}

                {/* UNASSOCIATED RECRUITER */}

                {recruiterAccess.type === "unassociated" && (
                    <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                        <h3 className="text-xl font-semibold text-yellow-400">
                            No Company Association
                        </h3>

                        <p className="mt-2 text-slate-400">
                            Connect your recruiter account with a company to
                            start managing recruitment activities.
                        </p>

                        <button
                            onClick={() =>
                                router.push("/recruiter/onboarding")
                            }
                            className="mt-4 rounded-lg bg-blue-600 px-5 py-2 hover:bg-blue-500"
                        >
                            Get Started
                        </button>

                    </section>
                )}

                {/* COMPANY INFORMATION */}

                {company && (
                    <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                        <h3 className="mb-4 text-xl font-semibold">
                            Company Information
                        </h3>

                        <h4 className="text-2xl font-bold">
                            {company.name}
                        </h4>

                        <p className="mt-2 text-slate-400">
                            {profile?.designation ||
                                (recruiterAccess.type === "admin"
                                    ? "Company Admin"
                                    : "Recruiter")}
                        </p>

                        <p className="mt-1 text-slate-500">
                            {company.location || "Location not provided"}
                        </p>

                        <button
                            onClick={() =>
                                router.push("/recruiter/company")
                            }
                            className="mt-5 text-blue-400 hover:text-blue-300"
                        >
                            View Company →
                        </button>

                    </section>
                )}

                {/* RECRUITMENT MANAGEMENT */}

                {(recruiterAccess.type === "admin" ||
                    recruiterAccess.type === "secondary") && (

                    <section>

                        <h3 className="text-2xl font-bold mb-5">
                            Recruitment Management
                        </h3>

                        {/* FOUR CARDS IN ONE HORIZONTAL ROW */}

                        <div className="grid grid-cols-4 gap-3">

                            {/* MY JOBS */}

                            <button
                                onClick={() =>
                                    router.push("/recruiter/jobs")
                                }
                                className="min-w-0 min-h-[150px] rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:border-blue-500 transition flex flex-col"
                            >
                                <div className="text-3xl mb-4">
                                    💼
                                </div>

                                <h4 className="text-base font-semibold">
                                    My Jobs
                                </h4>

                                <p className="mt-2 text-xs text-slate-400">
                                    View, edit and manage your job postings.
                                </p>
                            </button>

                            {/* POST A JOB */}

                            <button
                                onClick={() =>
                                    router.push("/recruiter/jobs/create")
                                }
                                className="min-w-0 min-h-[150px] rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:border-green-500 transition flex flex-col"
                            >
                                <div className="text-3xl mb-4">
                                    ➕
                                </div>

                                <h4 className="text-base font-semibold">
                                    Post a Job
                                </h4>

                                <p className="mt-2 text-xs text-slate-400">
                                    Create new job opportunities.
                                </p>
                            </button>

                            {/* APPLICATIONS */}

                            <button
                                onClick={() =>
                                    router.push("/recruiter/applications")
                                }
                                className="min-w-0 min-h-[150px] rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:border-purple-500 transition flex flex-col"
                            >
                                <div className="text-3xl mb-4">
                                    👥
                                </div>

                                <h4 className="text-base font-semibold">
                                    Applications
                                </h4>

                                <p className="mt-2 text-xs text-slate-400">
                                    Review candidates and manage applications.
                                </p>
                            </button>

                            {/* MY PROFILE */}

                            <button
                                onClick={() =>
                                    router.push("/recruiter/profile")
                                }
                                className="min-w-0 min-h-[150px] rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:border-blue-500 transition flex flex-col"
                            >
                                <div className="text-3xl mb-4">
                                    👤
                                </div>

                                <h4 className="text-base font-semibold">
                                    My Profile
                                </h4>

                                <p className="mt-2 text-xs text-slate-400">
                                    View and edit your personal profile.
                                </p>
                            </button>

                        </div>
                    </section>
                )}

                {/* FOOTER */}

                <footer className="mt-16 border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
                    HireSwipe • Recruiter Portal
                </footer>

            </div>
        </main>
    );
}