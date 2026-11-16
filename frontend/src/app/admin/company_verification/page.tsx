
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFileRequest, apiRequest } from "../../../services/api";

interface Company {
    id: number;
    request_id: number;
    request_type: string;
    version_number: number;
    status: string;
    submitted_at: string | null;

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

interface ApiMessage {
    message?: string;
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

    // Rejection modal state
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [rejectingCompany, setRejectingCompany] =
        useState<CompanyDetails | null>(null);

    // --------------------------------------------------
    // APPROVAL REQUIREMENTS
    // --------------------------------------------------

    const canApprove =
        selectedCompany !== null &&
        selectedCompany.business_email_verified === true &&
        selectedCompany.domain_match === true &&
        selectedCompany.document_1_uploaded === true &&
        selectedCompany.document_2_uploaded === true;

    const approvalRequirements = selectedCompany
        ? [
              {
                  label: "Business email OTP verification",
                  completed: selectedCompany.business_email_verified,
              },
              {
                  label: "Website and business email domain match",
                  completed: selectedCompany.domain_match,
              },
              {
                  label: "Company registration document",
                  completed: selectedCompany.document_1_uploaded,
              },
              {
                  label: "Business address proof",
                  completed: selectedCompany.document_2_uploaded,
              },
          ]
        : [];

    // --------------------------------------------------
    // LOAD PENDING VERIFICATION REQUESTS
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
                    : "Unable to load pending verification requests."
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
    // LOAD SELECTED VERIFICATION REQUEST DETAILS
    // --------------------------------------------------

