import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { patchJSON, postJSON } from "../api/apiClient.js";
import { useApiResource } from "../api/useApiResource.js";
import AppFrame from "../components/AppFrame.jsx";
import Avatar from "../components/Avatar.jsx";
import Badge from "../components/Badge.jsx";
import PageState from "../components/PageState.jsx";
import { ChevronDownIcon, PlusIcon, SearchIcon } from "../components/icons.jsx";
import "./Pipeline.css";

const JOB_STATUS_OPTIONS = ["Active", "On hold", "Closing", "Closed"];
const EMPTY_CANDIDATE_FORM = {
  name: "",
  email: "",
  current_title: "",
  current_company: "",
  source: "Referral",
  stage: "Applied",
};

function MetaList({ items = [] }) {
  return (
    <span className="pipeline-meta-list">
      {items.map((item, index) => (
        <span className="pipeline-meta-list__item" key={`${item}-${index}`}>
          {item}
        </span>
      ))}
    </span>
  );
}

function FilterButton({ label, value, onClick }) {
  return (
    <button type="button" className="pipeline-filter-button" onClick={onClick}>
      {label && <span>{label}</span>}
      {value && <strong>{value}</strong>}
      <ChevronDownIcon />
    </button>
  );
}

function uniqueValues(values, fallback) {
  const unique = [...new Set(values.filter(Boolean))];
  return [fallback, ...unique];
}

function cycleOption(current, options) {
  if (!options.length) return current;
  const index = options.indexOf(current);
  return options[(index + 1) % options.length] || options[0];
}

