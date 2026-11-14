
"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

// Logged-in user information.
interface User {
    id: number;
    role: string;
}

// Company information returned by the backend.
interface Company {
    id: number;
    admin_user_id: number;
    name: string;
    business_email: string | null;
    business_email_verified: boolean;
    business_phone: string | null;
    business_address: string | null;
    description: string | null;
    location: string | null;
    website: string | null;
    documents_status: string;
    verification_status: string;
    logo_url?: string | null;
}

// Secondary recruiter profile.
interface RecruiterProfile {
    id: number;
    user_id: number;
    company_id: number;
    designation: string;
    company: Company;
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

    // Editable company information.
    const [formData, setFormData] = useState({
        name: "",
        business_phone: "",
        business_address: "",
        description: "",
        location: "",
        website: "",
    });

    // Load company information when the page opens.
    useEffect(() => {
        loadCompany();
    }, []);

    async function loadCompany() {
        try {
            setLoading(true);
            setError("");

            // Check the currently logged-in user.
            const user = await apiRequest("/auth/me") as User;

            if (user.role !== "recruiter") {
                router.replace("/dashboard");
                return;
            }

            let companyData: Company;

            try {
                // First check whether the logged-in user is the company admin.
                companyData = await apiRequest(
                    "/companies/my-admin-company"
                ) as Company;

                setIsAdmin(true);

            } catch {
                // If not the company admin, load the secondary recruiter's company.
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

            // Populate the editable fields.
            setFormData({
                name: companyData.name ?? "",
                business_phone: companyData.business_phone ?? "",
                business_address: companyData.business_address ?? "",
                description: companyData.description ?? "",
                location: companyData.location ?? "",
                website: companyData.website ?? "",
            });

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

    // Handle changes in company information fields.
    function handleChange(
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) {
        const { name, value } = e.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    // Cancel editing and restore the saved company information.
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
        setError("");
        setSuccess("");
    }

    // Save company information through the existing backend endpoint.
    async function handleSave(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!company || !isAdmin) return;

        const trimmedPhone = formData.business_phone.trim();

        // Validate the international business phone number.
        // E.164 format: + followed by 8–15 digits.
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

            // Send all required company fields to the backend.
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

            // Update the displayed company information.
            setCompany(updatedCompany);

            // Refresh the form with the saved values.
            setFormData({
                name: updatedCompany.name ?? "",
                business_phone: updatedCompany.business_phone ?? "",
                business_address: updatedCompany.business_address ?? "",
                description: updatedCompany.description ?? "",
                location: updatedCompany.location ?? "",
                website: updatedCompany.website ?? "",
            });

            setIsEditing(false);
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

    // Loading screen.
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                Loading company details...
            </div>
        );
    }

    // Company not found.
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

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
            <div className="max-w-3xl mx-auto">

                {/* BACK TO DASHBOARD */}
                <button
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
                    <h2 className="text-lg font-semibold mb-4">
                        Company Logo
                    </h2>

                    <div className="flex flex-col sm:flex-row items-center gap-5">

                        {company.logo_url ? (
                            <img
                                src={company.logo_url}
                                alt={`${company.name} logo`}
                                className="w-28 h-28 rounded-xl object-contain bg-white p-2"
                            />
                        ) : (
                            <div className="w-28 h-28 rounded-xl bg-slate-800 border border-dashed border-slate-600 flex items-center justify-center text-slate-400 text-sm text-center p-3">
                                Company Logo
                            </div>
                        )}

                        <div>
                            <p className="font-medium">
                                {company.name}
                            </p>

                            <p className="text-sm text-slate-400 mt-1">
                                Company branding and identity.
                            </p>

                            {isAdmin && (
                                <p className="text-xs text-blue-400 mt-3">
                                    Logo upload will be connected through AWS S3.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* COMPANY VERIFICATION STATUS */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-5">
                        Company Verification
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                        {/* BUSINESS EMAIL STATUS */}
                        <div className="bg-slate-950 rounded-lg p-4">
                            <p className="text-sm text-slate-400 mb-2">
                                Business Email
                            </p>

                            <p className={
                                company.business_email_verified
                                    ? "text-green-400 text-sm font-medium"
                                    : "text-amber-400 text-sm font-medium"
                            }>
                                {company.business_email_verified
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
                                    .replace(/\b\w/g, (char) => char.toUpperCase()) ||
                                    "Not Submitted"}
                            </p>
                        </div>

                        {/* OVERALL VERIFICATION */}
                        <div className="bg-slate-950 rounded-lg p-4">
                            <p className="text-sm text-slate-400 mb-2">
                                Overall Status
                            </p>

                            <p className={
                                company.verification_status === "verified"
                                    ? "text-green-400 text-sm font-medium"
                                    : company.verification_status === "rejected"
                                        ? "text-red-400 text-sm font-medium"
                                        : "text-amber-400 text-sm font-medium"
                            }>
                                {company.verification_status
                                    ?.replace(/_/g, " ")
                                    .replace(/\b\w/g, (char) => char.toUpperCase()) ||
                                    "Unverified"}
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

                    {/* SAVE AND CANCEL BUTTONS */}
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
