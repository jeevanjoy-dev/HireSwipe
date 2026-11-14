
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFileRequest, apiRequest } from "../../../services/api";

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

interface CompanyDetails extends Company {
    description: string | null;
    business_email_verified_at: string | null;
    website_domain: string | null;
    email_domain: string | null;
}

export default function CompanyVerificationPage() {
    const router = useRouter();

    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompany, setSelectedCompany] =
        useState<CompanyDetails | null>(null);

    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // --------------------------------------------------
    // LOAD PENDING COMPANIES
    // --------------------------------------------------

    const loadCompanies = useCallback(async () => {
        try {
            setError("");

            const data: Company[] = await apiRequest(
                "/admin/companies/pending"
            );

            setCompanies(data);
        } catch (err) {
            console.error("Company loading error:", err);

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
                    : "Unable to load pending companies."
            );
        } finally {
            setLoading(false);
        }
    }, [router]);

    // --------------------------------------------------
    // CHECK ADMIN ACCESS AND LOAD DATA
    // --------------------------------------------------

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

    // --------------------------------------------------
    // LOAD SELECTED COMPANY DETAILS
    // --------------------------------------------------

    async function handleViewCompany(companyId: number) {
        try {
            setDetailsLoading(true);
            setError("");
            setSuccess("");

            const data: CompanyDetails = await apiRequest(
                `/admin/companies/${companyId}`
            );

            setSelectedCompany(data);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load company details."
            );
        } finally {
            setDetailsLoading(false);
        }
    }

    // --------------------------------------------------
    // VIEW VERIFICATION DOCUMENT
    // --------------------------------------------------

    async function handleViewDocument(
        companyId: number,
        documentNumber: number
    ) {
        try {
            setError("");

            const blob = await apiFileRequest(
                `/admin/companies/${companyId}/documents/${documentNumber}`
            );

            const fileUrl = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = fileUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            document.body.appendChild(link);
            link.click();
            link.remove();

            // Keep the URL available while the new tab loads.
            window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to open verification document."
            );
        }
    }

    // --------------------------------------------------
    // APPROVE COMPANY
    // --------------------------------------------------

    async function handleApprove(companyId: number) {
        const confirmed = window.confirm(
            "Are you sure you want to approve this company?"
        );

        if (!confirmed) return;

        try {
            setActionLoading(true);
            setError("");
            setSuccess("");

            const response = await apiRequest(
                `/admin/companies/${companyId}/approve`,
                {
                    method: "PUT",
                }
            );

            setSuccess(
                response.message || "Company verified successfully."
            );

            setSelectedCompany(null);
            await loadCompanies();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to approve company."
            );
        } finally {
            setActionLoading(false);
        }
    }

    // --------------------------------------------------
    // REJECT COMPANY
    // --------------------------------------------------

    async function handleReject(companyId: number) {
        const confirmed = window.confirm(
            "Are you sure you want to reject this company's verification?"
        );

        if (!confirmed) return;

        try {
            setActionLoading(true);
            setError("");
            setSuccess("");

            const response = await apiRequest(
                `/admin/companies/${companyId}/reject`,
                {
                    method: "PUT",
                }
            );

            setSuccess(
                response.message || "Company verification rejected."
            );

            setSelectedCompany(null);
            await loadCompanies();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to reject company."
            );
        } finally {
            setActionLoading(false);
        }
    }

    // --------------------------------------------------
    // LOADING SCREEN
    // --------------------------------------------------

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
                    <p className="text-slate-400">
                        Loading company verifications...
                    </p>
                </div>
            </main>
        );
    }

    // --------------------------------------------------
    // MAIN PAGE
    // --------------------------------------------------

    return (
        <main className="min-h-screen bg-slate-950 text-white">

            {/* NAVIGATION */}
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
                <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

                    <div>
                        <p className="mb-2 text-sm font-medium text-blue-400">
                            PLATFORM MANAGEMENT
                        </p>

                        <h1 className="text-3xl font-bold">
                            Company Verification
                        </h1>

                        <p className="mt-2 text-slate-400">
                            Review company information and submitted documents.
                        </p>
                    </div>

                    <button
                        onClick={loadCompanies}
                        className="rounded-lg border border-slate-700 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-blue-500 hover:text-blue-400"
                    >
                        ↻ Refresh
                    </button>

                </div>

                {/* SUCCESS MESSAGE */}
                {success && (
                    <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
                        {success}
                    </div>
                )}

                {/* ERROR MESSAGE */}
                {error && (
                    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* PENDING COUNT */}
                <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                    <p className="text-sm text-slate-400">
                        Companies awaiting review
                    </p>

                    <p className="mt-2 text-3xl font-bold text-yellow-400">
                        {companies.length}
                    </p>
                </div>

                {/* COMPANY LIST AND DETAILS */}
                <div className="grid gap-8 lg:grid-cols-5">

                    {/* PENDING COMPANY LIST */}
                    <section className="lg:col-span-2">

                        <h2 className="mb-5 text-xl font-semibold">
                            Pending Companies
                        </h2>

                        {companies.length === 0 ? (
                            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
                                <div className="mb-3 text-4xl">✓</div>
                                <p className="font-semibold">
                                    No pending verifications
                                </p>
                                <p className="mt-2 text-sm text-slate-400">
                                    All submitted companies have been reviewed.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {companies.map((company) => (
                                    <button
                                        key={company.id}
                                        onClick={() =>
                                            handleViewCompany(company.id)
                                        }
                                        className={`w-full rounded-2xl border p-5 text-left transition ${
                                            selectedCompany?.id === company.id
                                                ? "border-blue-500 bg-blue-500/10"
                                                : "border-slate-800 bg-slate-900 hover:border-slate-600"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="font-semibold">
                                                    {company.name}
                                                </h3>

                                                <p className="mt-2 break-all text-sm text-slate-400">
                                                    {company.business_email || "No business email"}
                                                </p>
                                            </div>

                                            <span className="shrink-0 rounded-full bg-yellow-500/10 px-3 py-1 text-xs text-yellow-400">
                                                Pending
                                            </span>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                                            <span>Company #{company.id}</span>
                                            <span>View details →</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                    </section>

                    {/* COMPANY DETAILS */}
                    <section className="lg:col-span-3">

                        <h2 className="mb-5 text-xl font-semibold">
                            Verification Review
                        </h2>

                        {detailsLoading ? (
                            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
                                <p className="text-slate-400">
                                    Loading company details...
                                </p>
                            </div>
                        ) : !selectedCompany ? (
                            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
                                <div>
                                    <div className="mb-3 text-4xl">🏢</div>
                                    <p className="font-semibold">
                                        Select a company
                                    </p>
                                    <p className="mt-2 text-sm text-slate-400">
                                        Choose a company from the pending list to review its details.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

                                {/* COMPANY INFORMATION */}
                                <div className="mb-7 border-b border-slate-800 pb-6">

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <h3 className="text-2xl font-bold">
                                            {selectedCompany.name}
                                        </h3>

                                        <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs text-yellow-400">
                                            Pending Review
                                        </span>
                                    </div>

                                    <p className="mt-2 text-sm text-slate-400">
                                        Company ID: #{selectedCompany.id}
                                    </p>

                                    <p className="mt-4 text-sm leading-6 text-slate-300">
                                        {selectedCompany.description || "No company description provided."}
                                    </p>
                                </div>

                                {/* BUSINESS DETAILS */}
                                <div className="mb-7">

                                    <h4 className="mb-4 font-semibold">
                                        Business Information
                                    </h4>

                                    <div className="grid gap-5 sm:grid-cols-2">

                                        <div>
                                            <p className="text-xs text-slate-500">
                                                Website
                                            </p>
                                            <p className="mt-1 break-all text-sm text-slate-200">
                                                {selectedCompany.website || "Not provided"}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-slate-500">
                                                Business Email
                                            </p>
                                            <p className="mt-1 break-all text-sm text-slate-200">
                                                {selectedCompany.business_email || "Not provided"}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-slate-500">
                                                Business Phone
                                            </p>
                                            <p className="mt-1 text-sm text-slate-200">
                                                {selectedCompany.business_phone || "Not provided"}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-slate-500">
                                                Business Address
                                            </p>
                                            <p className="mt-1 text-sm text-slate-200">
                                                {selectedCompany.business_address || "Not provided"}
                                            </p>
                                        </div>

                                    </div>
                                </div>

                                {/* EMAIL VERIFICATION */}
                                <div className="mb-7 rounded-xl border border-slate-800 bg-slate-950 p-5">

                                    <h4 className="mb-4 font-semibold">
                                        Email Verification
                                    </h4>

                                    <div className="space-y-3 text-sm">

                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-400">
                                                Business email OTP
                                            </span>

                                            <span className={selectedCompany.business_email_verified ? "text-green-400" : "text-red-400"}>
                                                {selectedCompany.business_email_verified ? "Verified" : "Not verified"}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-400">
                                                Website domain
                                            </span>
                                            <span className="text-slate-200">
                                                {selectedCompany.website_domain || "Unavailable"}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-400">
                                                Email domain
                                            </span>
                                            <span className="text-slate-200">
                                                {selectedCompany.email_domain || "Unavailable"}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-400">
                                                Domain match
                                            </span>
                                            <span className={selectedCompany.domain_match ? "text-green-400" : "text-red-400"}>
                                                {selectedCompany.domain_match ? "Matched" : "Not matched"}
                                            </span>
                                        </div>

                                    </div>
                                </div>

                                {/* DOCUMENTS */}
                                <div className="mb-7">

                                    <h4 className="mb-4 font-semibold">
                                        Verification Documents
                                    </h4>

                                    <div className="grid gap-4 sm:grid-cols-2">

                                        {[1, 2].map((number) => {
                                            const uploaded =
                                                number === 1
                                                    ? selectedCompany.document_1_uploaded
                                                    : selectedCompany.document_2_uploaded;

                                            return (
                                                <div
                                                    key={number}
                                                    className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                                                >
                                                    <div className="mb-4 flex items-center justify-between">
                                                        <span className="font-medium">
                                                            Document {number}
                                                        </span>

                                                        <span className={`text-xs ${uploaded ? "text-green-400" : "text-red-400"}`}>
                                                            {uploaded ? "Uploaded" : "Missing"}
                                                        </span>
                                                    </div>

                                                    <button
                                                        disabled={!uploaded}
                                                        onClick={() =>
                                                            handleViewDocument(
                                                                selectedCompany.id,
                                                                number
                                                            )
                                                        }
                                                        className="w-full rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-400 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        View Document
                                                    </button>
                                                </div>
                                            );
                                        })}

                                    </div>
                                </div>

                                {/* DOCUMENT STATUS */}
                                <div className="mb-7">
                                    <p className="text-xs text-slate-500">
                                        Documents Status
                                    </p>
                                    <p className="mt-1 text-sm capitalize text-slate-200">
                                        {selectedCompany.documents_status.replaceAll("_", " ")}
                                    </p>
                                </div>

                                {/* APPROVE / REJECT */}
                                <div className="flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row">

                                    <button
                                        disabled={actionLoading}
                                        onClick={() =>
                                            handleApprove(selectedCompany.id)
                                        }
                                        className="flex-1 rounded-lg bg-green-600 px-5 py-3 font-semibold transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {actionLoading ? "Processing..." : "✓ Approve Company"}
                                    </button>

                                    <button
                                        disabled={actionLoading}
                                        onClick={() =>
                                            handleReject(selectedCompany.id)
                                        }
                                        className="flex-1 rounded-lg border border-red-500/40 bg-red-500/10 px-5 py-3 font-semibold text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {actionLoading ? "Processing..." : "✕ Reject Company"}
                                    </button>

                                </div>

                            </div>
                        )}

                    </section>

                </div>
            </div>
        </main>
    );
}