    async function handleViewCompany(company: Company) {
        try {
            setDetailsLoading(true);
            setError("");
            setSuccess("");
            setSelectedCompany(null);

            const data: CompanyDetails = await apiRequest(
                `/admin/companies/${company.id}?request_id=${company.request_id}`
            );

            setSelectedCompany(data);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load verification request details."
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
        requestId: number,
        documentNumber: number
    ) {
        try {
            setError("");

            const blob = await apiFileRequest(
                `/admin/companies/${companyId}/documents/${documentNumber}?request_id=${requestId}`
            );

            const fileUrl = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = fileUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            document.body.appendChild(link);
            link.click();
            link.remove();

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
    // APPROVE VERIFICATION REQUEST
    // --------------------------------------------------

    async function handleApprove(company: CompanyDetails) {
        const requirementsMet =
            company.business_email_verified === true &&
            company.domain_match === true &&
            company.document_1_uploaded === true &&
            company.document_2_uploaded === true;

        if (!requirementsMet) {
            setError(
                "Cannot approve this request. Business email verification, domain matching, and both documents are required."
            );
            return;
        }

        const confirmed = window.confirm(
            `Approve verification request #${company.request_id} for ${company.name}?`
        );

        if (!confirmed) return;

        try {
            setActionLoading(true);
            setError("");
            setSuccess("");

            const response: ApiMessage = await apiRequest(
                `/admin/companies/${company.id}/approve?request_id=${company.request_id}`,
                {
                    method: "PUT",
                }
            );

            setSuccess(
                response.message ||
                    "Verification request approved successfully."
            );

            setSelectedCompany(null);
            await loadCompanies();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to approve verification request."
            );
        } finally {
            setActionLoading(false);
        }
    }

    // --------------------------------------------------
    // OPEN REJECTION MODAL
    // --------------------------------------------------

    function openRejectModal(company: CompanyDetails) {
        setError("");
        setSuccess("");
        setRejectionReason("");
        setRejectingCompany(company);
        setShowRejectModal(true);
    }

    // --------------------------------------------------
    // CLOSE REJECTION MODAL
    // --------------------------------------------------

    function closeRejectModal() {
        if (actionLoading) return;

        setShowRejectModal(false);
        setRejectingCompany(null);
        setRejectionReason("");
        setError("");
    }

    // --------------------------------------------------
    // REJECT VERIFICATION REQUEST
    // --------------------------------------------------

    async function handleReject() {
        if (!rejectingCompany) return;

        if (!rejectionReason.trim()) {
            setError("Please provide a rejection reason.");
            return;
        }

        try {
            setActionLoading(true);
            setError("");
            setSuccess("");

            const response: ApiMessage = await apiRequest(
                `/admin/companies/${rejectingCompany.id}/reject?request_id=${rejectingCompany.request_id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(rejectionReason.trim()),
                }
            );

            setSuccess(
                response.message ||
                    "Verification request rejected successfully."
            );

            setShowRejectModal(false);
            setRejectingCompany(null);
            setRejectionReason("");
            setSelectedCompany(null);

            await loadCompanies();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to reject verification request."
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
                            Review company information and submitted verification documents.
                        </p>
                    </div>

                    <button
                        onClick={loadCompanies}
                        disabled={actionLoading}
                        className="rounded-lg border border-slate-700 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-blue-500 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
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
                {error && !showRejectModal && (
                    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* PENDING COUNT */}
                <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                    <p className="text-sm text-slate-400">
                        Verification requests awaiting review
                    </p>

                    <p className="mt-2 text-3xl font-bold text-yellow-400">
                        {companies.length}
                    </p>
                </div>

                {/* REQUEST LIST AND DETAILS */}
                <div className="grid gap-8 lg:grid-cols-5">

                    {/* PENDING REQUEST LIST */}
                    <section className="lg:col-span-2">

                        <h2 className="mb-5 text-xl font-semibold">
                            Pending Requests
                        </h2>

                        {companies.length === 0 ? (
                            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
                                <div className="mb-3 text-4xl">✓</div>
                                <p className="font-semibold">
                                    No pending verifications
                                </p>
                                <p className="mt-2 text-sm text-slate-400">
                                    All submitted verification requests have been reviewed.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {companies.map((company) => (
                                    <button
                                        key={company.request_id}
                                        onClick={() => handleViewCompany(company)}
                                        className={`w-full rounded-2xl border p-5 text-left transition ${
                                            selectedCompany?.request_id === company.request_id
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

                                        <div className="mt-4 space-y-1 text-xs text-slate-500">
                                            <p>Company #{company.id}</p>
                                            <p>
                                                Request #{company.request_id} · Version {company.version_number}
                                            </p>
                                            <p className="capitalize">
                                                {company.request_type.replaceAll("_", " ")} verification
                                            </p>
                                        </div>

                                        <p className="mt-3 text-xs text-blue-400">
                                            View request details →
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}

                    </section>

                    {/* VERIFICATION DETAILS */}
                    <section className="lg:col-span-3">

                        <h2 className="mb-5 text-xl font-semibold">
                            Verification Review
                        </h2>

                        {detailsLoading ? (
                            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
                                <p className="text-slate-400">
                                    Loading verification request...
                                </p>
                            </div>
                        ) : !selectedCompany ? (
                            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
                                <div>
                                    <div className="mb-3 text-4xl">🏢</div>
                                    <p className="font-semibold">
                                        Select a verification request
                                    </p>
                                    <p className="mt-2 text-sm text-slate-400">
                                        Choose a request from the pending list to review its details and documents.
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

                                    <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm">
                                        <p className="text-slate-300">
                                            Request #{selectedCompany.request_id}
                                        </p>
                                        <p className="mt-1 capitalize text-blue-400">
                                            {selectedCompany.request_type.replaceAll("_", " ")} verification · Version {selectedCompany.version_number}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Submitted: {selectedCompany.submitted_at
                                                ? new Date(selectedCompany.submitted_at).toLocaleString()
                                                : "Unavailable"}
                                        </p>
                                    </div>

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
                                                    <div className="mb-4 flex items-center justify-between gap-3">
                                                        <span className="font-medium">
                                                            {number === 1
                                                                ? "Company Registration Proof"
                                                                : "Business Address Proof"}
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
                                                                selectedCompany.request_id,
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

                                {/* APPROVAL REQUIREMENTS */}
                                <div className="mb-7 rounded-xl border border-slate-800 bg-slate-950 p-5">

                                    <h4 className="mb-4 font-semibold">
                                        Approval Requirements
                                    </h4>

                                    <div className="space-y-3">
                                        {approvalRequirements.map((requirement) => (
                                            <div
                                                key={requirement.label}
                                                className="flex items-center gap-3 text-sm"
                                            >
                                                <span
                                                    className={
                                                        requirement.completed
                                                            ? "text-green-400"
                                                            : "text-red-400"
                                                    }
                                                >
                                                    {requirement.completed ? "✓" : "✕"}
                                                </span>

                                                <span
                                                    className={
                                                        requirement.completed
                                                            ? "text-slate-300"
                                                            : "text-red-300"
                                                    }
                                                >
                                                    {requirement.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {!canApprove && (
                                        <p className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-yellow-400">
                                            This request cannot be approved until all four requirements are satisfied.
                                            Review the missing requirements above.
                                        </p>
                                    )}

                                    {canApprove && (
                                        <p className="mt-4 rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-sm text-green-400">
                                            All mandatory verification requirements are satisfied. This request is eligible for approval.
                                        </p>
                                    )}

                                </div>

                                {/* DOCUMENT STATUS */}
                                <div className="mb-7">
                                    <p className="text-xs text-slate-500">
                                        Request Documents Status
                                    </p>
                                    <p className="mt-1 text-sm capitalize text-slate-200">
                                        {selectedCompany.documents_status.replaceAll("_", " ")}
                                    </p>
                                </div>

                                {/* APPROVE / REJECT */}
                                <div className="flex flex-col gap-3 border-t border-slate-800 pt-6 sm:flex-row">

                                    <button
                                        disabled={actionLoading || !canApprove}
                                        onClick={() => handleApprove(selectedCompany)}
                                        className="flex-1 rounded-lg bg-green-600 px-5 py-3 font-semibold transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {actionLoading
                                            ? "Processing..."
                                            : "✓ Approve Request"}
                                    </button>

                                    <button
                                        disabled={actionLoading}
                                        onClick={() => openRejectModal(selectedCompany)}
                                        className="flex-1 rounded-lg border border-red-500/40 bg-red-500/10 px-5 py-3 font-semibold text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        ✕ Reject Request
                                    </button>

                                </div>

                            </div>
                        )}

                    </section>

                </div>
            </div>

            {/* ------------------------------------------ */}
            {/* REJECTION REASON MODAL */}
            {/* ------------------------------------------ */}

            {showRejectModal && rejectingCompany && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            closeRejectModal();
                        }
                    }}
                >
                    <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">

                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    Reject Verification Request
                                </h2>

                                <p className="mt-2 text-sm text-slate-400">
                                    You are rejecting the verification request for{" "}
                                    <span className="font-semibold text-white">
                                        {rejectingCompany.name}
                                    </span>.
                                </p>
                            </div>

                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={closeRejectModal}
                                className="text-xl text-slate-400 transition hover:text-white disabled:opacity-40"
                                aria-label="Close rejection modal"
                            >
                                ×
                            </button>
                        </div>

                        <label className="mt-6 block text-sm font-medium text-slate-300">
                            Rejection Reason
                        </label>

                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Explain why this verification request is being rejected..."
                            rows={5}
                            maxLength={1000}
                            disabled={actionLoading}
                            className="mt-2 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 disabled:opacity-50"
                        />

                        <p className="mt-1 text-right text-xs text-slate-500">
                            {rejectionReason.length}/1000 characters
                        </p>

                        {error && showRejectModal && (
                            <p className="mt-3 text-sm text-red-400">
                                {error}
                            </p>
                        )}

                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">

                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={closeRejectModal}
                                className="flex-1 rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={
                                    actionLoading ||
                                    !rejectionReason.trim()
                                }
                                onClick={handleReject}
                                className="flex-1 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {actionLoading
                                    ? "Rejecting..."
                                    : "Confirm Rejection"}
                            </button>

                        </div>

                    </div>
                </div>
            )}

        </main>
    );
}
