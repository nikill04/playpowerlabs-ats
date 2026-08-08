import { useEffect, useMemo, useState } from "react";
import { postJSON } from "../api/apiClient.js";
import { useApiResource } from "../api/useApiResource.js";
import AppFrame from "../components/AppFrame.jsx";
import Avatar from "../components/Avatar.jsx";
import PageState from "../components/PageState.jsx";
import "./ReviewInbox.css";

export default function ReviewInbox() {
  const { data, loading, error } = useApiResource("/review-inbox");
  const [inbox, setInbox] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    if (!data) return;
    setInbox(data);
    setSelectedId(data.selectedId || data.selected?.id || data.details?.[0]?.id || null);
  }, [data]);

  const queueItems = inbox?.queue?.items || [];
  const selected = useMemo(() => {
    if (!inbox) return null;
    const details = inbox.details || [];
    return (
      details.find((item) => item.id === selectedId) ||
      inbox.selected ||
      details[0] ||
      null
    );
  }, [inbox, selectedId]);

  function removeFromQueue(applicationId) {
    if (!inbox) return;

    const currentQueueItems = inbox.queue?.items || [];
    const currentDetails = inbox.details || [];
    const currentIndex = Math.max(
      0,
      currentQueueItems.findIndex((item) => item.id === applicationId)
    );
    const nextQueueItems = currentQueueItems.filter((item) => item.id !== applicationId);
    const nextDetails = currentDetails.filter((item) => item.id !== applicationId);
    const nextSelected = nextDetails[currentIndex] || nextDetails[currentIndex - 1] || nextDetails[0] || null;
    const originalTotal = currentQueueItems.length;

    setInbox({
      ...inbox,
      selectedId: nextSelected?.id || null,
      selected: nextSelected,
      details: nextDetails,
      queue: {
        ...inbox.queue,
        waitingLabel: `${nextQueueItems.length} waiting`,
        progressPercent: originalTotal ? Math.round(((originalTotal - nextQueueItems.length) / originalTotal) * 100) : 0,
        progressLabel: `${originalTotal - nextQueueItems.length} of ${originalTotal} reviewed today`,
        items: nextQueueItems,
      },
    });
    setSelectedId(nextSelected?.id || null);
  }

  async function handleReviewAction(kind) {
    if (!selected?.id || actioning) return;

    setActioning(true);
    setActionError(null);
    try {
      await postJSON(`/applications/${selected.id}/${kind}`);
      removeFromQueue(selected.id);
    } catch (err) {
      setActionError(err.message || "Couldn't update this candidate.");
    } finally {
      setActioning(false);
    }
  }

  useEffect(() => {
    if (!selected?.id) return undefined;

    function handleShortcut(event) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      const tagName = event.target?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tagName)) return;
      if (event.target?.isContentEditable) return;

      const key = event.key.toLowerCase();
      if (key === "a") {
        event.preventDefault();
        handleReviewAction("advance");
      }
      if (key === "r") {
        event.preventDefault();
        handleReviewAction("reject");
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [selected?.id, actioning]);

  return (
    <AppFrame title={inbox?.topTitle || "Review inbox"} hasNotifications={inbox?.hasNotifications}>
      {loading && <PageState />}
      {!loading && error && (
        <PageState type="error" message={`Couldn't load review inbox. ${error}`} />
      )}

      {!loading && !error && inbox && (
        <div className="review-page">
          <aside className="review-queue">
            <div className="review-queue__header">
              <div className="review-queue__title-row">
                <h1>{inbox.queue?.title}</h1>
                {inbox.queue?.waitingLabel && <span>{inbox.queue.waitingLabel}</span>}
              </div>
              <div className="review-queue__progress">
                <span style={{ width: `${inbox.queue?.progressPercent || 0}%` }} />
              </div>
              {inbox.queue?.progressLabel && (
                <p>{inbox.queue.progressLabel}</p>
              )}
            </div>

            <div className="review-queue__list">
              {queueItems.map((item) => (
                <button
                  type="button"
                  className={`review-queue-item${
                    item.id === selected?.id ? " review-queue-item--active" : ""
                  }`}
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <Avatar
                    initials={item.initials}
                    color={item.avatarColor}
                    size={36}
                  />
                  <span className="review-queue-item__identity">
                    <strong>{item.name}</strong>
                    <span>{item.headline}</span>
                  </span>
                  <span className="review-queue-item__age">{item.ageLabel}</span>
                </button>
              ))}
            </div>
          </aside>

          <main className="review-detail">
            {selected ? (
              <>
                <div className="review-detail__header">
                  <div className="review-detail__candidate">
                    <Avatar
                      initials={selected.initials}
                      color={selected.avatarColor}
                      size={48}
                    />
                    <div>
                      <h2>{selected.name}</h2>
                      <p>{selected.summary}</p>
                    </div>
                  </div>

                  <div className="review-detail__actions">
                    {selected.actions?.secondary && (
                      <button
                        type="button"
                        className="review-action review-action--reject"
                        disabled={actioning}
                        onClick={() => handleReviewAction("reject")}
                      >
                        {selected.actions.secondary}
                        {selected.actions.secondaryShortcut && (
                          <kbd>{selected.actions.secondaryShortcut}</kbd>
                        )}
                      </button>
                    )}
                    {selected.actions?.primary && (
                      <button
                        type="button"
                        className="review-action review-action--primary"
                        disabled={actioning}
                        onClick={() => handleReviewAction("advance")}
                      >
                        {selected.actions.primary}
                        {selected.actions.primaryShortcut && (
                          <kbd>{selected.actions.primaryShortcut}</kbd>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="review-detail__body">
                  <div className="review-detail__main">
                    {(selected.sections || []).map((section) => (
                      <section className="review-card" key={section.title}>
                        <h3>{section.title}</h3>
                        {section.body && <p>{section.body}</p>}
                        {section.items?.length > 0 && (
                          <ul>
                            {section.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </section>
                    ))}
                  </div>

                  <aside className="review-signal">
                    <section className="review-card review-card--signal">
                      <h3>{selected.signalTitle}</h3>
                      <div className="review-signal__rows">
                        {(selected.signals || []).map((signal) => (
                          <div className="review-signal__row" key={signal.label}>
                            <span>{signal.label}</span>
                            <strong className={`review-signal__value review-signal__value--${signal.tone || "success"}`}>
                              {signal.value}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </section>

                    {selected.keyboardHint && (
                      <p className="review-keyboard-hint">{selected.keyboardHint}</p>
                    )}
                    {actionError && (
                      <p className="review-action-error">{actionError}</p>
                    )}
                  </aside>
                </div>
              </>
            ) : (
              <PageState type="empty" message={inbox.emptyMessage} />
            )}
          </main>
        </div>
      )}
    </AppFrame>
  );
}
