
"use client";

import {
    useEffect,
    useState,
    type ChangeEvent,
    type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
    apiRequest,
    apiFileRequest,
} from "../../../services/api";

interface User {
    id: number;
    role: string;
}

interface Company {
    id: number;
    admin_user_id: number;
    name: string;
    business_email: string | null;
    business_email_verified: boolean;
    business_phone: string | null;
    business_phone_verified: boolean;
    business_address: string | null;
    description: string | null;
    location: string | null;
    website: string | null;
    documents_status: string;
    verification_status: string;
    logo_url?: string | null;
}

interface RecruiterProfile {
    id: number;
    user_id: number;
    company_id: number;
    designation: string;
    company: Company;
}

interface PhoneOtpResponse {
    message: string;
    business_phone: string;
    business_phone_verified: boolean;
    mock_otp?: string;
}

export default function CompanyPage() {
    const router = useRouter();

    const [company, setCompany] = useState<Company | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Company logo state
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoUploading, setLogoUploading] = useState(false);
    const [logoDeleting, setLogoDeleting] = useState(false);

    // Phone OTP state
    const [phoneOtp, setPhoneOtp] = useState("");
    const [phoneOtpSent, setPhoneOtpSent] = useState(false);
    const [mockOtp, setMockOtp] = useState("");

    const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
    const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false);

    // Editable company information
    const [formData, setFormData] = useState({
        name: "",
        business_phone: "",
        business_address: "",
        description: "",
        location: "",
        website: "",
    });

    // Load company when page opens
    useEffect(() => {
        loadCompany();
    }, []);

    // Revoke temporary browser image URLs when replaced or unmounted
    useEffect(() => {
        return () => {
            if (logoUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(logoUrl);
            }
        };
    }, [logoUrl]);

    async function loadCompanyLogo(companyId: number) {
        try {
            const blob = await apiFileRequest(
                `/companies/${companyId}/logo`
            );

            const newLogoUrl = URL.createObjectURL(blob);

            setLogoUrl((previousUrl) => {
                if (previousUrl?.startsWith("blob:")) {
                    URL.revokeObjectURL(previousUrl);
                }

                return newLogoUrl;
            });
        } catch (err) {
            // A company without a logo should not prevent
            // the rest of the company page from loading.
            console.warn("Company logo could not be loaded:", err);

            setLogoUrl(null);
        }
    }

    async function loadCompany() {
        try {
            setLoading(true);
            setError("");

            const user = await apiRequest("/auth/me") as User;

            if (user.role !== "recruiter") {
                router.replace("/dashboard");
                return;
            }

            let companyData: Company;

            try {
                // Company Admin
                companyData = await apiRequest(
                    "/companies/my-admin-company"
                ) as Company;

                setIsAdmin(true);
            } catch {
                // Secondary Recruiter
                const profile = await apiRequest(
                    "/recruiter/profile"
                ) as RecruiterProfile;

                companyData = profile.company;
                setIsAdmin(false);
            }

            if (!companyData) {
                throw new Error("Company information not found.");
            }

            setCompany(companyData);

            setFormData({
                name: companyData.name ?? "",
                business_phone: companyData.business_phone ?? "",
                business_address: companyData.business_address ?? "",
                description: companyData.description ?? "",
                location: companyData.location ?? "",
                website: companyData.website ?? "",
            });

            // Load logo independently so a missing logo
            // does not stop company information from displaying.
            await loadCompanyLogo(companyData.id);

        } catch (err) {
            console.error("Company loading error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load company details."
            );
        } finally {
            setLoading(false);
        }
    }

    // Company logo upload / replacement
    async function handleLogoUpload(file: File | undefined) {
        if (!file || !company || !isAdmin) return;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
        ];

        if (!allowedTypes.includes(file.type)) {
            setError("Only JPG, JPEG and PNG images are allowed.");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError("Company logo must not exceed 5 MB.");
            return;
        }

        try {
            setLogoUploading(true);
            setError("");
            setSuccess("");

            const formData = new FormData();
            formData.append("file", file);

            await apiRequest(
                "/companies/my-admin-company/logo",
                {
                    method: "POST",
                    body: formData,
                }
            );

            await loadCompanyLogo(company.id);

            setSuccess("Company logo uploaded successfully.");
        } catch (err) {
            console.error("Company logo upload error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to upload company logo."
            );
        } finally {
            setLogoUploading(false);
        }
    }

    // Delete company logo
    async function handleLogoDelete() {
        if (!company || !isAdmin) return;

        const confirmed = window.confirm(
            "Are you sure you want to delete the company logo?"
        );

        if (!confirmed) return;

        try {
            setLogoDeleting(true);
            setError("");
            setSuccess("");

            await apiRequest(
                "/companies/my-admin-company/logo",
                {
                    method: "DELETE",
                }
            );

            setLogoUrl((previousUrl) => {
                if (previousUrl?.startsWith("blob:")) {
                    URL.revokeObjectURL(previousUrl);
                }

                return null;
            });

            setSuccess("Company logo deleted successfully.");
        } catch (err) {
            console.error("Company logo deletion error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to delete company logo."
            );
        } finally {
            setLogoDeleting(false);
        }
    }

    // Handle company information changes
    function handleChange(
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) {
        const { name, value } = e.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));

        if (name === "business_phone") {
            setPhoneOtp("");
            setPhoneOtpSent(false);
            setMockOtp("");
            setSuccess("");
        }
    }

    // Send phone OTP
    async function handleSendPhoneOtp() {
        if (!company || !isAdmin) return;

        const phone = formData.business_phone.trim();

        if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
            setError(
                "Enter a valid international phone number with country code. Example: +919876543210"
            );
            return;
        }

        try {
            setSendingPhoneOtp(true);
            setError("");
            setSuccess("");

            const response = await apiRequest(
                "/companies/my-admin-company/business-phone/send-otp",
                {
                    method: "POST",
                    body: JSON.stringify({
                        business_phone: phone,
                    }),
                }
            ) as PhoneOtpResponse;

            setPhoneOtpSent(true);
            setPhoneOtp("");
            setMockOtp(response.mock_otp ?? "");

            setCompany((previous) =>
                previous
                    ? {
                        ...previous,
                        business_phone: response.business_phone,
                        business_phone_verified:
                            response.business_phone_verified,
                    }
                    : previous
            );

            setSuccess(
                response.message || "Mock OTP generated successfully."
            );
        } catch (err) {
            console.error("Phone OTP sending error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to generate phone OTP."
            );
        } finally {
            setSendingPhoneOtp(false);
        }
    }

    // Verify phone OTP
    async function handleVerifyPhoneOtp() {
        if (!company || !isAdmin) return;

        if (!/^\d{6}$/.test(phoneOtp)) {
            setError("Enter the valid 6-digit OTP.");
            return;
        }

        try {
            setVerifyingPhoneOtp(true);
            setError("");
            setSuccess("");

            const response = await apiRequest(
                "/companies/my-admin-company/business-phone/verify-otp",
                {
                    method: "POST",
                    body: JSON.stringify({
                        otp: phoneOtp,
                    }),
                }
            ) as PhoneOtpResponse;

            const updatedCompany = await apiRequest(
                "/companies/my-admin-company"
            ) as Company;

            setCompany(updatedCompany);

            setFormData((previous) => ({
                ...previous,
                business_phone: updatedCompany.business_phone ?? "",
            }));

            setPhoneOtp("");
            setPhoneOtpSent(false);
            setMockOtp("");

            setSuccess(
                response.message || "Business phone verified successfully."
            );
        } catch (err) {
            console.error("Phone OTP verification error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to verify phone number."
            );
        } finally {
            setVerifyingPhoneOtp(false);
        }
    }

    // Cancel company editing
    function handleCancel() {
        if (!company) return;

        setFormData({
            name: company.name ?? "",
            business_phone: company.business_phone ?? "",
            business_address: company.business_address ?? "",
            description: company.description ?? "",
            location: company.location ?? "",
            website: company.website ?? "",
        });

        setIsEditing(false);

        setPhoneOtp("");
        setPhoneOtpSent(false);
        setMockOtp("");

        setError("");
        setSuccess("");
    }

    // Save company information
    async function handleSave(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!company || !isAdmin) return;

        const trimmedPhone = formData.business_phone.trim();

        if (
            trimmedPhone &&
            !/^\+[1-9]\d{7,14}$/.test(trimmedPhone)
        ) {
            setError(
                "Enter a valid international business phone number with country code. Maximum 15 digits."
            );
            return;
        }

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            const updatedCompany = await apiRequest(
                `/companies/${company.id}`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        name: formData.name.trim(),
                        description: formData.description.trim() || null,
                        location: formData.location.trim() || null,
                        website: formData.website.trim() || null,
                        business_phone: trimmedPhone || null,
                        business_address:
                            formData.business_address.trim() || null,
                    }),
                }
            ) as Company;

            setCompany(updatedCompany);

            setFormData({
                name: updatedCompany.name ?? "",
                business_phone: updatedCompany.business_phone ?? "",
                business_address:
                    updatedCompany.business_address ?? "",
                description: updatedCompany.description ?? "",
                location: updatedCompany.location ?? "",
                website: updatedCompany.website ?? "",
            });

            setIsEditing(false);

            setPhoneOtp("");
            setPhoneOtpSent(false);
            setMockOtp("");

            setSuccess("Company details updated successfully.");

        } catch (err) {
            console.error("Company update error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to update company."
            );
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                Loading company details...
            </div>
        );
    }

    if (!company) {
        return (
            <div className="min-h-screen bg-slate-950 text-white p-8">
                <p className="text-red-400">
                    {error || "Company details not found."}
                </p>

                <button
                    onClick={() => router.push("/dashboard")}
                    className="mt-4 text-blue-400"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    const phoneMatchesSaved =
        (formData.business_phone.trim() || "") ===
        (company.business_phone ?? "");

    const phoneIsVerified =
        company.business_phone_verified && phoneMatchesSaved;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
            <div className="max-w-3xl mx-auto">

                {/* BACK TO DASHBOARD */}
                <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="text-blue-400 mb-6 hover:text-blue-300"
                >
                    ← Back to Dashboard
                </button>

                {/* PAGE HEADING */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">
                        View Company
                    </h1>

                    <p className="text-slate-400 mt-2">
                        {isAdmin
                            ? "Manage your company's information."
                            : "View your associated company's information."}
                    </p>

                    <span
                        className={`inline-block mt-4 px-3 py-1 rounded-full text-sm ${
                            isAdmin
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-green-500/20 text-green-400"
                        }`}
                    >
                        {isAdmin
                            ? "Company Admin"
                            : "Secondary Recruiter"}
                    </span>
                </div>

                {/* ERROR MESSAGE */}
                {error && (
                    <p className="text-red-400 mb-4">
                        {error}
                    </p>
                )}

                {/* SUCCESS MESSAGE */}
                {success && (
                    <p className="text-green-400 mb-4">
                        {success}
                    </p>
                )}

                {/* COMPANY LOGO */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-5">
                        Company Logo
                    </h2>

                    <div className="flex flex-col sm:flex-row items-center gap-6">

                        {/* Logo display area */}
                        <div className="w-40 h-40 shrink-0 rounded-xl overflow-hidden bg-white flex items-center justify-center border border-slate-700">
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt={`${company.name} logo`}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400 text-sm text-center p-3">
                                    No Company Logo
                                </div>
                            )}
                        </div>

                        <div className="flex-1 text-center sm:text-left">
                            <p className="font-semibold text-lg">
                                {company.name}
                            </p>

                            <p className="text-sm text-slate-400 mt-1">
                                Company branding and identity.
                            </p>

                            {isAdmin && (
                                <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-5">

                                    {/* Upload / Replace */}
                                    <label
                                        className={`cursor-pointer inline-flex items-center justify-center px-5 py-3 rounded-lg font-semibold ${
                                            logoUploading
                                                ? "bg-blue-800 opacity-60 cursor-not-allowed"
                                                : "bg-blue-600 hover:bg-blue-700"
                                        }`}
                                    >
                                        {logoUploading
                                            ? "Uploading..."
                                            : logoUrl
                                                ? "Replace Logo"
                                                : "Upload Logo"}

                                        <input
                                            type="file"
                                            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                                            className="hidden"
                                            disabled={logoUploading || logoDeleting}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                void handleLogoUpload(file);
                                                e.target.value = "";
                                            }}
                                        />
                                    </label>

                                    {/* Delete */}
                                    {logoUrl && (
                                        <button
                                            type="button"
                                            onClick={handleLogoDelete}
                                            disabled={logoDeleting || logoUploading}
                                            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-5 py-3 rounded-lg font-semibold"
                                        >
                                            {logoDeleting
                                                ? "Deleting..."
                                                : "Delete Logo"}
                                        </button>
                                    )}
                                </div>
                            )}

                            <p className="text-xs text-slate-500 mt-3">
                                JPG, JPEG or PNG. Maximum size: 5 MB.
                            </p>

                            {!isAdmin && (
                                <p className="text-xs text-slate-500 mt-3">
                                    Only the Company Admin can change the company logo.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* COMPANY VERIFICATION */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-5">
                        Company Verification
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                        {/* BUSINESS EMAIL */}
                        <div className="bg-slate-950 rounded-lg p-4">
                            <p className="text-sm text-slate-400 mb-2">
                                Business Email
                            </p>

                            <p
                                className={
                                    company.business_email_verified
                                        ? "text-green-400 text-sm font-medium"
                                        : "text-amber-400 text-sm font-medium"
                                }
                            >
                                {company.business_email_verified
                                    ? "Verified"
                                    : "Not Verified"}
                            </p>
                        </div>

                        {/* BUSINESS PHONE */}
                        <div className="bg-slate-950 rounded-lg p-4">
                            <p className="text-sm text-slate-400 mb-2">
                                Business Phone
                            </p>

                            <p
                                className={
                                    company.business_phone_verified
                                        ? "text-green-400 text-sm font-medium"
                                        : "text-amber-400 text-sm font-medium"
                                }
                            >
                                {company.business_phone_verified
                                    ? "Verified"
                                    : "Not Verified"}
                            </p>
                        </div>

                        {/* DOCUMENT STATUS */}
                        <div className="bg-slate-950 rounded-lg p-4">
                            <p className="text-sm text-slate-400 mb-2">
                                Documents
                            </p>

                            <p className="text-blue-400 text-sm font-medium">
                                {company.documents_status
                                    ?.replace(/_/g, " ")
                                    .replace(/\b\w/g, (char) =>
                                        char.toUpperCase()
                                    ) || "Not Submitted"}
                            </p>
                        </div>

                        {/* OVERALL STATUS */}
                        <div className="bg-slate-950 rounded-lg p-4">
                            <p className="text-sm text-slate-400 mb-2">
                                Overall Status
                            </p>

                            <p
                                className={
                                    company.verification_status === "verified"
                                        ? "text-green-400 text-sm font-medium"
                                        : company.verification_status === "rejected"
                                            ? "text-red-400 text-sm font-medium"
                                            : "text-amber-400 text-sm font-medium"
                                }
                            >
                                {company.verification_status
                                    ?.replace(/_/g, " ")
                                    .replace(/\b\w/g, (char) =>
                                        char.toUpperCase()
                                    ) || "Unverified"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* COMPANY INFORMATION FORM */}
                <form
                    onSubmit={handleSave}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5"
                >
                    {/* SECTION HEADING */}
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">
                            Company Information
                        </h2>

                        {isAdmin && !isEditing && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditing(true);
                                    setError("");
                                    setSuccess("");
                                }}
                                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold"
                            >
                                Edit Company
                            </button>
                        )}
                    </div>

                    {/* COMPANY NAME */}
                    <div>
                        <label className="block text-sm text-slate-300 mb-2">
                            Company Name
                        </label>

                        <input
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            disabled={!isAdmin || !isEditing}
                            required
                            maxLength={150}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 disabled:opacity-70"
                        />
                    </div>

                    {/* BUSINESS EMAIL */}
                    <div>
                        <label className="block text-sm text-slate-300 mb-2">
                            Business Email
                        </label>

                        <div className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 flex flex-wrap justify-between gap-2">
                            <span className="break-all">
                                {company.business_email || "Not provided"}
                            </span>

                            <span
                                className={
                                    company.business_email_verified
                                        ? "text-green-400 text-sm"
                                        : "text-amber-400 text-sm"
                                }
                            >
                                {company.business_email_verified
                                    ? "Verified"
                                    : "Not verified"}
                            </span>
                        </div>

                        <p className="text-xs text-slate-500 mt-2">
                            Business email changes must be completed through email OTP verification.
                        </p>
                    </div>

                    {/* BUSINESS PHONE */}
                    <div>
                        <label className="block text-sm text-slate-300 mb-2">
                            Business Phone
                        </label>

                        <input
                            type="tel"
                            name="business_phone"
                            value={formData.business_phone}
                            onChange={handleChange}
                            disabled={!isAdmin || !isEditing}
                            maxLength={16}
                            placeholder="+919876543210"
                            autoComplete="tel"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 disabled:opacity-70"
                        />

                        <p className="text-xs text-slate-500 mt-2">
                            Include the country code. Maximum 15 digits.
                            Example: +919876543210
                        </p>

                        <div className="mt-3 flex items-center gap-2">
                            <span className="text-sm text-slate-400">
                                Verification status:
                            </span>

                            <span
                                className={
                                    phoneIsVerified
                                        ? "text-green-400 text-sm font-semibold"
                                        : "text-amber-400 text-sm font-semibold"
                                }
                            >
                                {phoneIsVerified
                                    ? "Verified"
                                    : "Not Verified"}
                            </span>
                        </div>

                        {/* PHONE OTP CONTROLS */}
                        {isAdmin && isEditing && (
                            <div className="mt-4 space-y-4">

                                <button
                                    type="button"
                                    onClick={handleSendPhoneOtp}
                                    disabled={
                                        sendingPhoneOtp ||
                                        !formData.business_phone.trim()
                                    }
                                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-5 py-2.5 rounded-lg font-semibold"
                                >
                                    {sendingPhoneOtp
                                        ? "Generating OTP..."
                                        : phoneOtpSent
                                            ? "Resend OTP"
                                            : "Send Phone OTP"}
                                </button>

                                {/* DEVELOPMENT MOCK OTP */}
                                {phoneOtpSent && mockOtp && (
                                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                                        <p className="text-amber-400 text-sm font-semibold mb-2">
                                            Development Mock OTP
                                        </p>

                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-2xl font-bold tracking-widest text-white">
                                                {mockOtp}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    navigator.clipboard.writeText(mockOtp)
                                                }
                                                className="text-sm text-blue-400 hover:text-blue-300"
                                            >
                                                Copy OTP
                                            </button>
                                        </div>

                                        <p className="text-xs text-slate-400 mt-2">
                                            This OTP is displayed for development testing. No SMS is sent.
                                        </p>
                                    </div>
                                )}

                                {/* OTP INPUT */}
                                {phoneOtpSent && (
                                    <div className="space-y-3">
                                        <label className="block text-sm text-slate-300">
                                            Enter 6-digit OTP
                                        </label>

                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            maxLength={6}
                                            value={phoneOtp}
                                            onChange={(e) =>
                                                setPhoneOtp(
                                                    e.target.value.replace(/\D/g, "").slice(0, 6)
                                                )
                                            }
                                            placeholder="Enter OTP"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 tracking-widest"
                                        />

                                        <button
                                            type="button"
                                            onClick={handleVerifyPhoneOtp}
                                            disabled={
                                                verifyingPhoneOtp ||
                                                phoneOtp.length !== 6
                                            }
                                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-5 py-2.5 rounded-lg font-semibold"
                                        >
                                            {verifyingPhoneOtp
                                                ? "Verifying..."
                                                : "Verify Phone"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* BUSINESS ADDRESS */}
                    <div>
                        <label className="block text-sm text-slate-300 mb-2">
                            Business Address
                        </label>

                        <textarea
                            name="business_address"
                            value={formData.business_address}
                            onChange={handleChange}
                            disabled={!isAdmin || !isEditing}
                            rows={3}
                            maxLength={1000}
                            placeholder="Enter your complete registered business address"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 disabled:opacity-70"
                        />
                    </div>

                    {/* COMPANY DESCRIPTION */}
                    <div>
                        <label className="block text-sm text-slate-300 mb-2">
                            Description
                        </label>

                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            disabled={!isAdmin || !isEditing}
                            rows={4}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 disabled:opacity-70"
                        />
                    </div>

                    {/* LOCATION */}
                    <div>
                        <label className="block text-sm text-slate-300 mb-2">
                            Location
                        </label>

                        <input
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            disabled={!isAdmin || !isEditing}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 disabled:opacity-70"
                        />
                    </div>

                    {/* WEBSITE */}
                    <div>
                        <label className="block text-sm text-slate-300 mb-2">
                            Website
                        </label>

                        <input
                            type="url"
                            name="website"
                            value={formData.website}
                            onChange={handleChange}
                            disabled={!isAdmin || !isEditing}
                            placeholder="https://example.com"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 disabled:opacity-70"
                        />
                    </div>

                    {/* SAVE AND CANCEL */}
                    {isAdmin && isEditing && (
                        <div className="flex flex-wrap gap-3 pt-3">
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold"
                            >
                                {saving
                                    ? "Saving..."
                                    : "Save Changes"}
                            </button>

                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={saving}
                                className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-lg font-semibold"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </form>

                {/* FOOTER */}
                <footer className="mt-10 text-center text-sm text-slate-500">
                    HireSwipe • Company Management
                </footer>

            </div>
        </div>
    );
}
