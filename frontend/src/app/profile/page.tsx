"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";

type CandidateProfile = {
  id: number;
  user_id: number;
  phone: string | null;
  location: string | null;
  bio: string | null;
  resume: string | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await apiRequest("/candidate/profile", {
          method: "GET",
        });

        setProfile(data);
      } catch (error) {
        console.error("Profile loading error:", error);
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return <p>Loading profile...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!profile) {
    return <p>No profile found.</p>;
  }

  return (
    <div>
      <h1>My Profile</h1>

      <p>Phone: {profile.phone || "Not provided"}</p>

      <p>Location: {profile.location || "Not provided"}</p>

      <p>Bio: {profile.bio || "Not provided"}</p>

      <p>Resume: {profile.resume || "Not uploaded"}</p>
    </div>
  );
}