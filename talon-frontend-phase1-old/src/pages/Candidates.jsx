import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJSON } from "../api/apiClient.js";
import { useApiResource } from "../api/useApiResource.js";
import AppFrame from "../components/AppFrame.jsx";
import Avatar from "../components/Avatar.jsx";
import Badge from "../components/Badge.jsx";
import PageState from "../components/PageState.jsx";
import { SearchIcon, UploadIcon } from "../components/icons.jsx";
import "./Candidates.css";

const STAGE_TONE = {
  applied: "neutral",
  screen: "info",
  onsite: "warning",
  offer: "success",
  hired: "success",
  rejected: "danger",
};

const CSV_TEMPLATE = "name,email,phone,location,current_title,current_company,source,job_code";
const CSV_SAMPLE = `${CSV_TEMPLATE}\nJane Doe,jane@example.com,555-0100,Austin,Frontend Engineer,Acme,Referral,ENG-204`;

export default function Candidates() {
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useApiResource(`/candidates${reloadKey ? `?v=${reloadKey}` : ""}`);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState(null);

  const candidates = data?.candidates || [];
  const filters = data?.filters || [];
  const normalizedQuery = query.trim().toLowerCase();

  const filteredCandidates = useMemo(
    () =>
      candidates.filter((candidate) => {
        const stageMatches = stageFilter === "All" || candidate.stage === stageFilter;
        const textMatches =
          !normalizedQuery ||
          [
            candidate.name,
            candidate.email,
            candidate.headline,
            candidate.jobTitle,
            candidate.department,
            candidate.source,
            candidate.location,
          ]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedQuery));

        return stageMatches && textMatches;
      }),
    [candidates, normalizedQuery, stageFilter]
  );

  function openImport() {
    setImportOpen(true);
    setImportError("");
    setImportResult(null);
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError("");
    setImportResult(null);
    try {
      setCsvText(await file.text());
    } catch (err) {
      setImportError("Couldn't read this CSV file.");
    }
  }

  async function handleImportSubmit(event) {
    event.preventDefault();
    if (!csvText.trim()) {
      setImportError("Choose a CSV file or paste CSV text.");
      return;
    }

    setImporting(true);
    setImportError("");
    setImportResult(null);
    try {
      const result = await postJSON("/candidates/bulk-import", { csv: csvText });
      setImportResult(result);
      if (result.imported) {
        setQuery("");
        setStageFilter("All");
        setReloadKey((key) => key + 1);
      }
    } catch (err) {
      setImportError(err.message || "Couldn't import this CSV.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <AppFrame title={data?.topTitle || "Candidates"} hasNotifications={data?.hasNotifications}>
      {loading && <PageState />}
      {!loading && error && (
        <PageState type="error" message={`Couldn't load candidates. ${error}`} />
      )}

      {!loading && !error && data && (
        <main className="candidates-content">
          <header className="candidates-header">
            <div>
              <h1>Candidates</h1>
              <p>{filteredCandidates.length} shown from {data.summary?.total || 0} applications</p>
            </div>
            <div className="candidates-header__actions">
              <label className="candidates-search">
                <SearchIcon />
                <input
                  type="search"
                  placeholder="Search candidates"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button type="button" className="candidates-import-button" onClick={openImport}>
                <UploadIcon />
                Import CSV
              </button>
            </div>
          </header>

          <section className="candidates-metrics">
            <article>
              <span>Total</span>
              <strong>{data.summary?.total || 0}</strong>
            </article>
            <article>
              <span>Active</span>
              <strong>{data.summary?.active || 0}</strong>
            </article>
            <article>
              <span>Onsite</span>
              <strong>{data.summary?.onsite || 0}</strong>
            </article>
            <article>
              <span>Offer</span>
              <strong>{data.summary?.offer || 0}</strong>
            </article>
          </section>

          <div className="candidates-filters">
            {filters.map((filter) => (
              <button
                type="button"
                className={filter.label === stageFilter ? "candidates-filter candidates-filter--active" : "candidates-filter"}
                key={filter.label}
                onClick={() => setStageFilter(filter.label)}
              >
                {filter.label}
                <span>{filter.count}</span>
              </button>
            ))}
          </div>

          <section className="candidates-table">
            <div className="candidates-table__head">
              <span>Candidate</span>
              <span>Job</span>
              <span>Stage</span>
              <span>Recruiter</span>
              <span>Source</span>
            </div>

            {filteredCandidates.map((candidate) => (
              <button
                type="button"
                className="candidate-row"
                key={candidate.id}
                onClick={() => navigate(`/candidates/${candidate.id}`)}
              >
                <span className="candidate-row__identity">
                  <Avatar
                    initials={candidate.initials}
                    color={candidate.avatarColor}
                    size={36}
                  />
                  <span>
                    <strong>{candidate.name}</strong>
                    <small>{candidate.headline}</small>
                  </span>
                </span>
                <span className="candidate-row__job">
                  <strong>{candidate.jobTitle}</strong>
                  <small>{candidate.department}</small>
                </span>
                <span>
                  <Badge tone={STAGE_TONE[candidate.stageKey] || "neutral"}>{candidate.stage}</Badge>
                  <small className="candidate-row__stage-age">{candidate.stageAgeLabel}</small>
                </span>
                <span className="candidate-row__muted">{candidate.recruiter}</span>
                <span className="candidate-row__muted">{candidate.source}</span>
              </button>
            ))}

            {filteredCandidates.length === 0 && (
              <div className="candidates-empty">No candidates match this view.</div>
            )}
          </section>

          {importOpen && (
            <div className="candidates-import" role="dialog" aria-modal="true" aria-labelledby="candidates-import-title">
              <form className="candidates-import__modal" onSubmit={handleImportSubmit}>
                <header className="candidates-import__header">
                  <div>
                    <h2 id="candidates-import-title">Import CSV</h2>
                    <p>{CSV_TEMPLATE}</p>
                  </div>
                  <button
                    type="button"
                    className="candidates-import__close"
                    onClick={() => setImportOpen(false)}
                    disabled={importing}
                    aria-label="Close import"
                  >
                    x
                  </button>
                </header>

                <label className="candidates-import__file">
                  <UploadIcon />
                  <span>{importFileName || "Choose CSV file"}</span>
                  <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
                </label>

                <textarea
                  value={csvText}
                  onChange={(event) => {
                    setCsvText(event.target.value);
                    setImportError("");
                    setImportResult(null);
                  }}
                  placeholder={CSV_SAMPLE}
                  spellCheck="false"
                />

                {importError && <div className="candidates-import__error">{importError}</div>}
                {importResult && (
                  <div className="candidates-import__result">
                    <strong>{importResult.imported} imported</strong>
                    {(importResult.errors || []).length > 0 && (
                      <span>{importResult.errors.join(" ")}</span>
                    )}
                  </div>
                )}

                <footer className="candidates-import__actions">
                  <button type="button" onClick={() => setCsvText(CSV_SAMPLE)} disabled={importing}>
                    Template
                  </button>
                  <button type="button" onClick={() => setImportOpen(false)} disabled={importing}>
                    Cancel
                  </button>
                  <button type="submit" disabled={importing || !csvText.trim()}>
                    {importing ? "Importing..." : "Import"}
                  </button>
                </footer>
              </form>
            </div>
          )}
        </main>
      )}
    </AppFrame>
  );
}
