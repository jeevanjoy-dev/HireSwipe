
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

interface User {
    id: number;
    role: string;
}

interface Company {
    id: number;
    admin_user_id: number;
    name: string;
    email: string | null;
    description: string | null;
    location: string | null;
    website: string | null;
    logo_url?: string | null;
}

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

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        description: "",
        location: "",
        website: "",
    });

    useEffect(() => {
        loadCompany();
    }, []);

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
                companyData = await apiRequest(
                    "/companies/my-admin-company"
                ) as Company;

                setIsAdmin(true);
            } catch {
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
                email: companyData.email ?? "",
                description: companyData.description ?? "",
                location: companyData.location ?? "",
                website: companyData.website ?? "",
            });
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load company details."
            );
        } finally {
            setLoading(false);
        }
    }

    function handleChange(
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) {
        const { name, value } = e.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    function handleCancel() {
        if (!company) return;

        setFormData({
            name: company.name ?? "",
            email: company.email ?? "",
            description: company.description ?? "",
            location: company.location ?? "",
            website: company.website ?? "",
        });

        setIsEditing(false);
        setError("");
    }

    async function handleSave(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!company || !isAdmin) return;

        try {
            setSaving(true);
            setError("");

            const updatedCompany = await apiRequest(
                `/companies/${company.id}`,
                {
                    method: "PUT",
                    body: JSON.stringify(formData),
                }
            ) as Company;

            setCompany(updatedCompany);

            setFormData({
                name: updatedCompany.name ?? "",
                email: updatedCompany.email ?? "",
                description: updatedCompany.description ?? "",
                location: updatedCompany.location ?? "",
                website: updatedCompany.website ?? "",
            });

            setIsEditing(false);
            alert("Company details updated successfully.");
        } catch (err) {
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

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
            <div className="max-w-3xl mx-auto">

                <button
                    onClick={() => router.push("/dashboard")}
                    className="text-blue-400 mb-6"
                >
                    ← Back to Dashboard
                </button>

                <div className="mb-8">
                    <h1 className="text-3xl font-bold">
                        View Company
                    </h1>

                    <p className="text-slate-400 mt-2">
                        {isAdmin
                            ? "Manage your company's information."
                            : "View your associated company's information."}
                    </p>

                    <span className={`inline-block mt-4 px-3 py-1 rounded-full text-sm ${
                        isAdmin
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-green-500/20 text-green-400"
                    }`}>
                        {isAdmin ? "Company Admin" : "Secondary Recruiter"}
                    </span>
                </div>

                {error && (
                    <p className="text-red-400 mb-4">{error}</p>
                )}

                {/* Company Logo */}
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
                                {isAdmin
                                    ? "A dedicated space for your company logo."
                                    : "Company branding."}
                            </p>

                            {isAdmin && (
                                <p className="text-xs text-blue-400 mt-3">
                                    Logo upload will be connected through AWS S3.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Company Information */}
                <form
                    onSubmit={handleSave}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5"
                >
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">
                            Company Information
                        </h2>

                        {isAdmin && !isEditing && (
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold"
                            >
                                Edit Company
                            </button>
                        )}
                    </div>

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
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 disabled:opacity-70"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-300 mb-2">
                            Company Contact Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            disabled={!isAdmin || !isEditing}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 disabled:opacity-70"
                        />
                    </div>

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

                    <div>
                        <label className="block text-sm text-slate-300 mb-2">
                            Website
                        </label>
                        <input
                            name="website"
                            value={formData.website}
                            onChange={handleChange}
                            disabled={!isAdmin || !isEditing}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 disabled:opacity-70"
                        />
                    </div>

                    {isAdmin && isEditing && (
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold"
                            >
                                {saving ? "Saving..." : "Save Changes"}
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
            </div>
        </div>
    );
}
