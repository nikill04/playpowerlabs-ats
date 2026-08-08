import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getJSON } from "../api/apiClient.js";
import AppFrame from "../components/AppFrame.jsx";
import Avatar from "../components/Avatar.jsx";
import Badge from "../components/Badge.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { ChevronDownIcon, PlusIcon } from "../components/icons.jsx";
import "./Jobs.css";

const STATUS_FILTERS = ["All", "Active", "On hold", "Closing"];

const STATUS_TONE = {
  active: "success",
  on_hold: "warning",
  closing: "info",
};

const STATUS_LABEL = {
  active: "Active",
  on_hold: "On hold",
  closing: "Closing",
};

function statusMatchesFilter(status, filter) {
  if (filter === "All") return true;
  return STATUS_LABEL[status] === filter;
}

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      setLoading(true);
      setError(null);
      try {
        const data = await getJSON("/jobs");
        if (!cancelled) setJobs(Array.isArray(data) ? data : data.jobs || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Couldn't load jobs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadJobs();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredJobs = useMemo(
    () => jobs.filter((job) => statusMatchesFilter(job.status, statusFilter)),
    [jobs, statusFilter]
  );

  const groups = useMemo(() => {
    const order = [];
    const byDept = new Map();
    for (const job of filteredJobs) {
      if (!byDept.has(job.department)) {
        byDept.set(job.department, []);
        order.push(job.department);
      }
      byDept.get(job.department).push(job);
    }
    return order.map((department) => ({
      department,
      jobs: byDept.get(department),
    }));
  }, [filteredJobs]);

  return (
    <AppFrame title="Jobs" hasNotifications>
      <main className="jobs-content">
        <div className="jobs-header">
          <div className="jobs-header__title-row">
            <h1 className="jobs-header__title">Jobs</h1>
            <span className="jobs-header__subtitle">
              {loading ? "..." : `${filteredJobs.length} open`}
            </span>
          </div>

          <div className="jobs-header__actions">
            <div className="status-filter">
              <button
                type="button"
                className="status-filter__button"
                onClick={() => setStatusMenuOpen((open) => !open)}
              >
                Status: {statusFilter}
                <ChevronDownIcon />
              </button>
              {statusMenuOpen && (
                <div className="status-filter__menu">
                  {STATUS_FILTERS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`status-filter__option${
                        option === statusFilter
                          ? " status-filter__option--selected"
                          : ""
                      }`}
                      onClick={() => {
                        setStatusFilter(option);
                        setStatusMenuOpen(false);
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="new-job-button"
              onClick={() => navigate("/jobs/new")}
            >
              <PlusIcon />
              New job
            </button>
          </div>
        </div>

        {loading && (
          <div className="jobs-state">
            <div className="jobs-state__skeleton" />
            <div className="jobs-state__skeleton" />
            <div className="jobs-state__skeleton" />
          </div>
        )}

        {!loading && error && (
          <div className="jobs-state jobs-state--error">
            Couldn't load jobs. {error}
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="jobs-state">No jobs match this filter.</div>
        )}

        {!loading &&
          !error &&
          groups.map(({ department, jobs: deptJobs }) => (
            <section className="jobs-group" key={department}>
              <div className="jobs-group__label">
                {department.toUpperCase()} {"\u00b7"} {deptJobs.length} OPEN
              </div>
              <div className="jobs-group__card">
                {deptJobs.map((job) => (
                  <div
                    className="job-row"
                    key={job.id}
                    onClick={() => navigate(`/pipeline/${job.id}`)}
                  >
                    <div className="job-row__title-cell">
                      <div className="job-row__title">{job.title}</div>
                      <div className="job-row__subtitle">
                        {job.code} {"\u00b7"} {job.location}
                      </div>
                    </div>

                    <div className="job-row__owner-cell">
                      <Avatar
                        initials={job.owner?.initials}
                        color={job.owner?.color}
                      />
                      <span className="job-row__owner-name">
                        {job.owner?.name}
                      </span>
                    </div>

                    <div className="job-row__pipeline-cell">
                      <ProgressBar segments={job.pipeline?.stages || []} />
                      <span className="job-row__pipeline-label">
                        {job.pipeline?.inProcess} in process
                      </span>
                    </div>

                    <div className="job-row__active-cell">
                      {job.pipeline?.active} active
                    </div>

                    <div className="job-row__status-cell">
                      <Badge tone={STATUS_TONE[job.status] || "neutral"}>
                        {STATUS_LABEL[job.status] || job.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </main>
    </AppFrame>
  );
}
