
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiRequest, apiFileRequest, ApiError } from "../../../../services/api";

interface VerificationHistory {
    id: number;
    request_type: string;
    version_number: number;
    status: string;
    business_email: string | null;
    business_email_verified: boolean;
    submitted_at: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
}

interface CompanyDetails {
    id: number;
    name: string;
    description: string | null;
    location: string | null;
    website: string | null;

    business_email: string | null;
    business_email_verified: boolean;
    business_email_verified_at: string | null;
    website_domain: string | null;
    email_domain: string | null;
    domain_match: boolean;

    business_phone: string | null;
    business_address: string | null;

    document_1_uploaded: boolean;
    document_2_uploaded: boolean;

    documents_status: string;
    verification_status: string;

    request_id: number | null;
    request_type: string | null;
    request_status: string | null;
    version_number: number | null;

    submitted_at: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;

    verification_history: VerificationHistory[];
}

export default function AdminCompanyDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

    const companyId = params.company_id as string;
    const requestId = searchParams.get("request_id");

    const [company, setCompany] = useState<CompanyDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [viewingDocument, setViewingDocument] = useState<number | null>(null);

    // --------------------------------------------------
    // STATUS STYLING
    // --------------------------------------------------

    function getStatusStyle(status: string) {
        switch (status) {
            case "verified":
            case "approved":
                return "bg-green-500/10 text-green-400 border-green-500/30";

            case "pending":
            case "pending_review":
            case "submitted":
                return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";

            case "rejected":
            case "inactive":
                return "bg-red-500/10 text-red-400 border-red-500/30";

            case "draft":
            case "in_progress":
                return "bg-blue-500/10 text-blue-400 border-blue-500/30";

            default:
                return "bg-slate-700/50 text-slate-400 border-slate-600";
        }
    }

    function formatStatus(status: string | null | undefined) {
        if (!status) return "Not available";
        return status.replaceAll("_", " ");
    }

    function formatDate(date: string | null) {
        if (!date) return "Not available";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "Not available";
        }

        return parsedDate.toLocaleString();
    }

    // --------------------------------------------------
    // LOAD COMPANY DETAILS
    // --------------------------------------------------

    useEffect(() => {
        async function loadCompanyDetails() {
            try {
                setLoading(true);
                setError("");

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

                const query = requestId
                    ? `?request_id=${encodeURIComponent(requestId)}`
                    : "";

                const data = await apiRequest<CompanyDetails>(
                    `/admin/companies/${companyId}${query}`
                );

                setCompany(data);
            } catch (err) {
                console.error("Company details loading error:", err);

                if (err instanceof ApiError && err.status === 401) {
                    localStorage.removeItem("access_token");
                    router.replace("/login");
                    return;
                }

                if (err instanceof ApiError && err.status === 403) {
                    router.replace("/dashboard");
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load company details."
                );
            } finally {
                setLoading(false);
            }
        }

        if (companyId) {
            loadCompanyDetails();
        }
    }, [companyId, requestId, router]);

    // --------------------------------------------------
    // VIEW VERIFICATION DOCUMENT
    // --------------------------------------------------

    async function handleViewDocument(documentNumber: number) {
        try {
            setViewingDocument(documentNumber);
            setError("");

            const query = requestId
                ? `?request_id=${encodeURIComponent(requestId)}`
                : "";

            const blob = await apiFileRequest(
                `/admin/companies/${companyId}/documents/${documentNumber}${query}`
            );

            const objectUrl = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = objectUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => {
                URL.revokeObjectURL(objectUrl);
            }, 60000);
        } catch (err) {
            console.error("Document viewing error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to open company document."
            );
        } finally {
            setViewingDocument(null);
        }
    }

    // --------------------------------------------------
    // DOCUMENT CARD
    // --------------------------------------------------

    function renderDocumentCard(
        documentNumber: number,
        uploaded: boolean
    ) {
        const title =
            documentNumber === 1
                ? "Company Registration Proof"
                : "Business Address Proof";

        return (
            <div
                key={documentNumber}
                className="rounded-xl border border-slate-700 bg-slate-950 p-5"
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="font-semibold text-white">
                            {title}
                        </h3>

                        <p className="mt-1 text-sm text-slate-400">
                            Document {documentNumber}
                        </p>
                    </div>

                    <span
                        className={`rounded-full border px-3 py-1 text-xs capitalize ${
                            uploaded
                                ? getStatusStyle("approved")
                                : getStatusStyle("unverified")
                        }`}
                    >
                        {uploaded ? "Uploaded" : "Missing"}
                    </span>
                </div>

                {uploaded && (
                    <button
                        type="button"
                        onClick={() => handleViewDocument(documentNumber)}
                        disabled={viewingDocument !== null}
                        className="mt-5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {viewingDocument === documentNumber
                            ? "Opening..."
                            : "View Document →"}
                    </button>
                )}
            </div>
        );
    }

    // --------------------------------------------------
    // LOADING
    // --------------------------------------------------

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
                    <p className="text-slate-400">
                        Loading company details...
                    </p>
                </div>
            </main>
        );
    }

    // --------------------------------------------------
    // ERROR / NOT FOUND
    // --------------------------------------------------

    if (error && !company) {
        return (
            <main className="min-h-screen bg-slate-950 p-8 text-white">
                <div className="mx-auto max-w-4xl rounded-xl border border-red-500/30 bg-red-500/10 p-6">
                    <h2 className="font-semibold text-red-400">
                        Unable to load company
                    </h2>

                    <p className="mt-2 text-sm text-slate-300">
                        {error}
                    </p>

                    <button
                        onClick={() => router.push("/admin/companies")}
                        className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm hover:bg-blue-500"
                    >
                        Back to Companies
                    </button>
                </div>
            </main>
        );
    }

    if (!company) return null;

    // --------------------------------------------------
    // MAIN PAGE
    // --------------------------------------------------

    return (
        <main className="min-h-screen bg-slate-950 text-white">

            {/* NAVIGATION */}
            <nav className="border-b border-slate-800 bg-slate-950">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">

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
                        onClick={() => router.push("/admin/companies")}
                        className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-blue-500 hover:text-blue-400"
                    >
                        ← Companies
                    </button>

                </div>
            </nav>

            <div className="mx-auto max-w-6xl px-6 py-10">

                {/* PAGE HEADER */}
                <section className="mb-8">
                    <p className="text-sm font-medium uppercase tracking-wider text-blue-400">
                        Platform Management
                    </p>

                    <h1 className="mt-2 text-3xl font-bold">
                        {company.name}
                    </h1>

                    <p className="mt-2 text-sm text-slate-400">
                        Company #{company.id} · Company verification details
                    </p>
                </section>

                {/* ERROR MESSAGE */}
                {error && (
                    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* VERIFICATION STATUS */}
                <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <div className="flex flex-wrap items-center justify-between gap-4">

                        <div>
                            <p className="text-sm text-slate-400">
                                Company Verification Status
                            </p>

                            <span className={`mt-3 inline-block rounded-full border px-4 py-2 text-sm font-medium capitalize ${getStatusStyle(company.verification_status)}`}>
                                {formatStatus(company.verification_status)}
                            </span>
                        </div>

                        <div>
                            <p className="text-sm text-slate-400">
                                Documents Status
                            </p>

                            <span className={`mt-3 inline-block rounded-full border px-4 py-2 text-sm font-medium capitalize ${getStatusStyle(company.documents_status)}`}>
                                {formatStatus(company.documents_status)}
                            </span>
                        </div>

                    </div>

                </section>

                {/* COMPANY INFORMATION */}
                <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <h2 className="mb-6 text-xl font-semibold">
                        Company Information
                    </h2>

                    <div className="grid gap-6 md:grid-cols-2">

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Company Name
                            </p>
                            <p className="mt-2 text-sm text-white">
                                {company.name}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Website
                            </p>
                            <p className="mt-2 break-all text-sm text-blue-400">
                                {company.website || "Not provided"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Company Location
                            </p>
                            <p className="mt-2 text-sm text-white">
                                {company.location || "Not provided"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Business Phone
                            </p>
                            <p className="mt-2 text-sm text-white">
                                {company.business_phone || "Not provided"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Business Address
                            </p>
                            <p className="mt-2 text-sm text-white">
                                {company.business_address || "Not provided"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Description
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-white">
                                {company.description || "Not provided"}
                            </p>
                        </div>

                    </div>

                </section>

                {/* BUSINESS EMAIL VERIFICATION */}
                <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <h2 className="mb-6 text-xl font-semibold">
                        Business Email Verification
                    </h2>

                    <div className="grid gap-6 md:grid-cols-2">

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Business Email
                            </p>
                            <p className="mt-2 break-all text-sm text-white">
                                {company.business_email || "Not provided"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Email OTP Verification
                            </p>

                            <p className={`mt-2 text-sm font-medium ${
                                company.business_email_verified
                                    ? "text-green-400"
                                    : "text-red-400"
                            }`}>
                                {company.business_email_verified
                                    ? "✓ Verified"
                                    : "✕ Not verified"}
                            </p>

                            {company.business_email_verified_at && (
                                <p className="mt-1 text-xs text-slate-500">
                                    Verified at: {formatDate(company.business_email_verified_at)}
                                </p>
                            )}
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Email Domain
                            </p>
                            <p className="mt-2 text-sm text-white">
                                {company.email_domain || "Not available"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Website Domain
                            </p>
                            <p className="mt-2 text-sm text-white">
                                {company.website_domain || "Not available"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Domain Matching
                            </p>
                            <p className={`mt-2 text-sm font-medium ${
                                company.domain_match
                                    ? "text-green-400"
                                    : "text-red-400"
                            }`}>
                                {company.domain_match
                                    ? "✓ Domain matched"
                                    : "✕ Domain not matched"}
                            </p>
                        </div>

                    </div>

                </section>

                {/* VERIFICATION DOCUMENTS */}
                <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <div className="mb-6">
                        <h2 className="text-xl font-semibold">
                            Submitted Verification Documents
                        </h2>

                        <p className="mt-2 text-sm text-slate-400">
                            Review the documents submitted by this company.
                        </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">

                        {renderDocumentCard(
                            1,
                            company.document_1_uploaded
                        )}

                        {renderDocumentCard(
                            2,
                            company.document_2_uploaded
                        )}

                    </div>

                </section>

                {/* CURRENT VERIFICATION REQUEST */}
                <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <h2 className="mb-6 text-xl font-semibold">
                        Selected Verification Request
                    </h2>

                    <div className="grid gap-6 md:grid-cols-2">

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Request ID
                            </p>
                            <p className="mt-2 text-sm text-white">
                                {company.request_id ?? "Not available"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Request Type
                            </p>
                            <p className="mt-2 text-sm capitalize text-white">
                                {formatStatus(company.request_type)}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Version
                            </p>
                            <p className="mt-2 text-sm text-white">
                                {company.version_number ?? "Not available"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Request Status
                            </p>
                            <span className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs capitalize ${getStatusStyle(company.request_status || "")}`}>
                                {formatStatus(company.request_status)}
                            </span>
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Submitted At
                            </p>
                            <p className="mt-2 text-sm text-white">
                                {formatDate(company.submitted_at)}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase text-slate-500">
                                Reviewed At
                            </p>
                            <p className="mt-2 text-sm text-white">
                                {formatDate(company.reviewed_at)}
                            </p>
                        </div>

                    </div>

                    {company.rejection_reason && (
                        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                            <p className="text-sm font-semibold text-red-400">
                                Rejection Reason
                            </p>
                            <p className="mt-2 text-sm text-slate-300">
                                {company.rejection_reason}
                            </p>
                        </div>
                    )}

                </section>

                {/* VERIFICATION HISTORY */}
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <h2 className="mb-2 text-xl font-semibold">
                        Verification History
                    </h2>

                    <p className="mb-6 text-sm text-slate-400">
                        Previous verification and re-verification requests.
                    </p>

                    {company.verification_history.length === 0 ? (
                        <p className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-400">
                            No verification history available.
                        </p>
                    ) : (
                        <div className="space-y-4">

                            {company.verification_history.map((history) => (
                                <div
                                    key={history.id}
                                    className={`rounded-xl border p-5 ${
                                        history.id === company.request_id
                                            ? "border-blue-500/40 bg-blue-500/5"
                                            : "border-slate-700 bg-slate-950"
                                    }`}
                                >

                                    <div className="flex flex-wrap items-center justify-between gap-3">

                                        <div>
                                            <h3 className="font-semibold text-white">
                                                {formatStatus(history.request_type)} Verification
                                            </h3>

                                            <p className="mt-1 text-xs text-slate-400">
                                                Request #{history.id} · Version {history.version_number}
                                            </p>
                                        </div>

                                        <span className={`rounded-full border px-3 py-1 text-xs capitalize ${getStatusStyle(history.status)}`}>
                                            {formatStatus(history.status)}
                                        </span>

                                    </div>

                                    <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">

                                        <div>
                                            <p className="text-xs text-slate-500">
                                                Business Email
                                            </p>
                                            <p className="mt-1 break-all text-slate-300">
                                                {history.business_email || "Not provided"}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-slate-500">
                                                Email Verification
                                            </p>
                                            <p className={`mt-1 ${
                                                history.business_email_verified
                                                    ? "text-green-400"
                                                    : "text-red-400"
                                            }`}>
                                                {history.business_email_verified
                                                    ? "Verified"
                                                    : "Not verified"}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-slate-500">
                                                Submitted At
                                            </p>
                                            <p className="mt-1 text-slate-300">
                                                {formatDate(history.submitted_at)}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-slate-500">
                                                Reviewed At
                                            </p>
                                            <p className="mt-1 text-slate-300">
                                                {formatDate(history.reviewed_at)}
                                            </p>
                                        </div>

                                    </div>

                                    {history.rejection_reason && (
                                        <div className="mt-4 text-sm text-red-400">
                                            Rejection reason: {history.rejection_reason}
                                        </div>
                                    )}

                                    {history.id !== company.request_id && (
                                        <button
                                            type="button"
                                            onClick={() => router.push(
                                                `/admin/companies/${company.id}?request_id=${history.id}`
                                            )}
                                            className="mt-5 rounded-lg border border-slate-600 px-4 py-2 text-xs text-slate-300 transition hover:border-blue-500 hover:text-blue-400"
                                        >
                                            View This Request →
                                        </button>
                                    )}

                                </div>
                            ))}

                        </div>
                    )}

                </section>

                {/* BACK BUTTON */}
                <div className="mt-8">
                    <button
                        onClick={() => router.push("/admin/companies")}
                        className="rounded-lg border border-slate-700 px-5 py-3 text-sm text-slate-300 transition hover:border-blue-500 hover:text-blue-400"
                    >
                        ← Back to Companies
                    </button>
                </div>

            </div>
        </main>
    );
}
