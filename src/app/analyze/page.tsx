"use client";

import { extractSkillsFromResume } from "@/services/resumeAnalyzer";
import { useState } from "react";
import { useRouter } from "next/navigation";
import JDInput from "@/components/JDInput";
import ResumeUploader from "@/components/ResumeUploader";

export default function AnalyzePage() {
    
    const router = useRouter();

  const [jdText, setJdText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <main>
      <h1 className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>
        Analyze
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        Paste a job description and upload your resume to analyze the match.
      </p>

      <div className="mt-6 space-y-6">
        <JDInput value={jdText} onChange={setJdText} />
        <ResumeUploader file={resumeFile} onChange={setResumeFile} />

        <button
            type="button"
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--button-text)" }}
            disabled={isLoading || jdText.trim().length === 0 || !resumeFile}
            onClick={async () => {
                if (!resumeFile) {
                    setError("Please upload a resume file.");
                    return;
                }

                setError(null);
                setIsLoading(true);

                try {
                    const formData = new FormData();
                    formData.append("jdText", jdText);
                    formData.append("resume", resumeFile);

                    const res = await fetch("/api/analyze", {
                        method: "POST",
                        body: formData,
                    });

                    if (!res.ok) {
                        throw new Error(`API error: ${res.status} ${res.statusText}`);
                    }

                    const data = await res.json();
                    sessionStorage.setItem("jobfit_result", JSON.stringify(data));
                    router.push("/result")
                } catch (err: any) {
                    setError(err.message ?? "An unexpected error occurred.");
                } finally {
                    setIsLoading(false);
                }
            }}
        >  
            {isLoading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      
    </main>
  );
}