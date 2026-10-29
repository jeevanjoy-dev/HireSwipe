"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

/**
 * Display the authenticated user's dashboard.
 */
export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    /**
     * Load the authenticated user's information.
     */
    async function loadUser() {
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          router.push("/login");
          return;
        }

        const response = await fetch(
          "http://127.0.0.1:8000/auth/me",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }

        setUser(data);
      } catch (error) {
        console.error("Dashboard loading error:", error);
        setError("Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("access_token");
    router.push("/login");
  }

  if (loading) {
    return <p>Loading dashboard...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <main>
      <h1>HireSwipe</h1>

      <h2>Welcome, {user.name}</h2>

      <p>
        <strong>Email:</strong> {user.email}
      </p>

      <p>
        <strong>Role:</strong> {user.role}
      </p>

      <hr />

      {user.role === "candidate" && (
        <>
          <h2>Candidate</h2>

          <button onClick={() => router.push("/profile")}>
            My Profile
          </button>

          <button onClick={() => router.push("/jobs")}>
            Browse Jobs
          </button>

          <button onClick={() => router.push("/applications")}>
            My Applications
          </button>
        </>
      )}

      {user.role === "recruiter" && (
        <>
          <h2>Recruiter</h2>

          <button onClick={() => router.push("/recruiter/applications")}>
            Applications
          </button>
        </>
      )}

      <br />
      <br />

      <button onClick={handleLogout}>
        Logout
      </button>
    </main>
  );
}