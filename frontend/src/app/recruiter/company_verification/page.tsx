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

interface ApiMessage {
    message: string;
    business_email?: string;
    business_email_verified?: boolean;
    documents_status?: string;
    verification_status?: string;
}

export default function CompanyVerificationPage() {
    const router = useRouter();

    const [company, setCompany] = useState<Company | null>(null);
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
    const [deletingDocument, setDeletingDocument] =
        useState<number | null>(null);

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // --------------------------------------------------
    // LOAD COMPANY AND DOCUMENT STATUS
    // --------------------------------------------------

    async function loadCompanyData() {
        try {
            setLoading(true);
            setError("");

            const companyData: Company = await apiRequest(
                "/companies/my-admin-company"
            );

            setCompany(companyData);
            setBusinessEmail(companyData.business_email || "");

            // Check whether each document already exists.
            const [document1, document2] = await Promise.all([
                checkDocumentExists(1),
                checkDocumentExists(2),
            ]);

            setDocument1Exists(document1);
            setDocument2Exists(document2);
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

    // --------------------------------------------------
    // CHECK WHETHER A DOCUMENT EXISTS
    // --------------------------------------------------

    async function checkDocumentExists(
        documentNumber: number
    ): Promise<boolean> {
        try {
            await apiFileRequest(
                `/companies/my-admin-company/documents/${documentNumber}`
            );

            return true;
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                return false;
            }

            throw err;
        }
    }

    useEffect(() => {
        loadCompanyData();
        // Load once when the page opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --------------------------------------------------
    // SEND COMPANY EMAIL OTP
    // --------------------------------------------------

   async function handleSendOtp() {
    const email = businessEmail.trim().toLowerCase();

    if (!email) {
        setError("Please enter your official business email.");
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("Please enter a valid business email address.");
        return;
    }

    try {
        setSendingOtp(true);
        setError("");
        setMessage("");

        console.log("Sending business email OTP:", email);

        const result: ApiMessage = await apiRequest(
            "/companies/my-admin-company/business-email/send-otp",
            {
                method: "POST",
                body: JSON.stringify({
                    business_email: email,
                }),
            }
        );

        console.log("OTP API response:", result);

        setBusinessEmail(result.business_email || email);
        setOtpSent(true);
        setOtp("");

        setMessage(
            result.message || "Verification OTP sent successfully."
        );

    } catch (err) {
        console.error("Business email OTP error:", err);

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
    // VERIFY COMPANY EMAIL OTP
    // --------------------------------------------------

    async function handleVerifyOtp() {
        try {
            setVerifyingOtp(true);
            setError("");
            setMessage("");

            const result: ApiMessage = await apiRequest(
                "/companies/my-admin-company/business-email/verify-otp",
                {
                    method: "POST",
                    body: JSON.stringify({
                        otp: otp,
                    }),
                }
            );

            setOtpSent(false);
            setOtp("");

            setMessage(
                result.message || "Company email verified successfully."
            );

            await loadCompanyData();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to verify company email."
            );
        } finally {
            setVerifyingOtp(false);
        }
    }

    // --------------------------------------------------
    // UPLOAD OR REPLACE DOCUMENT
    // --------------------------------------------------

    async function handleDocumentUpload(
        documentNumber: number,
        file: File | undefined
    ) {
        if (!file) return;

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
    // VIEW / DOWNLOAD DOCUMENT
    // --------------------------------------------------

    async function handleViewDocument(
        documentNumber: number
    ) {
        try {
            setError("");

            const blob = await apiFileRequest(
                `/companies/my-admin-company/documents/${documentNumber}`
            );

            const objectUrl = URL.createObjectURL(blob);

            // Open the authenticated file in a new browser tab.
            const link = document.createElement("a");

            link.href = objectUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            document.body.appendChild(link);
            link.click();
            link.remove();

            // Keep the URL alive briefly so the browser can load it.
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
    // DELETE DOCUMENT
    // --------------------------------------------------

    async function handleDeleteDocument(
        documentNumber: number
    ) {
        const confirmed = window.confirm(
            `Are you sure you want to delete document ${documentNumber}?`
        );

        if (!confirmed) return;

        try {
            setDeletingDocument(documentNumber);
            setError("");
            setMessage("");

            const result: ApiMessage = await apiRequest(
                `/companies/my-admin-company/documents/${documentNumber}`,
                {
                    method: "DELETE",
                }
            );

            setMessage(
                result.message || "Document deleted successfully."
            );

            await loadCompanyData();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to delete document."
            );
        } finally {
            setDeletingDocument(null);
        }
    }

    // --------------------------------------------------
    // STATUS BADGE
    // --------------------------------------------------

    function getStatusStyle(status: string) {
        switch (status) {
            case "verified":
                return "bg-green-500/10 text-green-400 border-green-500/30";

            case "pending_review":
            case "submitted":
                return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";

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
    // MAIN UI
    // --------------------------------------------------

    return (
        <main className="min-h-screen bg-slate-950 text-white">

            {/* NAVIGATION */}

            <nav className="border-b border-slate-800">
                <div className="mx-auto max-w-5xl px-6 py-5 flex justify-between items-center">

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

                {/* HEADER */}

                <section className="mb-8">
                    <p className="text-blue-400 text-sm uppercase tracking-wider">
                        Company Admin
                    </p>

                    <h2 className="mt-2 text-3xl font-bold">
                        Company Verification
                    </h2>

                    <p className="mt-2 text-slate-400">
                        Verify your company's official email address
                        and submit the required documents.
                    </p>

                    <p className="mt-4 text-lg font-semibold">
                        {company.name}
                    </p>

                    {company.website && (
                        <p className="text-sm text-slate-500">
                            {company.website}
                        </p>
                    )}
                </section>

                {/* SUCCESS MESSAGE */}

                {message && (
                    <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
                        {message}
                    </div>
                )}

                {/* ERROR MESSAGE */}

                {error && (
                    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* OVERALL STATUS */}

                <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <h3 className="text-lg font-semibold mb-5">
                        Verification Overview
                    </h3>

                    <div className="grid gap-5 sm:grid-cols-3">

                        <div>
                            <p className="text-sm text-slate-400 mb-2">
                                Business Email
                            </p>

                            <span
                                className={`inline-block rounded-full border px-3 py-1 text-xs capitalize ${getStatusStyle(
                                    company.business_email_verified
                                        ? "verified"
                                        : "unverified"
                                )}`}
                            >
                                {company.business_email_verified
                                    ? "Verified"
                                    : "Unverified"}
                            </span>
                        </div>

                        <div>
                            <p className="text-sm text-slate-400 mb-2">
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
                            <p className="text-sm text-slate-400 mb-2">
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
                </section>

                {/* BUSINESS EMAIL VERIFICATION */}

                <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <div className="flex flex-wrap justify-between gap-3 items-center mb-5">

                        <div>
                            <h3 className="text-xl font-semibold">
                                Business Email Verification
                            </h3>

                            <p className="mt-1 text-sm text-slate-400">
                                Verify an email address matching your company website domain.
                            </p>
                        </div>

                        {company.business_email_verified && (
                            <span className="text-green-400 text-sm font-semibold">
                                ✓ Verified
                            </span>
                        )}

                    </div>

                    <label className="block text-sm text-slate-300 mb-2">
                        Official Business Email
                    </label>

                    <input
                        type="email"
                        value={businessEmail}
                        onChange={(e) => setBusinessEmail(e.target.value)}
                        disabled={company.business_email_verified}
                        placeholder="hr@yourcompany.com"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 disabled:opacity-60"
                    />

                    {!company.business_email_verified && (
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

                    {otpSent && !company.business_email_verified && (
                        <div className="mt-6 border-t border-slate-800 pt-5">

                            <label className="block text-sm text-slate-300 mb-2">
                                Enter the OTP sent to your business email
                            </label>

                            <input
                                type="text"
                                value={otp}
                                onChange={(e) =>
                                    setOtp(
                                        e.target.value.replace(/\D/g, "").slice(0, 6)
                                    )
                                }
                                maxLength={6}
                                placeholder="Enter OTP"
                                className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white tracking-widest outline-none focus:border-blue-500"
                            />

                            <button
                                onClick={handleVerifyOtp}
                                disabled={verifyingOtp || otp.trim().length === 0}
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

                    <p className="mt-2 mb-6 text-sm text-slate-400">
                        Upload the two required company verification documents.
                        Accepted formats: PDF, DOCX, JPG, JPEG and PNG.
                        Maximum size: 5 MB per document.
                    </p>

                    {/* DOCUMENT 1 */}

                    <div className="mb-6 rounded-xl border border-slate-700 bg-slate-950 p-5">

                        <div className="flex flex-wrap justify-between gap-3 items-center">

                            <div>
                                <h4 className="font-semibold">
                                    Company Document 1
                                </h4>

                                <p className="mt-1 text-sm text-slate-400">
                                    {document1Exists
                                        ? "Document uploaded"
                                        : "No document uploaded"}
                                </p>
                            </div>

                            <span
                                className={`rounded-full border px-3 py-1 text-xs ${document1Exists
                                    ? getStatusStyle("verified")
                                    : getStatusStyle("unverified")
                                    }`}
                            >
                                {document1Exists ? "Uploaded" : "Missing"}
                            </span>

                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">

                            <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
                                {uploadingDocument === 1
                                    ? "Uploading..."
                                    : document1Exists
                                        ? "Replace Document"
                                        : "Upload Document"}

                                <input
                                    type="file"
                                    accept=".pdf,.docx,.jpg,.jpeg,.png"
                                    className="hidden"
                                    disabled={uploadingDocument !== null}
                                    onChange={(e) => {
                                        handleDocumentUpload(
                                            1,
                                            e.target.files?.[0]
                                        );
                                        e.currentTarget.value = "";
                                    }}
                                />
                            </label>

                            {document1Exists && (
                                <>
                                    <button
                                        onClick={() => handleViewDocument(1)}
                                        className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:border-blue-500"
                                    >
                                        View Document
                                    </button>

                                    <button
                                        onClick={() => handleDeleteDocument(1)}
                                        disabled={deletingDocument !== null}
                                        className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                                    >
                                        {deletingDocument === 1
                                            ? "Deleting..."
                                            : "Delete"}
                                    </button>
                                </>
                            )}

                        </div>
                    </div>

                    {/* DOCUMENT 2 */}

                    <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">

                        <div className="flex flex-wrap justify-between gap-3 items-center">

                            <div>
                                <h4 className="font-semibold">
                                    Company Document 2
                                </h4>

                                <p className="mt-1 text-sm text-slate-400">
                                    {document2Exists
                                        ? "Document uploaded"
                                        : "No document uploaded"}
                                </p>
                            </div>

                            <span
                                className={`rounded-full border px-3 py-1 text-xs ${document2Exists
                                    ? getStatusStyle("verified")
                                    : getStatusStyle("unverified")
                                    }`}
                            >
                                {document2Exists ? "Uploaded" : "Missing"}
                            </span>

                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">

                            <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
                                {uploadingDocument === 2
                                    ? "Uploading..."
                                    : document2Exists
                                        ? "Replace Document"
                                        : "Upload Document"}

                                <input
                                    type="file"
                                    accept=".pdf,.docx,.jpg,.jpeg,.png"
                                    className="hidden"
                                    disabled={uploadingDocument !== null}
                                    onChange={(e) => {
                                        handleDocumentUpload(
                                            2,
                                            e.target.files?.[0]
                                        );
                                        e.currentTarget.value = "";
                                    }}
                                />
                            </label>

                            {document2Exists && (
                                <>
                                    <button
                                        onClick={() => handleViewDocument(2)}
                                        className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:border-blue-500"
                                    >
                                        View Document
                                    </button>

                                    <button
                                        onClick={() => handleDeleteDocument(2)}
                                        disabled={deletingDocument !== null}
                                        className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                                    >
                                        {deletingDocument === 2
                                            ? "Deleting..."
                                            : "Delete"}
                                    </button>
                                </>
                            )}

                        </div>
                    </div>

                </section>

                {/* FOOTER */}

                <footer className="mt-10 border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
                    HireSwipe • Company Verification
                </footer>

            </div>
        </main>
    );
}