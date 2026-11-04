
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../services/api";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface CandidateProfile {
  phone: string | null;
  location: string | null;
  bio: string | null;
  resume: string | null;
}

/**
 * Display and edit the authenticated candidate's profile.
 */
export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);

  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const emailChanged = email.trim().toLowerCase() !== user?.email.toLowerCase();

  useEffect(() => {
    /**
     * Load the authenticated user's information and candidate profile.
     *
     * Returns:
     *     None. Updates the user and profile state.
     */
    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const userData: User = await apiRequest("/auth/me", {
          method: "GET",
        });

        const profileData: CandidateProfile = await apiRequest(
          "/candidate/profile",
          {
            method: "GET",
          }
        );

        setUser(userData);
        setProfile(profileData);

        setEmail(userData.email);
        setPhone(profileData.phone || "");
        setLocation(profileData.location || "");
        setBio(profileData.bio || "");
      } catch (error) {
        console.error("Profile loading error:", error);

        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Failed to load profile.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  /**
   * Save the edited candidate profile and email address.
   *
   * Returns:
   *     None. Updates the user and profile after successful API requests.
   */
  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (emailChanged && !currentPassword) {
        setError("Enter your current password to change your email.");
        return;
      }

      const updatedProfile: CandidateProfile = await apiRequest(
        "/candidate/profile",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: phone || null,
            location: location || null,
            bio: bio || null,
          }),
        }
      );

      setProfile(updatedProfile);
      setPhone(updatedProfile.phone || "");
      setLocation(updatedProfile.location || "");
      setBio(updatedProfile.bio || "");

      if (emailChanged) {
        const updatedUser: User = await apiRequest("/auth/email", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            new_email: email.trim(),
            current_password: currentPassword,
          }),
        });

        setUser(updatedUser);
        setEmail(updatedUser.email);
        setCurrentPassword("");
      }

      setEditing(false);
      setSuccess("Profile updated successfully.");
    } catch (error) {
      console.error("Profile update error:", error);

      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to update profile.");
      }
    } finally {
      setSaving(false);
    }
  }

  /**
   * Cancel profile editing and restore the saved profile values.
   *
   * Returns:
   *     None. Restores the existing profile data.
   */
  function handleCancel() {
    if (profile && user) {
      setEmail(user.email);
      setPhone(profile.phone || "");
      setLocation(profile.location || "");
      setBio(profile.bio || "");
    }

    setCurrentPassword("");
    setEditing(false);
    setError("");
    setSuccess("");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070b1a] px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <p className="text-slate-400">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (!user || !profile) {
    return (
      <main className="min-h-screen bg-[#070b1a] px-6 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
            <p className="text-red-300">
              {error || "Unable to load profile."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b1a] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-8 text-sm font-medium text-blue-400 transition hover:text-blue-300"
        >
          ← Back to Dashboard
        </button>

        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-400">
            HIREsWIPE
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            My Profile
          </h1>

          <p className="mt-2 text-slate-400">
            Manage your personal information and candidate profile.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-500/15 bg-gradient-to-br from-[#111936] to-[#0c1228] p-8 shadow-2xl shadow-black/20">
          <div className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Profile Information
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Keep your information up to date.
              </p>
            </div>

            {!editing && (
              <button
                onClick={() => {
                  setEditing(true);
                  setSuccess("");
                  setError("");
                }}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:from-blue-500 hover:to-indigo-500"
              >
                Edit Profile
              </button>
            )}
          </div>

          {success && (
            <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-black/10 p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Name
              </p>

              <p className="text-lg font-semibold text-white">
                {user.name}
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-black/10 p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
              </label>

              {editing ? (
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />
              ) : (
                <p className="break-all text-lg font-semibold text-white">
                  {user.email}
                </p>
              )}
            </div>

            {editing && emailChanged && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Current Password
                </label>

                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />

                <p className="mt-2 text-xs text-slate-400">
                  Required to verify your identity before changing your email.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-white/5 bg-black/10 p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Phone
              </label>

              {editing ? (
                <input
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Enter your phone number"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />
              ) : (
                <p className="text-lg font-medium text-slate-200">
                  {profile.phone || "Not provided"}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-white/5 bg-black/10 p-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Location
              </label>

              {editing ? (
                <input
                  type="text"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Enter your location"
                  className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />
              ) : (
                <p className="text-lg font-medium text-slate-200">
                  {profile.location || "Not provided"}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-white/5 bg-black/10 p-5 md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bio
              </label>

              {editing ? (
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={6}
                  placeholder="Tell us about yourself"
                  className="w-full resize-none rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />
              ) : (
                <p className="whitespace-pre-line text-base leading-7 text-slate-300">
                  {profile.bio || "Not provided"}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-5 md:col-span-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Resume
              </p>

              <p className="text-base font-medium text-slate-200">
                {profile.resume || "Not uploaded"}
              </p>

              {!profile.resume && (
                <p className="mt-2 text-sm text-slate-500">
                  Your resume will be used later for ATS scoring and
                  candidate-job matching.
                </p>
              )}
            </div>
          </div>

          {editing && (
            <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                onClick={handleCancel}
                disabled={saving}
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
