import { useNavigate, useParams } from "react-router-dom";
import { useApiResource } from "../api/useApiResource.js";
import AppFrame from "../components/AppFrame.jsx";
import Avatar from "../components/Avatar.jsx";
import Badge from "../components/Badge.jsx";
import PageState from "../components/PageState.jsx";
import { ChevronDownIcon, PlusIcon, SearchIcon } from "../components/icons.jsx";
import "./Pipeline.css";

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

function FilterButton({ label, value }) {
  return (
    <button type="button" className="pipeline-filter-button">
      {label && <span>{label}</span>}
      {value && <strong>{value}</strong>}
      <ChevronDownIcon />
    </button>
  );
}

export default function Pipeline() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { data, loading, error } = useApiResource(`/pipeline/${jobId}`);

  const title = data?.topTitle || data?.job?.title || "Pipeline";
  const job = data?.job;
  const tabs = data?.tabs || [];
  const filters = data?.filters || {};
  const stages = data?.stages || [];

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
                      tab.active ? " pipeline-tab--active" : ""
                    }`}
                    key={tab.label}
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
                <button type="button" className="pipeline-button">
                  {data.actions.secondary}
                </button>
              )}
              {data.actions?.primary && (
                <button type="button" className="pipeline-button pipeline-button--primary">
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
                />
              </div>
              {(filters.controls || []).map((control) => (
                <FilterButton
                  key={control.label}
                  label={control.label}
                  value={control.value}
                />
              ))}
            </div>
            {filters.summary && (
              <button type="button" className="pipeline-sort-button">
                {filters.summary}
                <ChevronDownIcon />
              </button>
            )}
          </div>

          <div className="pipeline-board-wrap">
            <div className="pipeline-board">
              {stages.map((stage) => (
                <section className="pipeline-stage" key={stage.id || stage.name}>
                  <div className="pipeline-stage__head">
                    <div className="pipeline-stage__title-row">
                      <span
                        className="pipeline-stage__dot"
                        style={{ backgroundColor: stage.color }}
                      />
                      <h2>{stage.name}</h2>
                      {typeof stage.count === "number" && (
                        <span className="pipeline-stage__count">
                          {stage.count}
                        </span>
                      )}
                    </div>
                    <button type="button" className="pipeline-stage__add">
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
                  </div>
                </section>
              ))}
            </div>
          </div>
        </>
      )}
    </AppFrame>
  );
}
