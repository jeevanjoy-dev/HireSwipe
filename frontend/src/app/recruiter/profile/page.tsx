
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../services/api";

interface User {
    id: number;
    name: string;
    email: string;
}

interface Company {
    id: number;
    admin_user_id: number;
    name: string;
    description: string | null;
    location: string | null;
    website: string | null;
}

interface RecruiterProfile {
    id: number;
    user_id: number;
    company_id: number | null;
    designation: string | null;
    user: User;
    company: Company | null;
}

export default function RecruiterProfilePage() {
    const router = useRouter();

    const [profile, setProfile] = useState<RecruiterProfile | null>(null);

    const [name, setName] = useState("");
    const [designation, setDesignation] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function loadProfile() {
            try {
                const token = localStorage.getItem("access_token");

                if (!token) {
                    router.replace("/login");
                    return;
                }

                const data: RecruiterProfile =
                    await apiRequest("/recruiter/profile");

                if (cancelled) return;

                setProfile(data);
                setName(data.user.name);
                setDesignation(data.designation || "");
                setNewEmail(data.user.email);
            } catch (err) {
                console.error("Profile loading error:", err);

                const status =
                    err && typeof err === "object" && "status" in err
                        ? (err as { status?: number }).status
                        : undefined;

                if (status === 401) {
                    localStorage.removeItem("access_token");
                    router.replace("/login");
                    return;
                }

                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load profile."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadProfile();

        return () => {
            cancelled = true;
        };
    }, [router]);

    async function handleSave() {
        if (!profile) return;

        const trimmedName = name.trim();
        const trimmedDesignation = designation.trim();
        const trimmedEmail = newEmail.trim();

        if (!trimmedName || !trimmedDesignation || !trimmedEmail) {
            setError("Name, designation and email are required.");
            return;
        }

        const emailChanged =
            trimmedEmail.toLowerCase() !==
            profile.user.email.toLowerCase();

        if (emailChanged && !currentPassword.trim()) {
            setError("Enter your current password to change your email.");
            return;
        }

        setSaving(true);
        setError("");
        setSuccess("");

        try {
            // STEP 1: Update recruiter name and designation.
            const updatedProfile: RecruiterProfile = await apiRequest(
                "/recruiter/profile",
                {
                    method: "PUT",
                    body: JSON.stringify({
                        name: trimmedName,
                        designation: trimmedDesignation,
                    }),
                }
            );

            setProfile(updatedProfile);
            setName(updatedProfile.user.name);
            setDesignation(updatedProfile.designation || "");

            // STEP 2: Update email only if it has changed.
            if (emailChanged) {
                try {
                    const updatedUser: User = await apiRequest(
                        "/auth/email",
                        {
                            method: "PUT",
                            body: JSON.stringify({
                                new_email: trimmedEmail,
                                current_password: currentPassword,
                            }),
                        }
                    );

                    setProfile((previous) =>
                        previous
                            ? {
                                  ...previous,
                                  user: updatedUser,
                              }
                            : previous
                    );

                    setNewEmail(updatedUser.email);
                    setCurrentPassword("");
                    setEditing(false);

                    setSuccess(
                        "Profile and login email updated successfully."
                    );
                } catch (emailError) {
                    // Profile was saved, but email update failed.
                    setNewEmail(updatedProfile.user.email);
                    setCurrentPassword("");

                    setError(
                        emailError instanceof Error
                            ? `Profile details were saved, but email was not changed: ${emailError.message}`
                            : "Profile details were saved, but email could not be changed."
                    );
                }
            } else {
                setNewEmail(updatedProfile.user.email);
                setEditing(false);

                setSuccess("Profile updated successfully.");
            }
        } catch (err) {
            console.error("Profile update error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to update profile."
            );
        } finally {
            setSaving(false);
        }
    }

    function handleCancel() {
        if (!profile) return;

        setName(profile.user.name);
        setDesignation(profile.designation || "");
        setNewEmail(profile.user.email);
        setCurrentPassword("");

        setEditing(false);
        setError("");
        setSuccess("");
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                Loading your profile...
            </main>
        );
    }

    if (error && !profile) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4">
                <p className="text-red-400">{error}</p>

                <button
                    onClick={() => router.push("/recruiter/dashboard")}
                    className="text-blue-400 hover:text-blue-300"
                >
                    Back to Dashboard
                </button>
            </main>
        );
    }

    if (!profile) return null;

    return (
        <main className="min-h-screen bg-slate-950 text-white">

            {/* NAVIGATION */}
            <nav className="border-b border-slate-800">
                <div className="mx-auto max-w-5xl px-6 py-5 flex justify-between items-center">
                    <h1 className="text-2xl font-bold">
                        <span className="text-blue-500">Hire</span>Swipe
                    </h1>

                    <button
                        onClick={() =>
                            router.push("/recruiter/dashboard")
                        }
                        className="text-sm text-slate-400 hover:text-white"
                    >
                        ← Dashboard
                    </button>
                </div>
            </nav>

            <div className="mx-auto max-w-5xl px-6 py-10">

                {/* PAGE HEADING */}
                <div className="mb-8">
                    <p className="text-blue-400 text-sm uppercase tracking-wider mb-2">
                        Recruiter Portal
                    </p>

                    <h2 className="text-3xl font-bold">
                        My Profile
                    </h2>

                    <p className="mt-2 text-slate-400">
                        View and manage your personal recruiter information.
                    </p>
                </div>

                {/* PROFILE CARD */}
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8">

                    {/* PROFILE HEADER */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-8">
                        <div className="h-20 w-20 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-3xl font-bold text-blue-400">
                            {profile.user.name.charAt(0).toUpperCase()}
                        </div>

                        <div>
                            <h3 className="text-2xl font-semibold">
                                {profile.user.name}
                            </h3>

                            <p className="text-slate-400 mt-1">
                                {profile.designation || "Recruiter"}
                            </p>

                            <p className="text-sm text-slate-500 mt-1">
                                {profile.company?.name ||
                                    "No company associated"}
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-slate-800 pt-6">

                        {/* SECTION HEADING */}
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold">
                                Personal Information
                            </h3>

                            {!editing && (
                                <button
                                    onClick={() => {
                                        setEditing(true);
                                        setError("");
                                        setSuccess("");
                                    }}
                                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm hover:bg-blue-500"
                                >
                                    Edit Profile
                                </button>
                            )}
                        </div>

                        {/* MESSAGES */}
                        {error && (
                            <p className="mb-4 text-sm text-red-400">
                                {error}
                            </p>
                        )}

                        {success && (
                            <p className="mb-4 text-sm text-green-400">
                                {success}
                            </p>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* FULL NAME */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">
                                    Full Name
                                </label>

                                {editing ? (
                                    <input
                                        value={name}
                                        onChange={(e) =>
                                            setName(e.target.value)
                                        }
                                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                                    />
                                ) : (
                                    <p className="rounded-lg bg-slate-950 px-4 py-3">
                                        {profile.user.name}
                                    </p>
                                )}
                            </div>

                            {/* DESIGNATION */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">
                                    Designation
                                </label>

                                {editing ? (
                                    <input
                                        value={designation}
                                        onChange={(e) =>
                                            setDesignation(e.target.value)
                                        }
                                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                                    />
                                ) : (
                                    <p className="rounded-lg bg-slate-950 px-4 py-3">
                                        {profile.designation ||
                                            "Not provided"}
                                    </p>
                                )}
                            </div>

                            {/* LOGIN EMAIL */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">
                                    Login Email
                                </label>

                                {editing ? (
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={(e) =>
                                            setNewEmail(e.target.value)
                                        }
                                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                                    />
                                ) : (
                                    <p className="rounded-lg bg-slate-950 px-4 py-3">
                                        {profile.user.email}
                                    </p>
                                )}
                            </div>

                            {/* COMPANY */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">
                                    Company
                                </label>

                                <p className="rounded-lg bg-slate-950 px-4 py-3 text-slate-400">
                                    {profile.company?.name ||
                                        "Not associated"}
                                </p>
                            </div>

                            {/* CURRENT PASSWORD */}
                            {editing &&
                                newEmail.trim().toLowerCase() !==
                                    profile.user.email.toLowerCase() && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm text-slate-400 mb-2">
                                            Current Password
                                        </label>

                                        <input
                                            type="password"
                                            autoComplete="current-password"
                                            value={currentPassword}
                                            onChange={(e) =>
                                                setCurrentPassword(
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Enter your current password"
                                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                                        />

                                        <p className="mt-2 text-xs text-slate-500">
                                            Required to verify your identity when changing your login email.
                                        </p>
                                    </div>
                                )}
                        </div>

                        {/* EDIT BUTTONS */}
                        {editing && (
                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="rounded-lg bg-blue-600 px-6 py-3 font-medium hover:bg-blue-500 disabled:opacity-50"
                                >
                                    {saving
                                        ? "Saving..."
                                        : "Save Changes"}
                                </button>

                                <button
                                    onClick={handleCancel}
                                    disabled={saving}
                                    className="rounded-lg border border-slate-700 px-6 py-3 hover:bg-slate-800 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* FOOTER */}
                <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
                    HireSwipe • Recruiter Portal
                </footer>
            </div>
        </main>
    );
}
