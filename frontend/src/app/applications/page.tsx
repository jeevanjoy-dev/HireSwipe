"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";

interface Application {
    id: number;
    candidate_id: number;
    job_id: number;
    status: string;
    applied_at: string;
}

interface ApplicationDetail {
    id: number;
    candidate_id: number;
    job_id: number;
    job_title: string;
    job_location: string | null;
    job_type: string;
    status: string;
    applied_at: string;
}

/**
 * Display the authenticated candidate's job applications.
 */
export default function ApplicationsPage() {
    const [applications, setApplications] = useState<ApplicationDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    /**
     * Load the authenticated candidate's applications.
     */
    async function loadApplications() {
        try {
            setLoading(true);
            setError("");

            const data: Application[] = await apiRequest(
                "/applications/my-applications"
            );

            const detailedApplications = await Promise.all(
                data.map(async (application) => {
                    return await apiRequest(
                        `/applications/${application.id}`
                    );
                })
            );

            setApplications(detailedApplications);
        } catch (error) {
            console.error("Failed to load applications:", error);

            if (error instanceof Error) {
                setError(error.message);
            } else {
                setError("Failed to load applications.");
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadApplications();
    }, []);

    if (loading) {
        return (
            <main>
                <h1>My Applications</h1>
                <p>Loading applications...</p>
            </main>
        );
    }

    return (
        <main>
            <h1>My Applications</h1>

            {error && <p>{error}</p>}

            {!error && applications.length === 0 && (
                <p>You have not applied for any jobs yet.</p>
            )}

            {applications.map((application) => (
                <div key={application.id}>
                    <h2>{application.job_title}</h2>

                    <p>
                        <strong>Location:</strong>{" "}
                        {application.job_location || "Not specified"}
                    </p>

                    <p>
                        <strong>Job Type:</strong>{" "}
                        {application.job_type}
                    </p>

                    <p>
                        <strong>Status:</strong>{" "}
                        {application.status}
                    </p>

                    <p>
                        <strong>Applied:</strong>{" "}
                        {new Date(
                            application.applied_at
                        ).toLocaleDateString()}
                    </p>
                </div>
            ))}
        </main>
    );
}