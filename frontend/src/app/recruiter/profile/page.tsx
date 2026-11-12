
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    apiRequest,
    apiFileRequest,
} from "../../../services/api";

interface User {
    id: number;
    name: string;
    email: string;
}

interface AuthUser {
    phone: string | null;
    phone_verified: boolean;
}

interface Company {
    id: number;
    admin_user_id: number;
    name: string;
    description: string | null;
    location: string | null;
    website: string | null;
    admin_profile_photo?: string | null;
}

interface RecruiterProfile {
    id: number;
    user_id: number;
    company_id: number | null;
    designation: string | null;
    profile_photo?: string | null;
    user: User;
    company: Company | null;
}

type PhotoEndpoint =
    | "/companies/my-admin-company/photo"
    | "/recruiter/profile/photo";

function getErrorStatus(err: unknown): number | undefined {
    if (err && typeof err === "object" && "status" in err) {
        return (err as { status?: number }).status;
    }

    return undefined;
}

export default function RecruiterProfilePage() {
    const router = useRouter();

    const [profile, setProfile] =
        useState<RecruiterProfile | null>(null);

    const [name, setName] = useState("");
    const [designation, setDesignation] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");

    // Phone verification states
    const [phone, setPhone] = useState("");
    const [savedPhone, setSavedPhone] = useState("");
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [phoneOtp, setPhoneOtp] = useState("");
    const [phoneOtpSent, setPhoneOtpSent] = useState(false);
    const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
    const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false);

    // Profile photo states
    const [photoUrl, setPhotoUrl] = useState("");
    const [photoEndpoint, setPhotoEndpoint] =
        useState<PhotoEndpoint | null>(null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [photoRemoving, setPhotoRemoving] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Load the correct photo endpoint for the logged-in user.
    async function determinePhotoEndpoint(): Promise<PhotoEndpoint> {
        try {
            await apiRequest("/companies/my-admin-company");

            return "/companies/my-admin-company/photo";
        } catch (err) {
            if (getErrorStatus(err) === 404) {
                return "/recruiter/profile/photo";
            }

            throw err;
        }
    }

    // Load the user's existing profile photo.
    async function loadProfilePhoto(
        endpoint: PhotoEndpoint
    ) {
        try {
            const imageBlob: Blob =
                await apiFileRequest(endpoint);

            const imageUrl = URL.createObjectURL(imageBlob);
            setPhotoUrl(imageUrl);
        } catch (err) {
            if (getErrorStatus(err) === 404) {
                setPhotoUrl("");
                return;
            }

            console.error("Profile photo loading error:", err);
        }
    }

    // Revoke old object URLs when the photo changes or the page unmounts.
    useEffect(() => {
        return () => {
            if (photoUrl) {
                URL.revokeObjectURL(photoUrl);
            }
        };
    }, [photoUrl]);

    // Load profile and authentication details.
    useEffect(() => {
        let cancelled = false;

        async function loadProfile() {
            try {
                const token = localStorage.getItem("access_token");

                if (!token) {
                    router.replace("/login");
                    return;
                }

                const [data, authUser]: [
                    RecruiterProfile,
                    AuthUser
                ] = await Promise.all([
                    apiRequest("/recruiter/profile"),
                    apiRequest("/auth/me"),
                ]);

                if (cancelled) return;

                setProfile(data);
                setName(data.user.name);
                setDesignation(data.designation || "");
                setNewEmail(data.user.email);

                setPhone(authUser.phone || "");
                setSavedPhone(authUser.phone || "");
                setPhoneVerified(authUser.phone_verified);

                setPhoneOtp("");
                setPhoneOtpSent(false);

                // Photo loading should not prevent the profile from loading.
                try {
                    const endpoint =
                        await determinePhotoEndpoint();

                    if (cancelled) return;

                    setPhotoEndpoint(endpoint);
                    await loadProfilePhoto(endpoint);
                } catch (photoError) {
                    console.error(
                        "Unable to determine profile photo endpoint:",
                        photoError
                    );
                }
            } catch (err) {
                console.error("Profile loading error:", err);

                const status = getErrorStatus(err);

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

    // Select and validate a profile photo.
    function handlePhotoSelection(file?: File) {
        setError("");
        setSuccess("");

        if (!file) {
            setPhotoFile(null);
            return;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
        ];

        if (!allowedTypes.includes(file.type)) {
            setError(
                "Only JPG, JPEG, PNG and WebP images are allowed."
            );
            setPhotoFile(null);
            return;
        }

        const maxSize = 2 * 1024 * 1024;

        if (file.size > maxSize) {
            setError("Profile photo must be smaller than 2 MB.");
            setPhotoFile(null);
            return;
        }

        setPhotoFile(file);
    }

    // Upload or replace profile photo.
    async function handlePhotoUpload() {
        if (!photoFile) {
            setError("Please select a profile photo first.");
            return;
        }

        if (!photoEndpoint) {
            setError(
                "Unable to identify your profile photo endpoint. Please reload the page."
            );
            return;
        }

        setPhotoUploading(true);
        setError("");
        setSuccess("");

        try {
            const formData = new FormData();
            formData.append("file", photoFile);

            await apiRequest(photoEndpoint, {
                method: "POST",
                body: formData,
            });

            setPhotoFile(null);

            await loadProfilePhoto(photoEndpoint);

            setSuccess("Profile photo updated successfully.");
        } catch (err) {
            console.error("Photo upload error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to upload profile photo."
            );
        } finally {
            setPhotoUploading(false);
        }
    }

    // Remove existing profile photo.
    async function handlePhotoRemove() {
        if (!photoEndpoint) return;

        const confirmed = window.confirm(
            "Are you sure you want to remove your profile photo?"
        );

        if (!confirmed) return;

        setPhotoRemoving(true);
        setError("");
        setSuccess("");

        try {
            await apiRequest(photoEndpoint, {
                method: "DELETE",
            });

            setPhotoUrl("");
            setPhotoFile(null);

            setSuccess("Profile photo removed successfully.");
        } catch (err) {
            console.error("Photo removal error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to remove profile photo."
            );
        } finally {
            setPhotoRemoving(false);
        }
    }

    // Save recruiter profile information.
    async function handleSave() {
        if (!profile) return;

        const trimmedName = name.trim();
        const trimmedDesignation = designation.trim();
        const trimmedEmail = newEmail.trim();

        if (
            !trimmedName ||
            !trimmedDesignation ||
            !trimmedEmail
        ) {
            setError(
                "Name, designation and email are required."
            );
            return;
        }

        const emailChanged =
            trimmedEmail.toLowerCase() !==
            profile.user.email.toLowerCase();

        if (
            phone.trim() !== savedPhone &&
            !phoneVerified
        ) {
            setError(
                "Verify your new phone number before saving your profile."
            );
            return;
        }

        if (emailChanged && !currentPassword.trim()) {
            setError(
                "Enter your current password to change your email."
            );
            return;
        }

        setSaving(true);
        setError("");
        setSuccess("");

        try {
            // STEP 1: Update recruiter name and designation.
            const updatedProfile: RecruiterProfile =
                await apiRequest("/recruiter/profile", {
                    method: "PUT",
                    body: JSON.stringify({
                        name: trimmedName,
                        designation: trimmedDesignation,
                    }),
                });

            setProfile(updatedProfile);
            setName(updatedProfile.user.name);
            setDesignation(
                updatedProfile.designation || ""
            );

            // STEP 2: Update email only if it has changed.
            if (emailChanged) {
                try {
                    const updatedUser: User =
                        await apiRequest("/auth/email", {
                            method: "PUT",
                            body: JSON.stringify({
                                new_email: trimmedEmail,
                                current_password: currentPassword,
                            }),
                        });

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

    // Cancel profile editing.
    function handleCancel() {
        if (!profile) return;

        setName(profile.user.name);
        setDesignation(profile.designation || "");
        setNewEmail(profile.user.email);
        setCurrentPassword("");

        setPhoneOtp("");
        setPhoneOtpSent(false);

        setPhotoFile(null);

        // Refresh saved phone details.
        apiRequest<AuthUser>("/auth/me")
            .then((authUser) => {
                setPhone(authUser.phone || "");
                setSavedPhone(authUser.phone || "");
                setPhoneVerified(authUser.phone_verified);
            })
            .catch((err) =>
                console.error(
                    "Unable to refresh phone details:",
                    err
                )
            );

        setEditing(false);
        setError("");
        setSuccess("");
    }

    // Send phone verification OTP.
    async function handleSendPhoneOtp() {
        const trimmedPhone = phone.trim();

        if (!trimmedPhone) {
            setError(
                "Enter a phone number before requesting an OTP."
            );
            return;
        }

        setSendingPhoneOtp(true);
        setError("");
        setSuccess("");

        try {
            await apiRequest("/auth/phone/send-otp", {
                method: "POST",
                body: JSON.stringify({
                    phone: trimmedPhone,
                }),
            });

            setPhoneOtpSent(true);
            setPhoneOtp("");
            setPhoneVerified(false);

            setSuccess(
                "Phone verification OTP sent successfully."
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to send phone verification OTP."
            );
        } finally {
            setSendingPhoneOtp(false);
        }
    }

    // Verify phone OTP.
    async function handleVerifyPhoneOtp() {
        const trimmedOtp = phoneOtp.trim();

        if (!/^\d{6}$/.test(trimmedOtp)) {
            setError(
                "Enter the 6-digit phone verification OTP."
            );
            return;
        }

        setVerifyingPhoneOtp(true);
        setError("");
        setSuccess("");

        try {
            await apiRequest("/auth/phone/verify", {
                method: "POST",
                body: JSON.stringify({
                    otp: trimmedOtp,
                }),
            });

            const authUser: AuthUser =
                await apiRequest("/auth/me");

            setPhone(authUser.phone || "");
            setSavedPhone(authUser.phone || "");
            setPhoneVerified(authUser.phone_verified);

            setPhoneOtp("");
            setPhoneOtpSent(false);

            setSuccess(
                "Phone number verified successfully."
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Phone verification failed."
            );
        } finally {
            setVerifyingPhoneOtp(false);
        }
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
                    onClick={() =>
                        router.push("/recruiter/dashboard")
                    }
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
                        <span className="text-blue-500">
                            Hire
                        </span>
                        Swipe
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
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-24 w-24 rounded-full overflow-hidden bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-3xl font-bold text-blue-400">
                                {photoUrl ? (
                                    <img
                                        src={photoUrl}
                                        alt="Profile photo"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    profile.user.name
                                        .charAt(0)
                                        .toUpperCase()
                                )}
                            </div>

                            {/* PHOTO CONTROLS */}
                            <div className="flex flex-col items-center gap-2">
                                <label className="cursor-pointer rounded-lg border border-blue-500 px-3 py-2 text-xs text-blue-400 hover:bg-blue-500/10">
                                    {photoUrl
                                        ? "Change Photo"
                                        : "Upload Photo"}

                                    <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        onChange={(e) => {
                                            handlePhotoSelection(
                                                e.target.files?.[0]
                                            );

                                            e.target.value = "";
                                        }}
                                    />
                                </label>

                                {photoFile && (
                                    <div className="flex flex-col items-center gap-2">
                                        <p className="max-w-40 truncate text-xs text-slate-400">
                                            {photoFile.name}
                                        </p>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handlePhotoUpload}
                                                disabled={photoUploading}
                                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs hover:bg-blue-500 disabled:opacity-50"
                                            >
                                                {photoUploading
                                                    ? "Uploading..."
                                                    : "Save Photo"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPhotoFile(null)
                                                }
                                                disabled={photoUploading}
                                                className="rounded-lg border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800 disabled:opacity-50"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {photoUrl && !photoFile && (
                                    <button
                                        type="button"
                                        onClick={handlePhotoRemove}
                                        disabled={photoRemoving}
                                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                                    >
                                        {photoRemoving
                                            ? "Removing..."
                                            : "Remove Photo"}
                                    </button>
                                )}
                            </div>
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

                            {/* PHONE VERIFICATION */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">
                                    Phone Number
                                </label>

                                {editing ? (
                                    <>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => {
                                                setPhone(e.target.value);
                                                setPhoneVerified(false);
                                                setPhoneOtpSent(false);
                                                setPhoneOtp("");
                                                setError("");
                                                setSuccess("");
                                            }}
                                            placeholder="Enter your phone number"
                                            autoComplete="tel"
                                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                                        />

                                        <div className="mt-3 flex flex-wrap items-center gap-3">
                                            <span
                                                className={`text-xs ${
                                                    phoneVerified
                                                        ? "text-green-400"
                                                        : "text-amber-400"
                                                }`}
                                            >
                                                {phoneVerified
                                                    ? "Verified"
                                                    : "Not verified"}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={handleSendPhoneOtp}
                                                disabled={
                                                    sendingPhoneOtp ||
                                                    !phone.trim()
                                                }
                                                className="rounded-lg border border-blue-500 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/10 disabled:opacity-50"
                                            >
                                                {sendingPhoneOtp
                                                    ? "Sending..."
                                                    : phoneOtpSent
                                                      ? "Resend OTP"
                                                      : "Send OTP"}
                                            </button>
                                        </div>

                                        {phoneOtpSent && (
                                            <div className="mt-3 flex flex-col sm:flex-row gap-3">
                                                <input
                                                    inputMode="numeric"
                                                    autoComplete="one-time-code"
                                                    maxLength={6}
                                                    value={phoneOtp}
                                                    onChange={(e) =>
                                                        setPhoneOtp(
                                                            e.target.value
                                                                .replace(/\D/g, "")
                                                                .slice(0, 6)
                                                        )
                                                    }
                                                    placeholder="Enter 6-digit OTP"
                                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                                                />

                                                <button
                                                    type="button"
                                                    onClick={handleVerifyPhoneOtp}
                                                    disabled={
                                                        verifyingPhoneOtp ||
                                                        phoneOtp.length !== 6
                                                    }
                                                    className="rounded-lg bg-green-600 px-5 py-3 text-sm font-medium hover:bg-green-500 disabled:opacity-50"
                                                >
                                                    {verifyingPhoneOtp
                                                        ? "Verifying..."
                                                        : "Verify Phone"}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="rounded-lg bg-slate-950 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                                        <span>
                                            {phone || "Not provided"}
                                        </span>

                                        <span
                                            className={`text-xs ${
                                                phoneVerified
                                                    ? "text-green-400"
                                                    : "text-amber-400"
                                            }`}
                                        >
                                            {phoneVerified
                                                ? "Verified"
                                                : "Not verified"}
                                        </span>
                                    </div>
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
