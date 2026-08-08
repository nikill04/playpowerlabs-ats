import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApiResource } from "../api/useApiResource.js";
import AppFrame from "../components/AppFrame.jsx";
import Avatar from "../components/Avatar.jsx";
import Badge from "../components/Badge.jsx";
import PageState from "../components/PageState.jsx";
import { SearchIcon } from "../components/icons.jsx";
import "./Candidates.css";

const STAGE_TONE = {
  applied: "neutral",
  screen: "info",
  onsite: "warning",
  offer: "success",
  hired: "success",
  rejected: "danger",
};

export default function Candidates() {
  const navigate = useNavigate();
  const { data, loading, error } = useApiResource("/candidates");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("All");

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
            <label className="candidates-search">
              <SearchIcon />
              <input
                type="search"
                placeholder="Search candidates"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
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
        </main>
      )}
    </AppFrame>
  );
}