function candidateSearchText(candidate) {
  return [
    candidate.name,
    candidate.headline,
    candidate.source,
    candidate.recruiter,
    ...(candidate.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function Pipeline() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState("Pipeline");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("Any");
  const [recruiterFilter, setRecruiterFilter] = useState("All");
  const [sortMode, setSortMode] = useState("time");
  const [panel, setPanel] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [jobForm, setJobForm] = useState({
    title: "",
    department: "",
    location: "",
    status: "Active",
    bandMin: "",
    bandMax: "",
  });
  const [candidateForm, setCandidateForm] = useState(EMPTY_CANDIDATE_FORM);
  const { data, loading, error } = useApiResource(`/pipeline/${jobId}${reloadKey ? `?v=${reloadKey}` : ""}`);

  const title = data?.topTitle || data?.job?.title || "Pipeline";
  const job = data?.job;
  const tabs = data?.tabs || [];
  const filters = data?.filters || {};
  const stages = data?.stages || [];

  useEffect(() => {
    setActiveTab("Pipeline");
    setSearch("");
    setStageFilter("All");
    setSourceFilter("Any");
    setRecruiterFilter("All");
    setPanel("");
    setActionError("");
    setCandidateForm(EMPTY_CANDIDATE_FORM);
  }, [jobId]);

  useEffect(() => {
    if (!job) return;
    setJobForm({
      title: job.title || "",
      department: job.department || "",
      location: job.location || "",
      status: job.status || job.statusLabel || "Active",
      bandMin: job.bandMin ?? "",
      bandMax: job.bandMax ?? "",
    });
  }, [job]);

  const allCandidates = useMemo(
    () =>
      stages.flatMap((stage) =>
        (stage.candidates || []).map((candidate) => ({
          ...candidate,
          stage: candidate.stage || stage.name,
          stageColor: stage.color,
        }))
      ),
    [stages]
  );

  const stageOptions = useMemo(() => ["All", ...stages.map((stage) => stage.name)], [stages]);
  const sourceOptions = useMemo(
    () => uniqueValues(allCandidates.map((candidate) => candidate.source || candidate.tags?.[0]), "Any"),
    [allCandidates]
  );
  const recruiterOptions = useMemo(
    () => uniqueValues(allCandidates.map((candidate) => candidate.recruiter), "All"),
    [allCandidates]
  );

  function candidateMatches(candidate) {
    const term = search.trim().toLowerCase();
    if (term && !candidateSearchText(candidate).includes(term)) return false;
    if (stageFilter !== "All" && candidate.stage !== stageFilter) return false;
    if (sourceFilter !== "Any" && (candidate.source || candidate.tags?.[0]) !== sourceFilter) return false;
    if (recruiterFilter !== "All" && candidate.recruiter !== recruiterFilter) return false;
    return true;
  }

  function sortCandidates(candidates) {
    const rows = [...candidates];
    if (sortMode === "name") {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortMode === "rating") {
      rows.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    }
    return rows;
  }

  const visibleStages = useMemo(
    () =>
      stages.map((stage) => {
        const candidates = sortCandidates((stage.candidates || []).filter(candidateMatches));
        return { ...stage, candidates, visibleCount: candidates.length };
      }),
    [stages, search, stageFilter, sourceFilter, recruiterFilter, sortMode]
  );

  const visibleCandidates = useMemo(
    () => sortCandidates(allCandidates.filter(candidateMatches)),
    [allCandidates, search, stageFilter, sourceFilter, recruiterFilter, sortMode]
  );

  const sortLabel = sortMode === "name" ? "name" : sortMode === "rating" ? "rating" : "time in stage";
  const summary = `${visibleCandidates.length} shown - sort: ${sortLabel}`;

  function refreshPipeline() {
    setReloadKey((key) => key + 1);
  }

  function openAddCandidate(stage = "Applied") {
    setPanel("add-candidate");
    setActionError("");
    setCandidateForm({ ...EMPTY_CANDIDATE_FORM, stage });
  }

  async function handleSaveJob(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setActionError("");
    try {
      await patchJSON(`/jobs/${jobId}`, {
        title: jobForm.title,
        department: jobForm.department,
        location: jobForm.location,
        status: jobForm.status,
        band_min: jobForm.bandMin,
        band_max: jobForm.bandMax,
      });
      setPanel("");
      refreshPipeline();
    } catch (err) {
      setActionError(err.message || "Couldn't save this job.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCandidate(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setActionError("");
    try {
      const candidate = await postJSON("/candidates", {
        name: candidateForm.name,
        email: candidateForm.email,
        current_title: candidateForm.current_title,
        current_company: candidateForm.current_company,
        source: candidateForm.source,
      });
      const application = await postJSON("/applications", {
        candidate_id: candidate.id,
        job_id: jobId,
      });
      if (candidateForm.stage && candidateForm.stage !== "Applied") {
        await patchJSON(`/applications/${application.id}`, { stage: candidateForm.stage });
      }
      setPanel("");
      setCandidateForm(EMPTY_CANDIDATE_FORM);
      refreshPipeline();
    } catch (err) {
      setActionError(err.message || "Couldn't add this candidate.");
    } finally {
      setSaving(false);
    }
  }

  function renderActionPanel() {
    if (panel === "edit-job") {
      return (
        <form className="pipeline-action-panel" onSubmit={handleSaveJob}>
          <div className="pipeline-action-panel__header">
            <h2>Edit job</h2>
            <button type="button" onClick={() => setPanel("")}>Close</button>
          </div>
          <div className="pipeline-action-grid">
            <label>
              <span>Title</span>
              <input
                value={jobForm.title}
                onChange={(event) => setJobForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={jobForm.status}
                onChange={(event) => setJobForm((current) => ({ ...current, status: event.target.value }))}
              >
                {JOB_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Department</span>
              <input
                value={jobForm.department}
                onChange={(event) => setJobForm((current) => ({ ...current, department: event.target.value }))}
              />
            </label>
            <label>
              <span>Location</span>
              <input
                value={jobForm.location}
                onChange={(event) => setJobForm((current) => ({ ...current, location: event.target.value }))}
              />
            </label>
            <label>
              <span>Band min</span>
              <input
                type="number"
                value={jobForm.bandMin}
                onChange={(event) => setJobForm((current) => ({ ...current, bandMin: event.target.value }))}
              />
            </label>
            <label>
              <span>Band max</span>
              <input
                type="number"
                value={jobForm.bandMax}
                onChange={(event) => setJobForm((current) => ({ ...current, bandMax: event.target.value }))}
              />
            </label>
          </div>
          {actionError && <div className="pipeline-action-error">{actionError}</div>}
          <div className="pipeline-action-panel__actions">
            <button type="button" className="pipeline-button" onClick={() => setPanel("")}>Cancel</button>
            <button type="submit" className="pipeline-button pipeline-button--primary" disabled={saving}>
              {saving ? "Saving..." : "Save job"}
            </button>
          </div>
        </form>
      );
    }

    if (panel === "add-candidate") {
      return (
        <form className="pipeline-action-panel" onSubmit={handleAddCandidate}>
          <div className="pipeline-action-panel__header">
            <h2>Add candidate</h2>
            <button type="button" onClick={() => setPanel("")}>Close</button>
          </div>
          <div className="pipeline-action-grid">
            <label>
              <span>Name</span>
              <input
                value={candidateForm.name}
                onChange={(event) => setCandidateForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={candidateForm.email}
                onChange={(event) => setCandidateForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label>
              <span>Current title</span>
              <input
                value={candidateForm.current_title}
                onChange={(event) => setCandidateForm((current) => ({ ...current, current_title: event.target.value }))}
              />
            </label>
            <label>
              <span>Current company</span>
              <input
                value={candidateForm.current_company}
                onChange={(event) => setCandidateForm((current) => ({ ...current, current_company: event.target.value }))}
              />
            </label>
            <label>
              <span>Source</span>
              <input
                value={candidateForm.source}
                onChange={(event) => setCandidateForm((current) => ({ ...current, source: event.target.value }))}
              />
            </label>
            <label>
              <span>Stage</span>
              <select
                value={candidateForm.stage}
                onChange={(event) => setCandidateForm((current) => ({ ...current, stage: event.target.value }))}
              >
                {stages.map((stage) => (
                  <option key={stage.name} value={stage.name}>{stage.name}</option>
                ))}
              </select>
            </label>
          </div>
          {actionError && <div className="pipeline-action-error">{actionError}</div>}
          <div className="pipeline-action-panel__actions">
            <button type="button" className="pipeline-button" onClick={() => setPanel("")}>Cancel</button>
            <button type="submit" className="pipeline-button pipeline-button--primary" disabled={saving}>
              {saving ? "Adding..." : "Add candidate"}
            </button>
          </div>
        </form>
      );
    }

    return null;
  }

  function renderCandidatesList() {
    return (
      <section className="pipeline-list-panel">
        {visibleCandidates.length === 0 && (
          <div className="pipeline-empty-state">No candidates match the current filters.</div>
        )}
        {visibleCandidates.map((candidate) => (
          <button
            type="button"
            className="pipeline-list-row"
            key={candidate.id}
            onClick={() => navigate(`/candidates/${candidate.id}`)}
          >
            <Avatar initials={candidate.initials} color={candidate.avatarColor} size={34} />
            <span>
              <strong>{candidate.name}</strong>
              <small>{candidate.headline}</small>
            </span>
            <em style={{ borderColor: candidate.stageColor }}>{candidate.stage}</em>
            <small>{candidate.source || "No source"}</small>
            <small>{candidate.recruiter || "Unassigned"}</small>
          </button>
        ))}
      </section>
    );
  }

  function renderJobDetails() {
    return (
      <section className="pipeline-detail-panel">
        <div className="pipeline-detail-grid">
          <div><span>Department</span><strong>{job?.department || "Not set"}</strong></div>
          <div><span>Location</span><strong>{job?.location || "Not set"}</strong></div>
          <div><span>Status</span><strong>{job?.statusLabel || "Not set"}</strong></div>
          <div><span>Band</span><strong>{job?.bandMin || "?"} to {job?.bandMax || "?"}</strong></div>
        </div>
        <button type="button" className="pipeline-button pipeline-button--primary" onClick={() => setPanel("edit-job")}>
          Edit job
        </button>
      </section>
    );
  }

  function renderHiringTeam() {
    return (
      <section className="pipeline-detail-panel">
        <div className="pipeline-team-card">
          <Avatar initials={(job?.ownerName || "Unassigned").split(/\s+/).map((part) => part[0]).join("").slice(0, 2)} size={42} />
          <span>
            <strong>{job?.ownerName || "Unassigned"}</strong>
            <small>Hiring manager</small>
          </span>
        </div>
      </section>
    );
  }

  function renderBoard() {
    return (
      <div className="pipeline-board-wrap">
        <div className="pipeline-board">
          {visibleStages.map((stage) => (
            <section className="pipeline-stage" key={stage.id || stage.name}>
              <div className="pipeline-stage__head">
                <div className="pipeline-stage__title-row">
                  <span
                    className="pipeline-stage__dot"
                    style={{ backgroundColor: stage.color }}
                  />
                  <h2>{stage.name}</h2>
                  <span className="pipeline-stage__count">
                    {stage.visibleCount}
                  </span>
                </div>
                <button
                  type="button"
                  className="pipeline-stage__add"
                  onClick={() => openAddCandidate(stage.name)}
                  aria-label={`Add candidate to ${stage.name}`}
                >
                  +
                </button>
              </div>

              <div className="pipeline-stage__progress">
                <span
                  style={{
                    backgroundColor: stage.color,
                    width: `${stage.passPercent || 0}%`,
                  }}
                />
              </div>

              <div className="pipeline-stage__stats">
                <span>{stage.medianLabel}</span>
                {stage.passLabel && <span>{stage.passLabel}</span>}
              </div>

              <div className="pipeline-stage__cards">
                {(stage.candidates || []).map((candidate) => (
                  <button
                    type="button"
                    className="pipeline-candidate-card"
                    key={candidate.id}
                    onClick={() => navigate(`/candidates/${candidate.id}`)}
                  >
                    <div className="pipeline-candidate-card__top">
                      <Avatar
                        initials={candidate.initials}
                        color={candidate.avatarColor}
                        size={34}
                      />
                      <div className="pipeline-candidate-card__identity">
                        <strong>{candidate.name}</strong>
                        <span>{candidate.headline}</span>
                      </div>
                      {candidate.rating && (
                        <span className="pipeline-candidate-card__rating">
                          {candidate.rating}
                        </span>
                      )}
                    </div>

                    {candidate.tags?.length > 0 && (
                      <div className="pipeline-candidate-card__tags">
                        {candidate.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="pipeline-candidate-card__footer">
                      {(candidate.meta || []).map((item, index) => (
                        <span
                          className={
                            item.tone === "danger"
                              ? "pipeline-candidate-card__danger"
                              : ""
                          }
                          key={`${item.label}-${index}`}
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
                {stage.candidates.length === 0 && (
                  <div className="pipeline-stage__empty">No matching candidates</div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <AppFrame title={title} hasNotifications={data?.hasNotifications}>
      {loading && <PageState />}
      {!loading && error && (
        <PageState type="error" message={`Couldn't load pipeline. ${error}`} />
      )}

      {!loading && !error && data && (
        <>
          <div className="pipeline-job-header">
            <div className="pipeline-job-header__main">
              <div className="pipeline-job-header__title-row">
                <h1>{job?.title}</h1>
                {job?.statusLabel && (
                  <Badge tone={job.statusTone || "success"}>
                    {job.statusLabel}
                  </Badge>
                )}
                <MetaList items={job?.metaItems || []} />
              </div>

              <div className="pipeline-tabs">
                {tabs.map((tab) => (
                  <button
                    type="button"
                    className={`pipeline-tab${
                      activeTab === tab.label ? " pipeline-tab--active" : ""
                    }`}
                    key={tab.label}
                    onClick={() => {
                      setActiveTab(tab.label);
                      setPanel("");
                    }}
                  >
                    {tab.label}
                    {typeof tab.count === "number" && (
                      <span>{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="pipeline-job-header__actions">
              {data.actions?.secondary && (
                <button type="button" className="pipeline-button" onClick={() => setPanel("edit-job")}>
                  {data.actions.secondary}
                </button>
              )}
              {data.actions?.primary && (
                <button type="button" className="pipeline-button pipeline-button--primary" onClick={() => openAddCandidate("Applied")}>
                  <PlusIcon />
                  {data.actions.primary}
                </button>
              )}
            </div>
          </div>

          <div className="pipeline-toolbar">
            <div className="pipeline-toolbar__left">
              <div className="pipeline-search">
                <SearchIcon />
                <input
                  type="text"
                  placeholder={filters.searchPlaceholder || ""}
                  aria-label={filters.searchLabel || "Filter candidates"}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <FilterButton
                label="Stage"
                value={stageFilter}
                onClick={() => setStageFilter((current) => cycleOption(current, stageOptions))}
              />
              <FilterButton
                label="Source"
                value={sourceFilter}
                onClick={() => setSourceFilter((current) => cycleOption(current, sourceOptions))}
              />
              <FilterButton
                label="Recruiter"
                value={recruiterFilter}
                onClick={() => setRecruiterFilter((current) => cycleOption(current, recruiterOptions))}
              />
            </div>
            <button
              type="button"
              className="pipeline-sort-button"
              onClick={() => setSortMode((current) => (current === "time" ? "name" : current === "name" ? "rating" : "time"))}
            >
              {summary}
              <ChevronDownIcon />
            </button>
          </div>

          {renderActionPanel()}

          {activeTab === "Candidates" && renderCandidatesList()}
          {activeTab === "Job details" && renderJobDetails()}
          {activeTab === "Hiring team" && renderHiringTeam()}
          {activeTab === "Pipeline" && renderBoard()}
        </>
      )}
    </AppFrame>
  );
}
