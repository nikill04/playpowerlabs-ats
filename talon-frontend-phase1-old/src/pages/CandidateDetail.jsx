import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { patchJSON, postJSON } from "../api/apiClient.js";
import { useApiResource } from "../api/useApiResource.js";
import AppFrame from "../components/AppFrame.jsx";
import Avatar from "../components/Avatar.jsx";
import PageState from "../components/PageState.jsx";
import "./CandidateDetail.css";

const STAGES = ["Applied", "Screen", "Onsite", "Offer", "Hired"];

function formatActionLabel(label = "") {
  return label.replace(/<-/g, "\u2190").replace(/->/g, "\u2192");
}

function nextStageAfter(stage) {
  const index = STAGES.indexOf(stage);
  if (index < 0 || index >= STAGES.length - 1) return null;
  return STAGES[index + 1];
}

export default function CandidateDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [reloadKey, setReloadKey] = useState(0);
  const [noteText, setNoteText] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [actionError, setActionError] = useState(null);
  const { data, loading, error } = useApiResource(`/candidates/${id}${reloadKey ? `?v=${reloadKey}` : ""}`);

  const candidate = data?.candidate;
  const tabs = data?.tabs || [];
  const stages = data?.stages || [];
  const activity = data?.activity || [];
  const sidebarSections = data?.sidebarSections || [];
  const applicationId = candidate?.applicationId || id;
  const currentStage = stages.find((stage) => stage.active)?.label;
  const nextStage = nextStageAfter(currentStage);

  useEffect(() => {
    setNoteText("");
    setPendingAction("");
    setActionError(null);
  }, [id]);

  function openScheduling() {
    const appId = data?.schedulingAppId || applicationId;
    navigate(`/scheduling/${appId}`);
  }

  function refreshCandidate() {
    setReloadKey((key) => key + 1);
  }

  async function handleReject() {
    if (!applicationId || pendingAction) return;

    setPendingAction("reject");
    setActionError(null);
    try {
      await postJSON(`/applications/${applicationId}/reject`);
      refreshCandidate();
    } catch (err) {
      setActionError(err.message || "Couldn't reject this candidate.");
    } finally {
      setPendingAction("");
    }
  }

  async function handleAdvance() {
    if (!applicationId || !nextStage || pendingAction) return;

    setPendingAction("advance");
    setActionError(null);
    try {
      await patchJSON(`/applications/${applicationId}`, { stage: nextStage });
      refreshCandidate();
    } catch (err) {
      setActionError(err.message || "Couldn't advance this candidate.");
    } finally {
      setPendingAction("");
    }
  }

  async function handleNoteSubmit() {
    const message = noteText.trim();
    if (!applicationId || !message || pendingAction) return;

    setPendingAction("note");
    setActionError(null);
    try {
      await postJSON(`/applications/${applicationId}/notes`, { message });
      setNoteText("");
      refreshCandidate();
    } catch (err) {
      setActionError(err.message || "Couldn't add this note.");
    } finally {
      setPendingAction("");
    }
  }

  return (
    <AppFrame title={data?.topTitle || "Candidate"} hasNotifications={data?.hasNotifications}>
      {loading && <PageState />}
      {!loading && error && (
        <PageState type="error" message={`Couldn't load candidate. ${error}`} />
      )}

      {!loading && !error && data && candidate && (
        <div className="candidate-page">
          <main className="candidate-main">
            <section className="candidate-hero">
              <div className="candidate-hero__identity">
                <Avatar
                  initials={candidate.initials}
                  color={candidate.avatarColor}
                  size={48}
                />
                <div>
                  <h1>{candidate.name}</h1>
                  <p>{candidate.summary}</p>
                </div>
              </div>

              <div className="candidate-hero__actions">
                {data.actions?.reject && (
                  <button
                    type="button"
                    className="candidate-button candidate-button--reject"
                    disabled={Boolean(pendingAction)}
                    onClick={handleReject}
                  >
                    {data.actions.reject}
                  </button>
                )}
                {data.actions?.schedule && (
                  <button
                    type="button"
                    className="candidate-button"
                    onClick={openScheduling}
                  >
                    {data.actions.schedule}
                  </button>
                )}
                {data.actions?.advance && (
                  <button
                    type="button"
                    className="candidate-button candidate-button--primary"
                    disabled={Boolean(pendingAction) || !nextStage}
                    onClick={handleAdvance}
                  >
                    {formatActionLabel(data.actions.advance)}
                  </button>
                )}
              </div>
              {actionError && <div className="candidate-action-error">{actionError}</div>}

              <div className="candidate-stages">
                {stages.map((stage) => (
                  <span
                    className={`candidate-stage${
                      stage.active ? " candidate-stage--active" : ""
                    }`}
                    key={stage.label}
                  >
                    {stage.label}
                  </span>
                ))}
                {candidate.stageAgeLabel && (
                  <span className="candidate-stages__age">
                    {candidate.stageAgeLabel}
                  </span>
                )}
              </div>

              <div className="candidate-tabs">
                {tabs.map((tab) => (
                  <button
                    type="button"
                    className={`candidate-tab${
                      tab.active ? " candidate-tab--active" : ""
                    }`}
                    key={tab.label}
                  >
                    {tab.label}
                    {typeof tab.count === "number" && <span>{tab.count}</span>}
                  </button>
                ))}
              </div>
            </section>

            <section className="candidate-feed">
              {data.nextAction && (
                <div className="candidate-next-action">
                  <div>
                    <strong>{data.nextAction.label}</strong>
                    <p>{data.nextAction.body}</p>
                  </div>
                  {data.nextAction.buttonLabel && (
                    <button type="button" onClick={openScheduling}>{data.nextAction.buttonLabel}</button>
                  )}
                </div>
              )}

              {data.noteBox && (
                <div className="candidate-note">
                  <input
                    type="text"
                    placeholder={data.noteBox.placeholder || ""}
                    aria-label={data.noteBox.label || "Note"}
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleNoteSubmit();
                    }}
                  />
                  <button
                    type="button"
                    disabled={pendingAction === "note" || !noteText.trim()}
                    onClick={handleNoteSubmit}
                  >
                    {data.noteBox.buttonLabel}
                  </button>
                </div>
              )}

              <div className="candidate-timeline">
                {activity.map((item) => (
                  <article className="candidate-activity" key={item.id || item.title}>
                    <span className={`candidate-activity__dot candidate-activity__dot--${item.tone || "neutral"}`} />
                    <div className="candidate-activity__card">
                      <div>
                        <h2>{item.title}</h2>
                        <p>{item.body}</p>
                      </div>
                      <time>{item.timeLabel}</time>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </main>

          <aside className="candidate-sidebar">
            {sidebarSections.map((section) => (
              <section className="candidate-sidebar__section" key={section.title}>
                <h2>{section.title}</h2>
                {section.fields?.map((field) => (
                  <div className="candidate-sidebar__field" key={field.label}>
                    <span>{field.label}</span>
                    {field.href ? (
                      <a href={field.href}>{field.value}</a>
                    ) : (
                      <strong>{field.value}</strong>
                    )}
                    {field.meta && <small>{field.meta}</small>}
                  </div>
                ))}
                {section.links?.length > 0 && (
                  <div className="candidate-sidebar__links">
                    {section.links.map((link) => (
                      <a href={link.href} key={link.label}>
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </aside>
        </div>
      )}
    </AppFrame>
  );
}
