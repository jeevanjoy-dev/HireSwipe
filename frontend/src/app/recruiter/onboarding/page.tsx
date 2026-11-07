"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

interface Company {
    id: number;
    name: string;
    description: string | null;
    location: string | null;
    website: string | null;
}

interface JoinRequest {
    id: number;
    company_id: number;
    status: "pending" | "approved" | "rejected";
    created_at: string;
}

interface RecruiterProfile {
    id: number;
    user_id: number;
    company_id: number | null;
    designation: string | null;
    company: Company | null;
}

type PageState = "loading" | "choice" | "pending" | "profile";

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

export default function RecruiterOnboardingPage() {
    const router = useRouter();

    const [pageState, setPageState] = useState<PageState>("loading");
    const [tab, setTab] = useState<"create" | "join">("create");

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [company, setCompany] = useState<Company | null>(null);
    const [joinRequest, setJoinRequest] = useState<JoinRequest | null>(null);

    const [companies, setCompanies] = useState<Company[]>([]);
    const [search, setSearch] = useState("");
    const [selectedCompany, setSelectedCompany] =
        useState<Company | null>(null);

    const [designation, setDesignation] = useState("");

    const [companyForm, setCompanyForm] = useState({
        name: "",
        description: "",
        location: "",
        website: "",
    });

    // ------------------------------------
    // INITIALIZE ONBOARDING
    // ------------------------------------

    useEffect(() => {
        let cancelled = false;

        async function initialize() {
            try {
                const token = localStorage.getItem("access_token");

                if (!token) {
                    router.replace("/login");
                    return;
                }

                const user = await apiRequest("/auth/me");

                if (user.role !== "recruiter") {
                    router.replace("/dashboard");
                    return;
                }

                // 1. Check whether the recruiter already has a profile.
                let existingProfile: RecruiterProfile | null = null;

                try {
                    existingProfile = await apiRequest(
                        "/recruiter/profile"
                    );
                } catch (err) {
                    if (!isNotFound(err)) {
                        throw err;
                    }
                }

                if (
                    existingProfile?.company_id != null ||
                    existingProfile?.company?.id != null
                   ) {
                     router.replace("/recruiter/dashboard");
                     return;
                   }

                // 2. Check whether the recruiter is a Company Admin.
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
                    if (cancelled) return;

                    setCompany(adminCompany);

                    // Preserve an existing designation if available.
                    if (existingProfile?.designation) {
                        setDesignation(existingProfile.designation);
                    }

                    setPageState("profile");
                    return;
                }

                // 3. Check the recruiter's join requests.
                const requests: JoinRequest[] = await apiRequest(
                    "/companies/join-requests/me"
                );

                const latestRequest = requests[0] ?? null;

                if (latestRequest) {
                    if (cancelled) return;

                    setJoinRequest(latestRequest);

                    if (latestRequest.status === "pending") {
                        setPageState("pending");
                        return;
                    }

                    if (latestRequest.status === "approved") {
                        // Approved recruiters can complete their profile.
                        if (existingProfile?.designation) {
                            setDesignation(existingProfile.designation);
                        }

                        setPageState("profile");
                        return;
                    }

                    if (latestRequest.status === "rejected") {
                        setSuccess(
                            "Your previous request was rejected. You can try another company."
                        );
                    }
                }

                if (cancelled) return;

                // No company and no approved/pending request.
                setPageState("choice");
            } catch (err) {
                console.error("Recruiter onboarding error:", err);

                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load onboarding."
                    );

                    setPageState("choice");
                }
            }
        }

        initialize();

        return () => {
            cancelled = true;
        };
    }, [router]);

    // ------------------------------------
    // CREATE COMPANY
    // ------------------------------------

    async function handleCreateCompany(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        setError("");
        setSuccess("");
        setSubmitting(true);

        try {
            const createdCompany: Company = await apiRequest(
                "/companies/",
                {
                    method: "POST",
                    body: JSON.stringify(companyForm),
                }
            );

            setCompany(createdCompany);

            setSuccess(
                "Company created successfully. You are now the Company Admin."
            );

            setPageState("profile");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to create company."
            );
        } finally {
            setSubmitting(false);
        }
    }

    // ------------------------------------
    // SEARCH COMPANIES
    // ------------------------------------

    async function handleSearch(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        setError("");
        setCompanies([]);
        setSelectedCompany(null);

        try {
            const results: Company[] = await apiRequest(
                `/companies/?search=${encodeURIComponent(search)}`
            );

            setCompanies(results);

            if (results.length === 0) {
                setError("No companies found.");
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to search companies."
            );
        }
    }

    // ------------------------------------
    // REQUEST TO JOIN COMPANY
    // ------------------------------------

    async function handleJoinCompany() {
        if (!selectedCompany) {
            setError("Please select a company.");
            return;
        }

        setError("");
        setSuccess("");
        setSubmitting(true);

        try {
            const request: JoinRequest = await apiRequest(
                "/companies/join-requests",
                {
                    method: "POST",
                    body: JSON.stringify({
                        company_id: selectedCompany.id,
                    }),
                }
            );

            setJoinRequest(request);
            setPageState("pending");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to submit request."
            );
        } finally {
            setSubmitting(false);
        }
    }

    // ------------------------------------
    // CREATE RECRUITER PROFILE
    // ------------------------------------

    async function handleCreateProfile(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        setError("");
        setSubmitting(true);

        try {
            await apiRequest("/recruiter/profile", {
                method: "POST",
                body: JSON.stringify({
                    designation: designation,
                }),
            });

            router.replace("/dashboard");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to create recruiter profile."
            );
        } finally {
            setSubmitting(false);
        }
    }

    // ------------------------------------
    // LOADING
    // ------------------------------------

    if (pageState === "loading") {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                Loading onboarding...
            </main>
        );
    }

    // ------------------------------------
    // PAGE UI
    // ------------------------------------

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <nav className="border-b border-slate-800 px-6 py-5">
                <div className="mx-auto max-w-3xl flex justify-between items-center">
                    <h1 className="text-2xl font-bold">
                        <span className="text-blue-500">Hire</span>Swipe
                    </h1>

                    <button
                        onClick={() => {
                            localStorage.removeItem("access_token");
                            router.replace("/login");
                        }}
                        className="text-sm text-slate-400 hover:text-white"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            <div className="mx-auto max-w-3xl px-6 py-12">
                <h2 className="text-3xl font-bold">
                    Recruiter Onboarding
                </h2>

                <p className="mt-2 text-slate-400">
                    Connect your recruiter account with a company.
                </p>

                {error && (
                    <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-400">
                        {success}
                    </div>
                )}

                {/* STATE 1: CREATE COMPANY OR JOIN COMPANY */}

                {pageState === "choice" && (
                    <>
                        <div className="mt-8 grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setTab("create")}
                                className={`rounded-xl p-4 font-semibold ${
                                    tab === "create"
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-900 text-slate-400"
                                }`}
                            >
                                Create Company
                            </button>

                            <button
                                onClick={() => setTab("join")}
                                className={`rounded-xl p-4 font-semibold ${
                                    tab === "join"
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-900 text-slate-400"
                                }`}
                            >
                                Join Company
                            </button>
                        </div>

                        {/* CREATE COMPANY */}

                        {tab === "create" && (
                            <form
                                onSubmit={handleCreateCompany}
                                className="mt-6 space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6"
                            >
                                <h3 className="text-xl font-semibold">
                                    Create Your Company
                                </h3>

                                <p className="text-sm text-slate-400">
                                    You will automatically become the Company
                                    Admin.
                                </p>

                                <div>
                                    <label className="mb-2 block text-sm">
                                        Company Name *
                                    </label>

                                    <input
                                        required
                                        value={companyForm.name}
                                        onChange={(e) =>
                                            setCompanyForm({
                                                ...companyForm,
                                                name: e.target.value,
                                            })
                                        }
                                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm">
                                        Location
                                    </label>

                                    <input
                                        value={companyForm.location}
                                        onChange={(e) =>
                                            setCompanyForm({
                                                ...companyForm,
                                                location: e.target.value,
                                            })
                                        }
                                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm">
                                        Website
                                    </label>

                                    <input
                                        type="url"
                                        value={companyForm.website}
                                        onChange={(e) =>
                                            setCompanyForm({
                                                ...companyForm,
                                                website: e.target.value,
                                            })
                                        }
                                        placeholder="https://example.com"
                                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm">
                                        Description
                                    </label>

                                    <textarea
                                        rows={4}
                                        value={companyForm.description}
                                        onChange={(e) =>
                                            setCompanyForm({
                                                ...companyForm,
                                                description: e.target.value,
                                            })
                                        }
                                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
                                    />
                                </div>

                                <button
                                    disabled={submitting}
                                    className="w-full rounded-lg bg-blue-600 py-3 font-semibold disabled:opacity-50"
                                >
                                    {submitting
                                        ? "Creating..."
                                        : "Create Company"}
                                </button>
                            </form>
                        )}

                        {/* JOIN COMPANY */}

                        {tab === "join" && (
                            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                                <h3 className="text-xl font-semibold">
                                    Find Your Company
                                </h3>

                                <form
                                    onSubmit={handleSearch}
                                    className="mt-5 flex gap-3"
                                >
                                    <input
                                        required
                                        value={search}
                                        onChange={(e) =>
                                            setSearch(e.target.value)
                                        }
                                        placeholder="Search company name..."
                                        className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
                                    />

                                    <button className="rounded-lg bg-blue-600 px-5 font-semibold">
                                        Search
                                    </button>
                                </form>

                                <div className="mt-5 space-y-3">
                                    {companies.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() =>
                                                setSelectedCompany(item)
                                            }
                                            className={`w-full rounded-xl border p-4 text-left ${
                                                selectedCompany?.id ===
                                                item.id
                                                    ? "border-blue-500 bg-blue-500/10"
                                                    : "border-slate-700 bg-slate-950"
                                            }`}
                                        >
                                            <h4 className="font-semibold">
                                                {item.name}
                                            </h4>

                                            <p className="mt-1 text-sm text-slate-400">
                                                {item.location}
                                            </p>

                                            {item.description && (
                                                <p className="mt-2 text-sm text-slate-500">
                                                    {item.description}
                                                </p>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleJoinCompany}
                                    disabled={!selectedCompany || submitting}
                                    className="mt-6 w-full rounded-lg bg-blue-600 py-3 font-semibold disabled:opacity-40"
                                >
                                    {submitting
                                        ? "Submitting..."
                                        : "Request to Join"}
                                </button>
                            </section>
                        )}
                    </>
                )}

                {/* STATE 2: REQUEST PENDING */}

                {pageState === "pending" && (
                    <section className="mt-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6">
                        <h3 className="text-xl font-semibold text-yellow-400">
                            Join Request Pending
                        </h3>

                        <p className="mt-3 text-slate-300">
                            Your request to join company ID{" "}
                            {joinRequest?.company_id} is waiting for approval.
                        </p>

                        <p className="mt-3 text-sm text-slate-400">
                            You can create your recruiter profile once the
                            Company Admin approves your request.
                        </p>
                    </section>
                )}

                {/* STATE 3: CREATE RECRUITER PROFILE */}

                {pageState === "profile" && (
                    <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                        <h3 className="text-xl font-semibold">
                            Create Recruiter Profile
                        </h3>

                        {company && (
                            <div className="mt-4 rounded-lg bg-slate-950 p-4">
                                <p className="text-sm text-slate-400">
                                    Company
                                </p>

                                <p className="mt-1 font-semibold">
                                    {company.name}
                                </p>

                                <p className="mt-2 text-sm text-green-400">
                                    You are the Company Admin.
                                </p>
                            </div>
                        )}

                        {joinRequest?.status === "approved" && (
                            <p className="mt-3 text-sm text-green-400">
                                Your company join request has been approved.
                            </p>
                        )}

                        <form
                            onSubmit={handleCreateProfile}
                            className="mt-6 space-y-5"
                        >
                            <div>
                                <label className="mb-2 block text-sm">
                                    Designation *
                                </label>

                                <input
                                    required
                                    value={designation}
                                    onChange={(e) =>
                                        setDesignation(e.target.value)
                                    }
                                    placeholder="e.g. HR Manager"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
                                />
                            </div>

                            <button
                                disabled={submitting}
                                className="w-full rounded-lg bg-blue-600 py-3 font-semibold disabled:opacity-50"
                            >
                                {submitting
                                    ? "Creating Profile..."
                                    : "Create Recruiter Profile"}
                            </button>
                        </form>
                    </section>
                )}
            </div>
        </main>
    );
}