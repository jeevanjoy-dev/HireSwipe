
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

interface Company {
    id: number;
    name: string;
    website: string | null;
    business_email: string | null;
    business_email_verified: boolean;
    domain_match: boolean;
    business_phone: string | null;
    business_address: string | null;
    document_1_uploaded: boolean;
    document_2_uploaded: boolean;
    documents_status: string;
    verification_status: string;
}

type StatusFilter = "all" | "verified" | "pending_review" | "unverified" | "rejected";

export default function AdminCompaniesPage() {
    const router = useRouter();

    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

    // Load all registered companies from the admin API.
    const loadCompanies = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const data = await apiRequest<Company[]>("/admin/companies");

            setCompanies(data);
        } catch (err) {
            console.error("Companies loading error:", err);

            const status =
                err && typeof err === "object" && "status" in err
                    ? (err as { status?: number }).status
                    : undefined;

            if (status === 401 || status === 403) {
                localStorage.removeItem("access_token");
                router.replace("/login");
                return;
            }

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load companies."
            );
        } finally {
            setLoading(false);
        }
    }, [router]);

    // Verify that the logged-in user is a Platform Admin.
    useEffect(() => {
        async function initializePage() {
            try {
                const token = localStorage.getItem("access_token");

                if (!token) {
                    router.replace("/login");
                    return;
                }

                const user = await apiRequest<{ role: string }>("/auth/me");

                if (user.role !== "admin") {
                    router.replace("/dashboard");
                    return;
                }

                await loadCompanies();
            } catch (err) {
                console.error("Admin authentication error:", err);
                localStorage.removeItem("access_token");
                router.replace("/login");
            }
        }

        initializePage();
    }, [router, loadCompanies]);

    // Filter companies using the search text and selected status.
    const filteredCompanies = useMemo(() => {
        return companies.filter((company) => {
            const searchValue = search.trim().toLowerCase();

            const matchesSearch =
                company.name.toLowerCase().includes(searchValue) ||
                (company.business_email || "").toLowerCase().includes(searchValue) ||
                (company.website || "").toLowerCase().includes(searchValue);

            const matchesStatus =
                statusFilter === "all" ||
                company.verification_status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [companies, search, statusFilter]);

    // Calculate company statistics from the loaded records.
    const verifiedCount = companies.filter(
        (company) => company.verification_status === "verified"
    ).length;

    const pendingCount = companies.filter(
        (company) => company.verification_status === "pending_review"
    ).length;

    const rejectedCount = companies.filter(
        (company) => company.verification_status === "rejected"
    ).length;

    const unverifiedCount = companies.filter(
        (company) => company.verification_status === "unverified"
    ).length;

    // Return a readable status label.
    function formatStatus(status: string) {
        return status.replaceAll("_", " ");
    }

    // Choose a status color for each verification state.
    function getStatusStyle(status: string) {
        switch (status) {
            case "verified":
                return "bg-green-500/10 text-green-400 border-green-500/20";

            case "pending_review":
                return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";

            case "rejected":
                return "bg-red-500/10 text-red-400 border-red-500/20";

            default:
                return "bg-slate-700/50 text-slate-400 border-slate-700";
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
                    <p className="text-slate-400">Loading companies...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 text-white">

            {/* TOP NAVIGATION */}
            <nav className="border-b border-slate-800 bg-slate-950">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

                    <button
                        onClick={() => router.push("/admin/dashboard")}
                        className="text-2xl font-bold"
                    >
                        <span className="text-blue-500">Hire</span>Swipe
                        <span className="ml-3 text-xs text-blue-400">
                            PLATFORM ADMIN
                        </span>
                    </button>

                    <button
                        onClick={() => router.push("/admin/dashboard")}
                        className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-blue-500 hover:text-blue-400"
                    >
                        ← Dashboard
                    </button>

                </div>
            </nav>

            <div className="mx-auto max-w-7xl px-6 py-10">

                {/* PAGE HEADER */}
                <div className="mb-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

                    <div>
                        <p className="mb-2 text-sm font-medium text-blue-400">
                            PLATFORM MANAGEMENT
                        </p>

                        <h1 className="text-3xl font-bold">
                            Companies
                        </h1>

                        <p className="mt-2 text-slate-400">
                            View and monitor all companies registered on HireSwipe.
                        </p>
                    </div>

                    <button
                        onClick={loadCompanies}
                        className="rounded-lg border border-slate-700 px-5 py-3 text-sm text-slate-300 transition hover:border-blue-500 hover:text-blue-400"
                    >
                        ↻ Refresh Companies
                    </button>

                </div>

                {/* ERROR MESSAGE */}
                {error && (
                    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* STATISTICS */}
                <section className="mb-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                    {[
                        {
                            title: "Total Companies",
                            value: companies.length,
                            color: "text-blue-400",
                            icon: "🏢",
                        },
                        {
                            title: "Verified",
                            value: verifiedCount,
                            color: "text-green-400",
                            icon: "✓",
                        },
                        {
                            title: "Pending Review",
                            value: pendingCount,
                            color: "text-yellow-400",
                            icon: "⏳",
                        },
                        {
                            title: "Rejected / Unverified",
                            value: rejectedCount + unverifiedCount,
                            color: "text-red-400",
                            icon: "!",
                        },
                    ].map((item) => (
                        <div
                            key={item.title}
                            className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-400">
                                    {item.title}
                                </p>
                                <span className="text-xl">{item.icon}</span>
                            </div>

                            <p className={`mt-4 text-3xl font-bold ${item.color}`}>
                                {item.value}
                            </p>
                        </div>
                    ))}

                </section>

                {/* SEARCH AND FILTER */}
                <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">

                    <div className="grid gap-4 md:grid-cols-2">

                        <div>
                            <label className="mb-2 block text-sm text-slate-400">
                                Search Companies
                            </label>

                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by company name, email or website..."
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm text-slate-400">
                                Verification Status
                            </label>

                            <select
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value as StatusFilter)
                                }
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                            >
                                <option value="all">All Companies</option>
                                <option value="verified">Verified</option>
                                <option value="pending_review">Pending Review</option>
                                <option value="unverified">Unverified</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>

                    </div>

                    <p className="mt-4 text-xs text-slate-500">
                        Showing {filteredCompanies.length} of {companies.length} companies
                    </p>

                </section>

                {/* COMPANY TABLE */}
                <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

                    <div className="border-b border-slate-800 px-6 py-5">
                        <h2 className="text-lg font-semibold">
                            Registered Companies
                        </h2>
                    </div>

                    {filteredCompanies.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="mb-3 text-4xl">🏢</div>

                            <p className="font-semibold">
                                No companies found
                            </p>

                            <p className="mt-2 text-sm text-slate-400">
                                Try changing your search or status filter.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[850px] text-left">

                                <thead className="bg-slate-950/70 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-6 py-4">Company</th>
                                        <th className="px-6 py-4">Business Email</th>
                                        <th className="px-6 py-4">Email Verification</th>
                                        <th className="px-6 py-4">Documents</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Action</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-800">

                                    {filteredCompanies.map((company) => (
                                        <tr
                                            key={company.id}
                                            className="transition hover:bg-slate-800/40"
                                        >

                                            <td className="px-6 py-5">
                                                <p className="font-semibold text-white">
                                                    {company.name}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Company #{company.id}
                                                </p>
                                                <p className="mt-1 max-w-[180px] truncate text-xs text-slate-400">
                                                    {company.website || "Website not provided"}
                                                </p>
                                            </td>

                                            <td className="px-6 py-5">
                                                <p className="max-w-[200px] break-all text-sm text-slate-300">
                                                    {company.business_email || "Not provided"}
                                                </p>
                                            </td>

                                            <td className="px-6 py-5">
                                                <span className={`text-xs font-medium ${
                                                    company.business_email_verified
                                                        ? "text-green-400"
                                                        : "text-red-400"
                                                }`}>
                                                    {company.business_email_verified
                                                        ? "✓ Verified"
                                                        : "✕ Not verified"}
                                                </span>

                                                <p className={`mt-1 text-xs ${
                                                    company.domain_match
                                                        ? "text-green-400"
                                                        : "text-slate-500"
                                                }`}>
                                                    {company.domain_match
                                                        ? "Domain matched"
                                                        : "Domain not matched"}
                                                </p>
                                            </td>

                                            <td className="px-6 py-5">
                                                <div className="space-y-1 text-xs">
                                                    <p className={company.document_1_uploaded ? "text-green-400" : "text-red-400"}>
                                                        Document 1: {company.document_1_uploaded ? "Uploaded" : "Missing"}
                                                    </p>

                                                    <p className={company.document_2_uploaded ? "text-green-400" : "text-red-400"}>
                                                        Document 2: {company.document_2_uploaded ? "Uploaded" : "Missing"}
                                                    </p>
                                                </div>
                                            </td>

                                            <td className="px-6 py-5">
                                                <span className={`inline-block rounded-full border px-3 py-1 text-xs font-medium capitalize ${getStatusStyle(company.verification_status)}`}>
                                                    {formatStatus(company.verification_status)}
                                                </span>
                                            </td>

                                            <td className="px-6 py-5">
                                                <button
                                                    onClick={() =>
                                                        router.push("/admin/company_verification")
                                                    }
                                                    className="whitespace-nowrap rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-400 transition hover:bg-blue-500/20"
                                                >
                                                    Review →
                                                </button>
                                            </td>

                                        </tr>
                                    ))}

                                </tbody>
                            </table>
                        </div>
                    )}

                </section>

            </div>
        </main>
    );
}
