"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    apiRequest,
    apiFileRequest,
    ApiError,
} from "../../../services/api";

interface Company {
    id: number;
    name: string;
    description: string | null;
    location: string | null;
    website: string | null;
    admin_profile_photo: string | null;
    business_email: string | null;
    business_phone: string | null;
    business_address: string | null;
    business_email_verified: boolean;
    documents_status: string;
    verification_status: string;
}

interface VerificationRequest {
    id: number;
    request_type: string;
    version_number: number;
    status: string;
    document_1_uploaded: boolean;
    document_2_uploaded: boolean;
    submitted_at: string | null;
    reviewed_at: string | null;
    rejection_reason: string | null;
    business_email: string | null;
    business_email_verified: boolean;
    business_email_verified_at: string | null;
}

interface VerificationInfo {
    company_id: number;
    verification_status: string;
    documents_status: string;
    business_email: string | null;
    business_email_verified: boolean;
    business_phone: string | null;
    business_address: string | null;
    latest_request: VerificationRequest | null;
}

interface ApiMessage {
    message?: string;
    business_email?: string;
    request_id?: number;
    request_type?: string;
    version_number?: number;
    request_status?: string;
}

export default function CompanyVerificationPage() {
    const router = useRouter();

    const [company, setCompany] = useState<Company | null>(null);
    const [verificationInfo, setVerificationInfo] =
        useState<VerificationInfo | null>(null);

    const [businessEmail, setBusinessEmail] = useState("");
    const [otp, setOtp] = useState("");

    const [otpSent, setOtpSent] = useState(false);

    const [document1Exists, setDocument1Exists] = useState(false);
    const [document2Exists, setDocument2Exists] = useState(false);

    const [loading, setLoading] = useState(true);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);

    const [uploadingDocument, setUploadingDocument] =
        useState<number | null>(null);

    const [requestingVerification, setRequestingVerification] =
        useState(false);

    const [submittingVerification, setSubmittingVerification] =
        useState(false);

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // --------------------------------------------------
    // LOAD COMPANY DATA
    // --------------------------------------------------

    async function loadCompanyData() {
        try {
            setLoading(true);
            setError("");

            const [companyData, verificationData] = await Promise.all([
                apiRequest(
                    "/companies/my-admin-company"
                ) as Promise<Company>,

                apiRequest(
                    "/companies/my-admin-company/verification"
                ) as Promise<VerificationInfo>,
            ]);

            setCompany(companyData);
            setVerificationInfo(verificationData);

            const latest = verificationData.latest_request;

            // Email verification belongs to the latest request, not the company.
            setBusinessEmail(
                latest?.business_email ||
                verificationData.business_email ||
                companyData.business_email ||
                ""
            );

            setOtpSent(false);
            setOtp("");

            setDocument1Exists(
                latest?.document_1_uploaded ?? false
            );

            setDocument2Exists(
                latest?.document_2_uploaded ?? false
            );
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                localStorage.removeItem("access_token");
                router.replace("/login");
                return;
            }

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load company verification details."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadCompanyData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --------------------------------------------------
    // REQUEST STATUS AND CONDITIONS
    // --------------------------------------------------

    const latestRequest =
        verificationInfo?.latest_request ?? null;

    const isCompanyVerified =
        company?.verification_status === "verified";

    const isRequestPending =
        latestRequest?.status === "pending" ||
        latestRequest?.status === "pending_review" ||
        latestRequest?.status === "submitted";

    const hasUpdatedDraft =
        latestRequest?.status === "draft" &&
        latestRequest?.request_type === "updated";

    const hasInitialDraft =
        latestRequest?.status === "draft" &&
        latestRequest?.request_type === "initial";

    const isRejectedRequest =
        latestRequest?.status === "rejected";

    const isInitialRejection =
        isRejectedRequest &&
        latestRequest?.request_type === "initial";

    const isUpdatedRejection =
        isRejectedRequest &&
        latestRequest?.request_type === "updated";

    const hasNoRequest = latestRequest === null;

    const isDraftRequest = latestRequest?.status === "draft";

    // Each verification request has its own business-email verification.
    const isBusinessEmailVerified =
        latestRequest?.business_email_verified === true;

    // Documents can only be uploaded into an active draft.
    // Approved documents are never directly replaced.
    const canUploadDocuments =
        latestRequest?.status === "draft" &&
        (
            !isCompanyVerified ||
            latestRequest.request_type === "updated"
        );

    // A company can:
    // 1. Start its first verification.
    // 2. Resubmit after any rejection.
    // 3. Request updated verification when already verified.
    const canRequestNewVerification =
        !isRequestPending &&
        (
            hasNoRequest ||
            isRejectedRequest ||
            (isCompanyVerified && !hasUpdatedDraft)
        );

    const canSubmitVerification =
        latestRequest?.status === "draft" &&
        document1Exists &&
        document2Exists &&
        isBusinessEmailVerified;

    // --------------------------------------------------
    // CREATE NEW VERIFICATION REQUEST
    // --------------------------------------------------

    async function handleRequestNewVerification() {
        let confirmationMessage =
            "Create a new verification request?";

        if (hasNoRequest) {
            confirmationMessage =
                "Start your company's initial verification request?";
        } else if (isRejectedRequest) {
            confirmationMessage =
                "Create a new resubmission request? Your previous rejected request and documents will be preserved.";
        } else if (isCompanyVerified) {
            confirmationMessage =
                "Create a new verification request? Your existing approved verification will remain active while the new request is reviewed.";
        }

        const confirmed = window.confirm(confirmationMessage);

        if (!confirmed) return;

        try {
            setRequestingVerification(true);
            setError("");
            setMessage("");

            const result: ApiMessage = await apiRequest(
                "/companies/my-admin-company/verification/request",
                {
                    method: "POST",
                }
            );

            setMessage(
                result.message ||
                "New verification request created successfully."
            );

            await loadCompanyData();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to create a new verification request."
            );
        } finally {
            setRequestingVerification(false);
        }
    }

    // --------------------------------------------------
    // SUBMIT VERIFICATION REQUEST
    // --------------------------------------------------

    async function handleSubmitVerification() {
        if (!canSubmitVerification) {
            setError(
                "Upload both documents and verify your business email before submitting."
            );
            return;
        }

        const confirmed = window.confirm(
            "Submit your company verification documents for Platform Admin review?"
        );

        if (!confirmed) return;

        try {
            setSubmittingVerification(true);
            setError("");
            setMessage("");

            const result: ApiMessage = await apiRequest(
                "/companies/my-admin-company/verification/submit",
                {
                    method: "POST",
                }
            );

            setMessage(
                result.message ||
                "Verification request submitted successfully."
            );

            await loadCompanyData();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to submit verification request."
            );
        } finally {
            setSubmittingVerification(false);
        }
    }

    // --------------------------------------------------
    // SEND BUSINESS EMAIL OTP
    // --------------------------------------------------

    async function handleSendOtp() {
        if (!isDraftRequest) {
            setError(
                "Create a verification request before verifying its business email."
            );
            return;
        }

        const email = businessEmail.trim().toLowerCase();

        if (!email) {
            setError("Please enter your official business email.");
            return;
        }

        try {
            setSendingOtp(true);
            setError("");
            setMessage("");

            const result: ApiMessage = await apiRequest(
                "/companies/my-admin-company/business-email/send-otp",
                {
                    method: "POST",
                    body: JSON.stringify({
                        business_email: email,
                    }),
                }
            );

            setBusinessEmail(result.business_email || email);
            setOtpSent(true);
            setOtp("");

            setMessage(
                result.message || "Verification OTP sent successfully."
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to send verification OTP."
            );
        } finally {
            setSendingOtp(false);
        }
    }

    // --------------------------------------------------
    // VERIFY BUSINESS EMAIL OTP
    // --------------------------------------------------

    async function handleVerifyOtp() {
        if (otp.length !== 6) {
            setError("Please enter the complete 6-digit OTP.");
            return;
        }

        try {
            setVerifyingOtp(true);
            setError("");
            setMessage("");

            const result: ApiMessage = await apiRequest(
                "/companies/my-admin-company/business-email/verify-otp",
                {
                    method: "POST",
                    body: JSON.stringify({ otp }),
                }
            );

            setOtpSent(false);
            setOtp("");

            setMessage(
                result.message || "Business email verified successfully."
            );

            await loadCompanyData();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to verify business email."
            );
        } finally {
            setVerifyingOtp(false);
        }
    }

    // --------------------------------------------------
    // UPLOAD DOCUMENT
    // --------------------------------------------------

    async function handleDocumentUpload(
        documentNumber: number,
        file: File | undefined
    ) {
        if (!file) return;

        if (!canUploadDocuments) {
            setError(
                "Create a new verification request before uploading documents."
            );
            return;
        }

        const allowedExtensions = [
            "pdf",
            "docx",
            "jpg",
            "jpeg",
            "png",
        ];

        const extension = file.name
            .split(".")
            .pop()
            ?.toLowerCase();

        if (!extension || !allowedExtensions.includes(extension)) {
            setError(
                "Allowed formats: PDF, DOCX, JPG, JPEG and PNG."
            );
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError("Each document must be smaller than 5 MB.");
            return;
        }

        try {
            setUploadingDocument(documentNumber);
            setError("");
            setMessage("");

            const formData = new FormData();
            formData.append("file", file);

            const result: ApiMessage = await apiRequest(
                `/companies/my-admin-company/documents/${documentNumber}`,
                {
                    method: "POST",
                    body: formData,
                }
            );

            setMessage(
                result.message || "Document uploaded successfully."
            );

            await loadCompanyData();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to upload document."
            );
        } finally {
            setUploadingDocument(null);
        }
    }

    // --------------------------------------------------
    // VIEW DOCUMENT
    // --------------------------------------------------

    async function handleViewDocument(documentNumber: number) {
        try {
            setError("");

            const blob = await apiFileRequest(
                `/companies/my-admin-company/documents/${documentNumber}`
            );

            const objectUrl = URL.createObjectURL(blob);

            window.open(
                objectUrl,
                "_blank",
                "noopener,noreferrer"
            );

            window.setTimeout(() => {
                URL.revokeObjectURL(objectUrl);
            }, 60000);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to open document."
            );
        }
    }

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

    function formatStatus(status: string) {
        return status.replaceAll("_", " ");
    }

    // --------------------------------------------------
    // DOCUMENT CARD
    // --------------------------------------------------

    function renderDocumentCard(
        documentNumber: number,
        documentExists: boolean
    ) {
        const documentTitle =
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
                        <h4 className="font-semibold">
                            {documentTitle}
                        </h4>

                        <p className="mt-1 text-sm text-slate-400">
                            {documentExists
                                ? "Document uploaded for this request"
                                : "No document uploaded for this request"}
                        </p>
                    </div>

                    <span
                        className={`rounded-full border px-3 py-1 text-xs ${
                            documentExists
                                ? getStatusStyle("verified")
                                : getStatusStyle("unverified")
                        }`}
                    >
                        {documentExists ? "Uploaded" : "Missing"}
                    </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                    {canUploadDocuments && (
                        <label
                            className={`cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 ${
                                uploadingDocument !== null
                                    ? "pointer-events-none opacity-50"
                                    : ""
                            }`}
                        >
                            {uploadingDocument === documentNumber
                                ? "Uploading..."
                                : documentExists
                                    ? "Replace Draft Document"
                                    : "Upload Document"}

                            <input
                                type="file"
                                accept=".pdf,.docx,.jpg,.jpeg,.png"
                                className="hidden"
                                disabled={uploadingDocument !== null}
                                onChange={(e) => {
                                    handleDocumentUpload(
                                        documentNumber,
                                        e.target.files?.[0]
                                    );

                                    e.currentTarget.value = "";
                                }}
                            />
                        </label>
                    )}

                    {documentExists && (
                        <button
                            type="button"
                            onClick={() =>
                                handleViewDocument(documentNumber)
                            }
                            className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:border-blue-500"
                        >
                            View Document
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // --------------------------------------------------
    // LOADING
    // --------------------------------------------------

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                Loading company verification...
            </main>
        );
    }

    if (!company) {
        return (
            <main className="min-h-screen bg-slate-950 text-white p-8">
                <p className="text-red-400">
                    {error || "Company information unavailable."}
                </p>

                <button
                    onClick={() => router.back()}
                    className="mt-5 text-blue-400"
                >
                    Go Back
                </button>
            </main>
        );
    }

    // --------------------------------------------------
    // MAIN PAGE
    // --------------------------------------------------

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <nav className="border-b border-slate-800">
                <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        <span className="text-blue-500">Hire</span>
                        Swipe
                    </h1>

                    <button
                        onClick={() => router.push("/recruiter/dashboard")}
                        className="text-sm text-slate-400 hover:text-white"
                    >
                        ← Dashboard
                    </button>
                </div>
            </nav>

            <div className="mx-auto max-w-5xl px-6 py-10">
                <section className="mb-8">
                    <p className="text-sm uppercase tracking-wider text-blue-400">
                        Company Admin
                    </p>

                    <h2 className="mt-2 text-3xl font-bold">
                        Company Verification
                    </h2>

                    <p className="mt-2 text-slate-400">
                        Verify your company's official email and submit
                        the required documents.
                    </p>

                    <p className="mt-4 text-lg font-semibold">
                        {company.name}
                    </p>
                </section>

                {message && (
                    <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* VERIFICATION OVERVIEW */}

                <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                    <h3 className="mb-5 text-lg font-semibold">
                        Verification Overview
                    </h3>

                    <div className="grid gap-5 sm:grid-cols-3">
                        <div>
                            <p className="mb-2 text-sm text-slate-400">
                                Business Email
                            </p>

                            <span
                                className={`inline-block rounded-full border px-3 py-1 text-xs ${getStatusStyle(
                                    isBusinessEmailVerified
                                        ? "verified"
                                        : "unverified"
                                )}`}
                            >
                                {isBusinessEmailVerified
                                    ? "Verified for this request"
                                    : "Unverified for this request"}
                            </span>
                        </div>

                        <div>
                            <p className="mb-2 text-sm text-slate-400">
                                Documents
                            </p>

                            <span
                                className={`inline-block rounded-full border px-3 py-1 text-xs capitalize ${getStatusStyle(
                                    company.documents_status
                                )}`}
                            >
                                {formatStatus(company.documents_status)}
                            </span>
                        </div>

                        <div>
                            <p className="mb-2 text-sm text-slate-400">
                                Overall Verification
                            </p>

                            <span
                                className={`inline-block rounded-full border px-3 py-1 text-xs capitalize ${getStatusStyle(
                                    company.verification_status
                                )}`}
                            >
                                {formatStatus(company.verification_status)}
                            </span>
                        </div>
                    </div>

                    {latestRequest && (
                        <div className="mt-6 border-t border-slate-800 pt-5">
                            <h4 className="font-semibold">
                                Latest Verification Request
                            </h4>

                            <div className="mt-4 grid gap-4 sm:grid-cols-3">
                                <div>
                                    <p className="text-xs text-slate-500">
                                        Request Type
                                    </p>
                                    <p className="mt-1 capitalize">
                                        {latestRequest.request_type}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-500">
                                        Version
                                    </p>
                                    <p className="mt-1">
                                        {latestRequest.version_number}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-500">
                                        Request Status
                                    </p>

                                    <span
                                        className={`mt-1 inline-block rounded-full border px-3 py-1 text-xs capitalize ${getStatusStyle(
                                            latestRequest.status
                                        )}`}
                                    >
                                        {formatStatus(latestRequest.status)}
                                    </span>
                                </div>
                            </div>

                            {latestRequest.rejection_reason && (
                                <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                                    <p className="font-semibold text-red-400">
                                        Rejection Reason
                                    </p>

                                    <p className="mt-1 text-sm text-slate-300">
                                        {latestRequest.rejection_reason}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {/* CREATE INITIAL / NEW VERIFICATION REQUEST */}

                {canRequestNewVerification && (
                    <section className="mb-8 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-6">
                        <h3 className="text-lg font-semibold">
                            {hasNoRequest
                                ? "Start Company Verification"
                                : isRejectedRequest
                                    ? "Resubmit Company Verification"
                                    : "Update Company Verification"}
                        </h3>

                        <p className="mt-2 text-sm text-slate-400">
                            {hasNoRequest
                                ? "Create your initial verification request before uploading the required company documents."
                                : isInitialRejection
                                    ? "Your initial verification request was rejected. Create a new request to upload corrected documents. Your previous request will be preserved."
                                    : isUpdatedRejection
                                        ? "Your updated verification request was rejected. Create another request to upload corrected documents. Your previous approved documents and request history will be preserved."
                                        : "Create a new verification request to update your company's legal documents. Your existing approved verification will remain active while the new request is reviewed."}
                        </p>

                        <button
                            type="button"
                            onClick={handleRequestNewVerification}
                            disabled={requestingVerification}
                            className="mt-5 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                        >
                            {requestingVerification
                                ? "Creating Request..."
                                : hasNoRequest
                                    ? "Start Verification"
                                    : isRejectedRequest
                                        ? "Request Resubmission"
                                        : "Request New Verification"}
                        </button>
                    </section>
                )}

                {/* REJECTION NOTICE */}

                {isRejectedRequest && (
                    <section className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-5">
                        <h3 className="font-semibold text-red-400">
                            Previous Verification Rejected
                        </h3>

                        <p className="mt-2 text-sm text-slate-300">
                            {isInitialRejection
                                ? "Create a new initial verification request before uploading corrected documents."
                                : "Your re-verification request was rejected. Create another request before uploading corrected documents."}
                        </p>

                        {latestRequest?.rejection_reason && (
                            <p className="mt-3 text-sm text-slate-300">
                                <strong className="text-red-400">
                                    Reason:
                                </strong>{" "}
                                {latestRequest.rejection_reason}
                            </p>
                        )}
                    </section>
                )}

                {/* INACTIVE COMPANY NOTICE */}

                {company.verification_status === "inactive" && (
                    <section className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-5">
                        <h3 className="font-semibold text-red-400">
                            Company Verification Inactive
                        </h3>

                        <p className="mt-2 text-sm text-slate-300">
                            Your latest re-verification request was rejected.
                            Your company will remain inactive until a new
                            verification request is approved by the Platform Admin.
                        </p>
                    </section>
                )}

                {/* PENDING NOTICE */}

                {isRequestPending && (
                    <section className="mb-8 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5">
                        <h3 className="font-semibold text-yellow-400">
                            Verification Under Review
                        </h3>

                        <p className="mt-2 text-sm text-slate-300">
                            Your documents have been submitted and are
                            awaiting Platform Admin review.
                        </p>

                        {isCompanyVerified && (
                            <p className="mt-2 text-sm text-green-400">
                                Your existing company verification remains active.
                            </p>
                        )}
                    </section>
                )}

                {/* DRAFT NOTICE */}

                {latestRequest?.status === "draft" && (
                    <section className="mb-8 rounded-xl border border-blue-500/30 bg-blue-500/10 p-5">
                        <h3 className="font-semibold text-blue-400">
                            Verification Request Ready for Documents
                        </h3>

                        <p className="mt-2 text-sm text-slate-300">
                            Upload the required documents for this request.
                            You can submit it after both documents and your
                            business email have been verified.
                        </p>

                        {isCompanyVerified && hasUpdatedDraft && (
                            <p className="mt-2 text-sm text-green-400">
                                Your existing approved company verification
                                remains active while this request is being prepared.
                            </p>
                        )}
                    </section>
                )}

                {/* BUSINESS EMAIL VERIFICATION */}

                <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-xl font-semibold">
                                Business Email Verification
                            </h3>

                            <p className="mt-1 text-sm text-slate-400">
                                Verify an email address matching your company website domain.
                            </p>
                        </div>

                        {isBusinessEmailVerified && (
                            <span className="text-sm font-semibold text-green-400">
                                ✓ Verified for this request
                            </span>
                        )}
                    </div>

                    <label className="mb-2 block text-sm text-slate-300">
                        Official Business Email
                    </label>

                    <input
                        type="email"
                        value={businessEmail}
                        onChange={(e) => {
                            setBusinessEmail(e.target.value);
                            setOtpSent(false);
                            setOtp("");
                            setError("");
                            setMessage("");
                        }}
                        disabled={!isDraftRequest || isBusinessEmailVerified}
                        placeholder="hr@yourcompany.com"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 disabled:opacity-60"
                    />

                    {isDraftRequest && !isBusinessEmailVerified && (
                        <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={sendingOtp || !businessEmail.trim()}
                            className="mt-4 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                        >
                            {sendingOtp
                                ? "Sending OTP..."
                                : otpSent
                                    ? "Resend OTP"
                                    : "Send Verification OTP"}
                        </button>
                    )}

                    {otpSent && isDraftRequest && !isBusinessEmailVerified && (
                        <div className="mt-6 border-t border-slate-800 pt-5">
                            <label className="mb-2 block text-sm text-slate-300">
                                Enter the OTP sent to your business email
                            </label>

                            <input
                                type="text"
                                inputMode="numeric"
                                value={otp}
                                onChange={(e) =>
                                    setOtp(
                                        e.target.value
                                            .replace(/\D/g, "")
                                            .slice(0, 6)
                                    )
                                }
                                maxLength={6}
                                placeholder="Enter OTP"
                                className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 tracking-widest text-white outline-none focus:border-blue-500"
                            />

                            <button
                                type="button"
                                onClick={handleVerifyOtp}
                                disabled={verifyingOtp || otp.length !== 6}
                                className="mt-4 block rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold hover:bg-green-500 disabled:opacity-50"
                            >
                                {verifyingOtp
                                    ? "Verifying..."
                                    : "Verify Email"}
                            </button>
                        </div>
                    )}
                </section>

                {/* DOCUMENT VERIFICATION */}

                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                    <h3 className="text-xl font-semibold">
                        Company Document Verification
                    </h3>

                    <p className="mb-6 mt-2 text-sm text-slate-400">
                        Upload the two required company verification
                        documents. Accepted formats: PDF, DOCX, JPG,
                        JPEG and PNG. Maximum size: 5 MB per document.
                    </p>

                    {!canUploadDocuments && !isRequestPending && (
                        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-950 p-4 text-sm text-slate-400">
                            {hasNoRequest
                                ? "Start your verification request before uploading documents."
                                : isRejectedRequest
                                    ? "Create a new resubmission request before uploading corrected documents."
                                    : isCompanyVerified
                                        ? "Click Request New Verification before uploading updated documents."
                                        : "Create a verification request before uploading documents."}
                        </div>
                    )}

                    <div className="grid gap-6">
                        {renderDocumentCard(1, document1Exists)}
                        {renderDocumentCard(2, document2Exists)}
                    </div>

                    {/* SUBMIT BUTTON */}

                    {canSubmitVerification && (
                        <div className="mt-8 border-t border-slate-800 pt-6">
                            <h4 className="font-semibold">
                                Ready to Submit?
                            </h4>

                            <p className="mt-2 text-sm text-slate-400">
                                Both documents have been uploaded and
                                your business email is verified.
                                Submit your request for Platform Admin review.
                            </p>

                            <button
                                type="button"
                                onClick={handleSubmitVerification}
                                disabled={submittingVerification}
                                className="mt-5 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold hover:bg-green-500 disabled:opacity-50"
                            >
                                {submittingVerification
                                    ? "Submitting..."
                                    : "Submit Verification Request"}
                            </button>
                        </div>
                    )}

                    {/* REQUIREMENTS CHECKLIST */}

                    {latestRequest?.status === "draft" &&
                        !canSubmitVerification && (
                            <div className="mt-8 border-t border-slate-800 pt-6">
                                <h4 className="font-semibold">
                                    Complete the Requirements
                                </h4>

                                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                                    <li>
                                        {document1Exists ? "✓" : "○"} Company registration proof uploaded
                                    </li>

                                    <li>
                                        {document2Exists ? "✓" : "○"} Business address proof uploaded
                                    </li>

                                    <li>
                                        {isBusinessEmailVerified ? "✓" : "○"} Business email verified for this request
                                    </li>
                                </ul>
                            </div>
                        )}
                </section>

                <footer className="mt-10 border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
                    HireSwipe • Company Verification
                </footer>
            </div>
        </main>
    );
}