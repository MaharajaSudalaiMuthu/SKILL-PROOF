import { useState, useEffect, useCallback } from "react";
import {
  GitBranch,
  Play,
  RefreshCw,
  FolderGit2,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  UploadCloud,
  Lock,
  FileCode,
  Archive,
} from "lucide-react";
import { RepositorySummary, GitHubRepoItem, AnalysisJobSummary, FileAttributionSummary } from "@skillproof/shared";
import { RepositoryQuizModal } from "./RepositoryQuizModal.js";

interface RepositoriesViewProps {
  onNotify?: (msg: string) => void;
}

export function RepositoriesView({ onNotify }: RepositoriesViewProps) {
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"github" | "zip" | "samples">("github");
  
  // Custom GitHub input
  const [customRepoInput, setCustomRepoInput] = useState("");
  const [customPatToken, setCustomPatToken] = useState("");
  
  // ZIP upload
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null);
  const [uploadingZip, setUploadingZip] = useState(false);

  // GitHub user repos
  const [githubRepos, setGithubRepos] = useState<GitHubRepoItem[]>([]);
  const [githubLoading, setGithubLoading] = useState(false);

  const [analyzingRepoId, setAnalyzingRepoId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<AnalysisJobSummary | null>(null);
  const [expandedRepoId, setExpandedRepoId] = useState<string | null>(null);
  const [attributions, setAttributions] = useState<FileAttributionSummary[]>([]);
  const [attributionsLoading, setAttributionsLoading] = useState(false);
  const [quizModalRepo, setQuizModalRepo] = useState<{ id: string; name: string } | null>(null);

  const fetchRepositories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/repositories");
      if (res.ok) {
        const data = await res.json();
        setRepositories(data.repositories);
      }
    } catch (err) {
      console.error("Failed to fetch repositories:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  // Poll active analysis job
  useEffect(() => {
    if (!activeJob || activeJob.status === "SUCCEEDED" || activeJob.status === "FAILED") {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/analysis/${activeJob.id}`);
        if (res.ok) {
          const updated: AnalysisJobSummary = await res.json();
          setActiveJob(updated);
          if (updated.status === "SUCCEEDED" || updated.status === "FAILED") {
            fetchRepositories();
            setAnalyzingRepoId(null);
            if (onNotify) {
              onNotify(
                updated.status === "SUCCEEDED"
                  ? `Analysis completed: ${updated.filesAnalyzed} files inspected (${updated.confirmedLines} lines confirmed).`
                  : `Analysis failed: ${updated.errorMessage || "Unknown error"}`
              );
            }
          }
        }
      } catch (err) {
        console.error("Failed to poll analysis job:", err);
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [activeJob, fetchRepositories, onNotify]);

  const openImportModal = async () => {
    setImportModalOpen(true);
    setGithubLoading(true);
    try {
      const res = await fetch("/api/repositories/github");
      if (res.ok) {
        const data = await res.json();
        setGithubRepos(data.repositories);
      }
    } catch (err) {
      console.error("Failed to fetch GitHub repos:", err);
    } finally {
      setGithubLoading(false);
    }
  };

  const handleSelectRepo = async (repo: GitHubRepoItem) => {
    try {
      const res = await fetch("/api/repositories/select", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SkillProof-Request": "true",
        },
        body: JSON.stringify({
          githubRepoId: repo.id,
          fullName: repo.fullName,
          cloneUrl: repo.cloneUrl,
          isFork: repo.isFork,
          defaultBranch: repo.defaultBranch,
          sourceType: "GITHUB",
        }),
      });

      if (res.ok) {
        setImportModalOpen(false);
        await fetchRepositories();
        if (onNotify) {
          onNotify(`Repository "${repo.fullName}" selected. Click "Run Analysis" to inspect.`);
        }
      } else {
        const err = await res.json();
        alert(err.message || "Failed to select repository");
      }
    } catch (err) {
      console.error("Failed to select repository:", err);
    }
  };

  const handleImportCustomGithub = async () => {
    const raw = customRepoInput.trim();
    if (!raw) {
      alert("Please enter a GitHub repository URL or owner/repo format (e.g. expressjs/express or https://github.com/expressjs/express).");
      return;
    }

    const norm = raw
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\.git$/i, "")
      .replace(/\/$/, "");

    const isPrivate = customPatToken.trim().length > 0;

    try {
      const res = await fetch("/api/repositories/select", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SkillProof-Request": "true",
        },
        body: JSON.stringify({
          fullName: norm,
          cloneUrl: `https://github.com/${norm}.git`,
          isFork: false,
          defaultBranch: "main",
          sourceType: "GITHUB",
          isPrivate,
          accessToken: isPrivate ? customPatToken.trim() : undefined,
        }),
      });

      if (res.ok) {
        setImportModalOpen(false);
        setCustomRepoInput("");
        setCustomPatToken("");
        await fetchRepositories();
        if (onNotify) {
          onNotify(`Repository "${norm}" added. Click "Run Analysis" to inspect source code.`);
        }
      } else {
        const err = await res.json();
        alert(err.message || "Failed to import repository");
      }
    } catch (err) {
      console.error("Failed to import custom repository:", err);
    }
  };

  const handleUploadZip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZipFile) {
      alert("Please select a .zip project file to upload.");
      return;
    }

    setUploadingZip(true);
    try {
      const formData = new FormData();
      formData.append("projectZip", selectedZipFile);

      const res = await fetch("/api/repositories/upload-zip", {
        method: "POST",
        headers: {
          "X-SkillProof-Request": "true",
        },
        body: formData,
      });

      if (res.ok) {
        setImportModalOpen(false);
        setSelectedZipFile(null);
        await fetchRepositories();
        if (onNotify) {
          onNotify("Project ZIP archive uploaded successfully. Click \"Run Analysis\" to inspect code.");
        }
      } else {
        const err = await res.json();
        alert(err.message || "Failed to upload project ZIP");
      }
    } catch (err) {
      console.error("Failed to upload ZIP:", err);
      alert("Network error uploading ZIP archive");
    } finally {
      setUploadingZip(false);
    }
  };

  const handleStartAnalysis = async (repoId: string) => {
    setAnalyzingRepoId(repoId);
    try {
      const res = await fetch(`/api/repositories/${repoId}/analyze`, {
        method: "POST",
        headers: {
          "X-SkillProof-Request": "true",
        },
      });

      if (res.ok) {
        const data = await res.json();
        setActiveJob({
          id: data.jobId,
          repositoryId: repoId,
          userId: "",
          status: data.status,
          progressPercent: 0,
          stage: "QUEUED",
          errorMessage: null,
          filesAnalyzed: 0,
          totalLines: 0,
          confirmedLines: 0,
          startedAt: null,
          completedAt: null,
          createdAt: new Date().toISOString(),
        });
      } else {
        const err = await res.json();
        alert(err.message || "Failed to start analysis");
        setAnalyzingRepoId(null);
      }
    } catch (err) {
      console.error("Failed to trigger analysis:", err);
      setAnalyzingRepoId(null);
    }
  };

  const toggleAttributions = async (repoId: string) => {
    if (expandedRepoId === repoId) {
      setExpandedRepoId(null);
      setAttributions([]);
      return;
    }

    setExpandedRepoId(repoId);
    setAttributionsLoading(true);
    try {
      const res = await fetch(`/api/repositories/${repoId}/attributions`);
      if (res.ok) {
        const data = await res.json();
        setAttributions(data.attributions);
      }
    } catch (err) {
      console.error("Failed to fetch attributions:", err);
    } finally {
      setAttributionsLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="page-title">
            Project Repositories & Submissions
          </h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Submit public or private GitHub repositories, or upload complete ZIP projects for recursive source inspection and verified adaptive assessment.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            className="btn btn-secondary"
            onClick={fetchRepositories}
            title="Refresh repository list"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={openImportModal}>
            <FolderGit2 size={15} /> Add / Upload Project
          </button>
        </div>
      </div>

      {/* Active Job Progress Banner */}
      {activeJob && (
        <div
          className="card"
          style={{
            border: "1px solid var(--color-primary-border)",
            backgroundColor: "var(--color-primary-light)",
            marginBottom: "1.5rem",
            padding: "1rem 1.25rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Clock size={16} color="var(--color-primary)" />
              <strong style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>Inspecting Project Code:</strong>
              <span className="badge badge-info">
                {activeJob.stage}
              </span>
            </div>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-primary)" }}>{activeJob.progressPercent}%</span>
          </div>

          <div
            style={{
              width: "100%",
              height: "6px",
              backgroundColor: "rgba(79, 70, 229, 0.15)",
              borderRadius: "9999px",
              overflow: "hidden",
              marginBottom: "0.5rem",
            }}
          >
            <div
              style={{
                width: `${activeJob.progressPercent}%`,
                height: "100%",
                backgroundColor: "var(--color-primary)",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {activeJob.errorMessage && (
            <div style={{ color: "var(--color-danger)", fontSize: "0.8125rem", marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "4px" }}>
              <AlertCircle size={14} />
              <span>{activeJob.errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Repositories List */}
      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          <RefreshCw size={24} className="spin" style={{ margin: "0 auto 0.75rem", color: "var(--color-primary)" }} />
          <div>Scanning registered repositories...</div>
        </div>
      ) : repositories.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3.5rem 1.5rem" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", border: "1px solid var(--border-color)" }}>
            <FolderGit2 size={28} color="var(--color-primary)" />
          </div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
            No Projects Submitted Yet
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", maxWidth: "460px", margin: "0 auto 1.5rem" }}>
            Connect any public or private GitHub repository, or upload your complete project ZIP archive to generate verified adaptive assessments grounded in your code.
          </p>
          <button className="btn btn-primary" onClick={openImportModal}>
            <FolderGit2 size={15} /> Add / Upload Project
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {repositories.map((repo) => (
            <div key={repo.id} className="card" style={{ marginBottom: 0, padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {repo.sourceType === "ZIP_UPLOAD" ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        <Archive size={17} color="var(--color-primary)" />
                        {repo.fullName}
                      </span>
                    ) : (
                      <>
                        <a
                          href={`https://github.com/${repo.fullName}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--color-primary)" }}
                        >
                          {repo.fullName}
                        </a>
                        <ExternalLink size={13} color="var(--text-muted)" />
                      </>
                    )}

                    {repo.sourceType === "ZIP_UPLOAD" ? (
                      <span className="badge badge-info" style={{ fontSize: "0.6875rem" }}>
                        ZIP Archive
                      </span>
                    ) : repo.isPrivate ? (
                      <span className="badge badge-warning" style={{ fontSize: "0.6875rem", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <Lock size={10} /> Private
                      </span>
                    ) : repo.isFork ? (
                      <span className="badge badge-warning" style={{ fontSize: "0.6875rem" }}>
                        Fork
                      </span>
                    ) : (
                      <span className="badge badge-neutral" style={{ fontSize: "0.6875rem" }}>
                        Public
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.35rem", fontSize: "0.8125rem", color: "var(--text-secondary)", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#4F46E5" }} />
                      {repo.detectedLanguages && repo.detectedLanguages.length > 0
                        ? repo.detectedLanguages.slice(0, 3).join(", ")
                        : "Source Project"}
                    </span>

                    {repo.detectedFrameworks && repo.detectedFrameworks.length > 0 && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <FileCode size={13} color="var(--text-muted)" />
                        {repo.detectedFrameworks.slice(0, 3).join(" • ")}
                      </span>
                    )}

                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <GitBranch size={13} color="var(--text-muted)" />
                      <code>{repo.defaultBranch}</code>
                    </span>

                    <span>
                      Last Analyzed:{" "}
                      {repo.lastAnalyzedAt ? new Date(repo.lastAnalyzedAt).toLocaleString() : "Never"}
                    </span>

                    {repo.lastJobStatus && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        Status:{" "}
                        <span
                          className={`badge ${
                            repo.lastJobStatus === "SUCCEEDED"
                              ? "badge-success"
                              : repo.lastJobStatus === "FAILED"
                              ? "badge-danger"
                              : "badge-warning"
                          }`}
                        >
                          {repo.lastJobStatus}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {repo.lastJobStatus === "SUCCEEDED" && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setQuizModalRepo({ id: repo.id, name: repo.fullName })}
                      style={{
                        borderColor: "#4F46E5",
                        color: "#4F46E5",
                        fontWeight: 600,
                        backgroundColor: "rgba(79, 70, 229, 0.04)",
                      }}
                      title="Test your understanding of the source code in this project"
                    >
                      <HelpCircle size={13} color="#4F46E5" />
                      <span>Start Repository Quiz</span>
                    </button>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleStartAnalysis(repo.id)}
                    disabled={analyzingRepoId === repo.id || activeJob?.status === "RUNNING"}
                  >
                    <Play size={12} />
                    <span>{analyzingRepoId === repo.id ? "Starting..." : "Run Analysis"}</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => toggleAttributions(repo.id)}
                  >
                    {expandedRepoId === repo.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    <span>Attributions</span>
                  </button>
                </div>
              </div>

              {/* Attributions Breakdown Accordion */}
              {expandedRepoId === repo.id && (
                <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
                  <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    Attributed Source Files (Line-Level Verification Breakdown)
                  </h4>
                  {attributionsLoading ? (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem", padding: "1rem 0" }}>
                      <RefreshCw size={14} className="spin" style={{ display: "inline", marginRight: "6px" }} />
                      Loading attribution records from project...
                    </div>
                  ) : attributions.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem", padding: "0.5rem 0" }}>
                      No attribution records found. Click &apos;Run Analysis&apos; above to inspect source files.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {attributions.map((attr, idx) => (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: "var(--bg-subtle)",
                            padding: "0.65rem 0.875rem",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-color)",
                            fontSize: "0.8125rem",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                            <code className="code-tag" style={{ color: "var(--color-primary)" }}>{attr.filePath}</code>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total: {attr.totalLines} lines</span>
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
                            <span className="badge badge-success">
                              Confirmed: {attr.confirmedLines} lines
                            </span>
                            {attr.otherLines > 0 && (
                              <span className="badge badge-danger">
                                Other: {attr.otherLines} lines
                              </span>
                            )}
                            {attr.uncertainLines > 0 && (
                              <span className="badge badge-warning">
                                Uncertain: {attr.uncertainLines} lines
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Repository / Project Import Modal */}
      {importModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: "600px" }}>
            <div className="modal-header">
              <div>
                <h3 className="card-title" style={{ fontSize: "1.125rem" }}>Submit Project for Assessment</h3>
                <p className="card-subtitle">Support arbitrary GitHub repositories (public or private) or upload a complete ZIP project</p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setImportModalOpen(false)}
                style={{ padding: "0.25rem 0.5rem" }}
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", padding: "0 1.25rem", gap: "1rem" }}>
              <button
                style={{
                  padding: "0.75rem 0.5rem",
                  background: "none",
                  border: "none",
                  borderBottom: modalTab === "github" ? "2px solid var(--color-primary)" : "2px solid transparent",
                  fontWeight: modalTab === "github" ? 600 : 400,
                  color: modalTab === "github" ? "var(--color-primary)" : "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
                onClick={() => setModalTab("github")}
              >
                GitHub Repository URL
              </button>
              <button
                style={{
                  padding: "0.75rem 0.5rem",
                  background: "none",
                  border: "none",
                  borderBottom: modalTab === "zip" ? "2px solid var(--color-primary)" : "2px solid transparent",
                  fontWeight: modalTab === "zip" ? 600 : 400,
                  color: modalTab === "zip" ? "var(--color-primary)" : "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
                onClick={() => setModalTab("zip")}
              >
                Upload Project ZIP
              </button>
              <button
                style={{
                  padding: "0.75rem 0.5rem",
                  background: "none",
                  border: "none",
                  borderBottom: modalTab === "samples" ? "2px solid var(--color-primary)" : "2px solid transparent",
                  fontWeight: modalTab === "samples" ? 600 : 400,
                  color: modalTab === "samples" ? "var(--color-primary)" : "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
                onClick={() => setModalTab("samples")}
              >
                Sample Projects
              </button>
            </div>

            <div className="modal-body" style={{ padding: "1.25rem" }}>
              {/* TAB 1: Arbitrary GitHub URL / Private Repo */}
              {modalTab === "github" && (
                <div>
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-primary)" }}>
                      GitHub Repository URL or owner/repo
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. expressjs/express or https://github.com/pallets/flask"
                      value={customRepoInput}
                      onChange={(e) => setCustomRepoInput(e.target.value)}
                    />
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                      Supports any public GitHub repository across all languages (TypeScript, Python, Java, Go, etc.)
                    </div>
                  </div>

                  <div style={{ marginBottom: "1.25rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-primary)" }}>
                      <Lock size={12} /> Personal Access Token (Optional — for Private Repositories)
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (optional)"
                      value={customPatToken}
                      onChange={(e) => setCustomPatToken(e.target.value)}
                    />
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                      Leave blank for public repositories. Required only if this repository is private.
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={handleImportCustomGithub}
                    disabled={!customRepoInput.trim()}
                  >
                    <CheckCircle size={15} /> Import & Select Repository
                  </button>
                </div>
              )}

              {/* TAB 2: Upload Project ZIP */}
              {modalTab === "zip" && (
                <form onSubmit={handleUploadZip}>
                  <div
                    style={{
                      border: "2px dashed var(--border-color)",
                      borderRadius: "var(--radius-md)",
                      padding: "2rem 1.5rem",
                      textAlign: "center",
                      backgroundColor: "var(--bg-subtle)",
                      marginBottom: "1rem",
                    }}
                  >
                    <UploadCloud size={36} color="var(--color-primary)" style={{ margin: "0 auto 0.75rem" }} />
                    <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                      {selectedZipFile ? selectedZipFile.name : "Select or Drop Project ZIP Archive"}
                    </h4>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                      {selectedZipFile
                        ? `${Math.round(selectedZipFile.size / 1024)} KB selected`
                        : "Upload a complete student project archive (.zip) up to 100MB"}
                    </p>
                    <input
                      type="file"
                      id="zipFileInput"
                      accept=".zip"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedZipFile(e.target.files[0]);
                        }
                      }}
                    />
                    <label htmlFor="zipFileInput" className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
                      Choose .zip File
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                    disabled={!selectedZipFile || uploadingZip}
                  >
                    {uploadingZip ? (
                      <>
                        <RefreshCw size={14} className="spin" /> Uploading & Validating ZIP...
                      </>
                    ) : (
                      <>
                        <UploadCloud size={15} /> Upload Project Archive
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* TAB 3: Sample Projects */}
              {modalTab === "samples" && (
                <div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
                    Quick-start with one of the reference repositories across different frameworks:
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto" }}>
                    {githubLoading ? (
                      <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-muted)" }}>
                        <RefreshCw size={16} className="spin" style={{ margin: "0 auto 0.5rem" }} />
                        Loading sample repositories...
                      </div>
                    ) : (
                      githubRepos.map((r) => (
                        <div
                          key={r.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.65rem 0.875rem",
                            borderRadius: "var(--radius-md)",
                            backgroundColor: "var(--bg-subtle)",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{r.fullName}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{r.description || "Reference project"}</div>
                          </div>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSelectRepo(r)}
                          >
                            <CheckCircle size={12} /> Select
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setImportModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repository Knowledge Assessment Modal */}
      {quizModalRepo && (
        <RepositoryQuizModal
          repositoryId={quizModalRepo.id}
          repositoryName={quizModalRepo.name}
          isOpen={true}
          onClose={() => setQuizModalRepo(null)}
          onCompleted={(res) => {
            if (onNotify) {
              onNotify(`Assessment completed for ${quizModalRepo.name}: ${res.score}% (${res.correctCount}/${res.totalQuestions} correct) - ${res.passed ? "PASSED" : "NEEDS REVIEW"}`);
            }
          }}
        />
      )}
    </div>
  );
}
