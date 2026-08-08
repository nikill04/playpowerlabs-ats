import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getJSON } from "../api/apiClient.js";
import { SearchIcon, BellIcon } from "./icons.jsx";
import "./TopBar.css";

/**
 * Top header bar shared across authenticated pages.
 * `title` is the small page label on the left (e.g. "Jobs").
 * `hasNotifications` controls the red dot on the bell — passed in by the
 * page from data it already fetched, rather than fetched again here.
 */
export default function TopBar({ title, hasNotifications = true }) {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ jobs: [], candidates: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const parts =
    typeof title === "string" && title.includes(" / ") ? title.split(" / ") : [];

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults({ jobs: [], candidates: [] });
      setSearchOpen(false);
      setSearchError("");
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const data = await getJSON(`/search?q=${encodeURIComponent(term)}`);
        if (!cancelled) {
          setResults({
            jobs: data.jobs || [],
            candidates: data.candidates || [],
          });
          setSearchOpen(true);
        }
      } catch (err) {
        if (!cancelled) setSearchError(err.message || "Search failed.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function goToResult(type, item) {
    setQuery("");
    setSearchOpen(false);
    if (type === "job") {
      navigate(`/pipeline/${item.id}`);
      return;
    }
    if (item.application_id) {
      navigate(`/candidates/${item.application_id}`);
    }
  }

  function firstResult() {
    if (results.jobs?.[0]) return { type: "job", item: results.jobs[0] };
    if (results.candidates?.[0]) return { type: "candidate", item: results.candidates[0] };
    return null;
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Escape") {
      setSearchOpen(false);
      return;
    }
    if (event.key === "Enter") {
      const result = firstResult();
      if (result) {
        event.preventDefault();
        goToResult(result.type, result.item);
      }
    }
  }

  const hasResults = results.jobs.length > 0 || results.candidates.length > 0;

  return (
    <header className="topbar">
      <div className="topbar__title">
        {parts.length > 0
          ? parts.map((part, index) => (
              <span
                className={
                  index === parts.length - 1
                    ? "topbar__title-current"
                    : "topbar__title-parent"
                }
                key={`${part}-${index}`}
              >
                {index > 0 && <span className="topbar__title-separator">/</span>}
                {part}
              </span>
            ))
          : title}
      </div>
      <div className="topbar__right">
        <div className="topbar__search">
          <SearchIcon className="topbar__search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search candidates, jobs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              if (query.trim().length >= 2) setSearchOpen(true);
            }}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
            onKeyDown={handleSearchKeyDown}
          />
          {searchOpen && (
            <div className="topbar__search-results">
              {searching && <div className="topbar__search-state">Searching...</div>}
              {!searching && searchError && (
                <div className="topbar__search-state topbar__search-state--error">{searchError}</div>
              )}
              {!searching && !searchError && !hasResults && (
                <div className="topbar__search-state">No matches</div>
              )}
              {!searching && !searchError && results.jobs.length > 0 && (
                <div className="topbar__search-group">
                  <span>Jobs</span>
                  {results.jobs.map((job) => (
                    <button
                      type="button"
                      key={`job-${job.id}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => goToResult("job", job)}
                    >
                      <strong>{job.title}</strong>
                      <small>{job.code}</small>
                    </button>
                  ))}
                </div>
              )}
              {!searching && !searchError && results.candidates.length > 0 && (
                <div className="topbar__search-group">
                  <span>Candidates</span>
                  {results.candidates.map((candidate) => (
                    <button
                      type="button"
                      key={`candidate-${candidate.application_id || candidate.id}`}
                      disabled={!candidate.application_id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => goToResult("candidate", candidate)}
                    >
                      <strong>{candidate.name}</strong>
                      <small>{candidate.job_title || candidate.current_title || "No application"}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="topbar__bell"
          aria-label="Open review inbox"
          onClick={() => navigate("/review-inbox")}
        >
          <BellIcon />
          {hasNotifications && <span className="topbar__bell-dot" />}
        </button>
      </div>
    </header>
  );
}
