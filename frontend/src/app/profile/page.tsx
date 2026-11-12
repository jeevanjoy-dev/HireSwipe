
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  apiRequest,
  apiFileRequest,
  ApiError,
} from "../../services/api";

interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  phone_verified: boolean;
  role: string;
}

interface CandidateProfile {
  location: string | null;
  bio: string | null;
  resume: string | null;
  resume_filename?: string | null;
  profile_photo?: string | null;
}

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");

  const [editing, setEditing] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoDeleting, setPhotoDeleting] = useState(false);

  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeDeleting, setResumeDeleting] = useState(false);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [resumeFileName, setResumeFileName] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Phone is verified only when the entered number matches
  // the number saved in the authenticated User account.
  const phoneVerified =
    Boolean(user?.phone_verified) &&
    phone.trim() === (user?.phone || "");

  // --------------------------------------------------
  // LOAD USER AND CANDIDATE PROFILE
  // --------------------------------------------------

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const userData: User = await apiRequest("/auth/me", {
          method: "GET",
        });

        // Prevent recruiter/admin accounts from using
        // the candidate profile page.
        if (userData.role !== "candidate") {
          throw new Error(
            "This profile page is available only to candidates."
          );
        }

        let profileData: CandidateProfile;

        try {
          profileData = await apiRequest("/candidate/profile", {
            method: "GET",
          });
        } catch (err) {
          // Automatically create an empty candidate profile
          // if the candidate has not created one yet.
          if (err instanceof ApiError && err.status === 404) {
            profileData = await apiRequest("/candidate/profile", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            });
          } else {
            throw err;
          }
        }

        setUser(userData);
        setProfile(profileData);

        setPhone(userData.phone || "");
        setLocation(profileData.location || "");
        setBio(profileData.bio || "");
        setResumeAvailable(Boolean(profileData.resume));
        setResumeFileName(profileData.resume_filename || "");
      } catch (err) {
        console.error("Profile loading error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load profile."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  // --------------------------------------------------
  // OTP RESEND COUNTDOWN
  // --------------------------------------------------

  useEffect(() => {
    if (resendCountdown <= 0) return;

    const timer = window.setTimeout(() => {
      setResendCountdown((previous) => previous - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  // --------------------------------------------------
  // REFRESH USER INFORMATION
  // --------------------------------------------------

  async function refreshUser() {
    const updatedUser: User = await apiRequest("/auth/me", {
      method: "GET",
    });

    setUser(updatedUser);
    setPhone(updatedUser.phone || "");
  }

  // --------------------------------------------------
  // SEND PHONE OTP
  // --------------------------------------------------

  async function handleSendOtp() {
    try {
      setSendingOtp(true);
      setError("");
      setSuccess("");

      const enteredPhone = phone.trim();

      if (!/^\+?[0-9]{10,15}$/.test(enteredPhone)) {
        setError(
          "Enter a valid phone number with 10 to 15 digits, including your country code."
        );
        return;
      }

      await apiRequest("/auth/phone/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: enteredPhone,
        }),
      });

      setOtp("");
      setOtpSent(true);
      setResendCountdown(60);

      setSuccess(
        "OTP sent successfully. Check your SMS for the verification code."
      );
    } catch (err) {
      console.error("Phone OTP sending error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not send phone OTP."
      );
    } finally {
      setSendingOtp(false);
    }
  }

  // --------------------------------------------------
  // VERIFY PHONE OTP
  // --------------------------------------------------

  async function handleVerifyOtp() {
    try {
      setVerifyingOtp(true);
      setError("");
      setSuccess("");

      if (!/^\d{6}$/.test(otp)) {
        setError("Enter the six-digit OTP.");
        return;
      }

      await apiRequest("/auth/phone/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          otp,
        }),
      });

      await refreshUser();

      setOtp("");
      setOtpSent(false);
      setResendCountdown(0);

      setSuccess(
        "Your phone number has been verified successfully."
      );
    } catch (err) {
      console.error("Phone verification error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Phone verification failed."
      );
    } finally {
      setVerifyingOtp(false);
    }
  }

  // --------------------------------------------------
  // LOAD PROFILE PHOTO
  // --------------------------------------------------

  async function loadProfilePhoto() {
    try {
      const blob = await apiFileRequest(
        "/candidate/profile/photo"
      );

      const nextUrl = URL.createObjectURL(blob);

      setPhotoUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        console.error("Profile photo loading error:", err);
      }

      setPhotoUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
    }
  }

  // --------------------------------------------------
  // REFRESH PHOTO WHEN PROFILE LOADS
  // --------------------------------------------------

  useEffect(() => {
    if (user && profile) {
      setResumeAvailable(Boolean(profile.resume));
      void loadProfilePhoto();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.profile_photo]);

  // --------------------------------------------------
  // CLEAN UP PHOTO OBJECT URL
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  // --------------------------------------------------
  // UPLOAD PROFILE PHOTO
  // --------------------------------------------------

  async function handlePhotoUpload(file?: File) {
    if (!file) return;

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Please choose a JPG, PNG, or WEBP image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Profile photo must be 2 MB or smaller.");
      return;
    }

    try {
      setPhotoUploading(true);
      setError("");
      setSuccess("");

      const data = new FormData();
      data.append("file", file);

      await apiRequest("/candidate/profile/photo", {
        method: "POST",
        body: data,
      });

      await loadProfilePhoto();

      setSuccess("Profile photo uploaded successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Photo upload failed."
      );
    } finally {
      setPhotoUploading(false);
    }
  }

  // --------------------------------------------------
  // DELETE PROFILE PHOTO
  // --------------------------------------------------

  async function handlePhotoDelete() {
    try {
      setPhotoDeleting(true);
      setError("");
      setSuccess("");

      await apiRequest("/candidate/profile/photo", {
        method: "DELETE",
      });

      setPhotoUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });

      setSuccess("Profile photo removed.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Photo deletion failed."
      );
    } finally {
      setPhotoDeleting(false);
    }
  }

  // --------------------------------------------------
  // UPLOAD RESUME
  // --------------------------------------------------

  async function handleResumeUpload(file?: File) {
    if (!file) return;

    const validMime = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (
      !validMime.includes(file.type) ||
      !/\.(pdf|docx)$/i.test(file.name)
    ) {
      setError("Please choose a PDF or DOCX resume.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Resume must be 5 MB or smaller.");
      return;
    }

    try {
      setResumeUploading(true);
      setError("");
      setSuccess("");

      const data = new FormData();
      data.append("file", file);

      const result = await apiRequest<CandidateProfile>(
        "/candidate/profile/resume",
        {
          method: "POST",
          body: data,
        }
      );

      if (result && typeof result === "object") {
        setProfile((previous) =>
          previous ? { ...previous, ...result } : previous
        );
      }

      setResumeAvailable(true);
      setResumeFileName(result.resume_filename || file.name);

      setSuccess("Resume uploaded successfully.");

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Resume upload failed."
      );
    } finally {
      setResumeUploading(false);
    }
  }

  // --------------------------------------------------
  // DOWNLOAD RESUME
  // --------------------------------------------------

  async function handleResumeDownload() {
    try {
      setError("");

      const blob = await apiFileRequest(
        "/candidate/profile/resume"
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;

      link.download = blob.type.includes("pdf")
        ? "HireSwipe_Resume.pdf"
        : "HireSwipe_Resume.docx";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to download resume."
      );
    }
  }

  // --------------------------------------------------
  // DELETE RESUME
  // --------------------------------------------------

  async function handleResumeDelete() {
    try {
      setResumeDeleting(true);
      setError("");
      setSuccess("");

      await apiRequest("/candidate/profile/resume", {
        method: "DELETE",
      });

      setResumeAvailable(false);
      setResumeFileName("");


      setProfile((previous) =>
        previous
          ? { ...previous, resume: null,  resume_filename: null,}
          : previous
      );

      setSuccess("Resume removed successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Resume deletion failed."
      );
    } finally {
      setResumeDeleting(false);
    }
  }

  // --------------------------------------------------
  // SAVE PROFILE
  // --------------------------------------------------

  async function handleSaveProfile() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const updatedProfile: CandidateProfile = await apiRequest(
        "/candidate/profile",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            location,
            bio,
          }),
        }
      );

      setProfile(updatedProfile);
      setLocation(updatedProfile.location || "");
      setBio(updatedProfile.bio || "");
      setEditing(false);

      setSuccess("Profile updated successfully.");
    } catch (err) {
      console.error("Profile update error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update profile."
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // CANCEL PROFILE EDITING
  // --------------------------------------------------

  function handleCancelEdit() {
    setLocation(profile?.location || "");
    setBio(profile?.bio || "");
    setEditing(false);
    setError("");
    setSuccess("");
  }

  // --------------------------------------------------
  // LOADING SCREEN
  // --------------------------------------------------

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070b1a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your profile...</p>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // MAIN PROFILE PAGE
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-[#070b1a] text-white px-4 py-8 sm:px-6 lg:px-10">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              My Profile
            </h1>

            <p className="text-gray-400 mt-2">
              Manage your personal information and professional details.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="px-5 py-2.5 rounded-xl border border-gray-700 hover:bg-gray-800 transition"
          >
            Back to Dashboard
          </button>
        </div>

        {/* ERROR AND SUCCESS MESSAGES */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-300">
            {success}
          </div>
        )}

        {/* PROFILE PHOTO AND BASIC INFORMATION */}

        <section className="bg-[#11182b] border border-gray-800 rounded-2xl p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">

            {/* PROFILE PHOTO */}

            <div className="flex flex-col items-center">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-blue-500/40 bg-gray-800 flex items-center justify-center">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Candidate profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-5xl text-gray-500">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <label className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition">
                  {photoUploading
                    ? "Uploading..."
                    : photoUrl
                      ? "Change Photo"
                      : "Upload Photo"}

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={photoUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void handlePhotoUpload(file);
                      event.target.value = "";
                    }}
                  />
                </label>

                {photoUrl && (
                  <button
                    onClick={handlePhotoDelete}
                    disabled={photoDeleting}
                    className="px-4 py-2 bg-red-600/20 text-red-300 hover:bg-red-600/30 rounded-lg text-sm transition disabled:opacity-50"
                  >
                    {photoDeleting ? "Removing..." : "Remove"}
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-500 mt-2">
                JPG, PNG or WEBP · Maximum 2 MB
              </p>
            </div>

            {/* BASIC INFORMATION */}

            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold">
                {user?.name}
              </h2>

              <p className="text-gray-400 mt-2">
                {user?.email}
              </p>

              <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-2">
                <span className="px-3 py-1 rounded-full text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  Candidate
                </span>

                {phoneVerified ? (
                  <span className="px-3 py-1 rounded-full text-xs bg-green-500/10 text-green-300 border border-green-500/20">
                    Phone Verified
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
                    Phone Not Verified
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* PERSONAL INFORMATION */}

        <section className="bg-[#11182b] border border-gray-800 rounded-2xl p-6 sm:p-8 mb-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold">
                Personal Information
              </h2>

              <p className="text-gray-400 text-sm mt-1">
                Your account and contact details.
              </p>
            </div>

            {!editing && (
              <button
                onClick={() => {
                  setEditing(true);
                  setError("");
                  setSuccess("");
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition"
              >
                Edit Profile
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* NAME */}

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Full Name
              </label>

              <div className="bg-[#0b1120] border border-gray-800 rounded-xl px-4 py-3 text-gray-200">
                {user?.name || "Not available"}
              </div>
            </div>

            {/* EMAIL */}

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Email Address
              </label>

              <div className="bg-[#0b1120] border border-gray-800 rounded-xl px-4 py-3 text-gray-200 break-all">
                {user?.email || "Not available"}
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Your login email is managed through account verification.
              </p>
            </div>

            {/* PHONE */}

            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-2">
                Phone Number
              </label>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setOtpSent(false);
                    setOtp("");
                  }}
                  placeholder="+919876543210"
                  className="flex-1 bg-[#0b1120] border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500"
                />

                {!phoneVerified && (
                  <button
                    onClick={handleSendOtp}
                    disabled={sendingOtp || resendCountdown > 0}
                    className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-medium transition disabled:opacity-50"
                  >
                    {sendingOtp
                      ? "Sending..."
                      : resendCountdown > 0
                        ? `Resend in ${resendCountdown}s`
                        : otpSent
                          ? "Resend OTP"
                          : "Verify Phone"}
                  </button>
                )}

                {phoneVerified && (
                  <div className="px-5 py-3 rounded-xl bg-green-500/10 text-green-300 border border-green-500/20 text-center">
                    Verified
                  </div>
                )}
              </div>

              {otpSent && !phoneVerified && (
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, ""))
                    }
                    placeholder="Enter 6-digit OTP"
                    className="flex-1 bg-[#0b1120] border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500"
                  />

                  <button
                    onClick={handleVerifyOtp}
                    disabled={verifyingOtp}
                    className="px-5 py-3 rounded-xl bg-green-600 hover:bg-green-700 font-medium transition disabled:opacity-50"
                  >
                    {verifyingOtp ? "Verifying..." : "Verify OTP"}
                  </button>
                </div>
              )}

              {!phoneVerified && (
                <p className="text-xs text-gray-500 mt-2">
                  Enter your phone number and verify it using the OTP.
                </p>
              )}
            </div>

            {/* LOCATION */}

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Location
              </label>

              {editing ? (
                <input
                  type="text"
                  value={location}
                  onChange={(event) =>
                    setLocation(event.target.value)
                  }
                  placeholder="Enter your location"
                  className="w-full bg-[#0b1120] border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500"
                />
              ) : (
                <div className="bg-[#0b1120] border border-gray-800 rounded-xl px-4 py-3 text-gray-200">
                  {profile?.location || "Not provided"}
                </div>
              )}
            </div>

            {/* ROLE */}

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Account Type
              </label>

              <div className="bg-[#0b1120] border border-gray-800 rounded-xl px-4 py-3 text-gray-200">
                Candidate
              </div>
            </div>

            {/* BIO */}

            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-2">
                About Yourself
              </label>

              {editing ? (
                <textarea
                  value={bio}
                  onChange={(event) =>
                    setBio(event.target.value)
                  }
                  rows={5}
                  placeholder="Tell recruiters about yourself, your skills and your career goals..."
                  className="w-full bg-[#0b1120] border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 resize-y"
                />
              ) : (
                <div className="bg-[#0b1120] border border-gray-800 rounded-xl px-4 py-4 text-gray-200 whitespace-pre-wrap min-h-24">
                  {profile?.bio || "No bio added yet."}
                </div>
              )}
            </div>
          </div>

          {/* SAVE AND CANCEL */}

          {editing && (
            <div className="flex flex-wrap justify-end gap-3 mt-6">
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl border border-gray-700 hover:bg-gray-800 transition disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-medium transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </section>

       {/* RESUME SECTION */}

        <section className="bg-[#11182b] border border-gray-800 rounded-2xl p-6 sm:p-8 mb-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              My Resume
            </h2>

            <p className="text-gray-400 text-sm mt-1">
              Upload your resume so recruiters can review your professional experience.
            </p>
          </div>

          <div className="bg-[#0b1120] border border-gray-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 text-2xl">
                  📄
                </div>

                <div>
                  <h3 className="font-medium">
                    {resumeAvailable
                      ? resumeFileName || "Uploaded resume"
                      : "No resume uploaded"}
                  </h3>

                  <p className="text-sm text-gray-500 mt-1">
                    PDF or DOCX · Maximum 5 MB
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">

                {/* UPLOAD RESUME */}

                <label className="cursor-pointer px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition">
                  {resumeUploading ? "Uploading..." : "Upload Resume"}

                  <input
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    disabled={resumeUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void handleResumeUpload(file);
                      event.target.value = "";
                    }}
                  />
                </label>

                {/* REMOVE RESUME */}

                {resumeAvailable && (
                  <button
                    onClick={handleResumeDelete}
                    disabled={resumeDeleting}
                    className="px-4 py-2 rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30 text-sm transition disabled:opacity-50"
                  >
                    {resumeDeleting ? "Removing..." : "Remove Resume"}
                  </button>
                )}

              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Your profile resume is used for recruiter review and candidate-job matching.
          </p>
        </section>

        {/* PROFILE COMPLETION INFORMATION */}

        <section className="bg-[#11182b] border border-gray-800 rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-semibold mb-3">
            Profile Tips
          </h2>

          <p className="text-gray-400 text-sm leading-relaxed">
            Keep your profile information up to date. Add a professional
            profile photo, verify your phone number, complete your bio,
            and upload your latest resume to help recruiters understand
            your qualifications.
          </p>
        </section>

        {/* FOOTER */}

        <div className="text-center text-gray-600 text-xs mt-8">
          HireSwipe · Candidate Profile
        </div>
      </div>
    </main>
  );
}
