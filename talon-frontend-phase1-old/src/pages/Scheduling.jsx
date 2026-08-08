import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { patchJSON, postJSON } from "../api/apiClient.js";
import { API_BASE_URL } from "../api/config.js";
import { useApiResource } from "../api/useApiResource.js";
import AppFrame from "../components/AppFrame.jsx";
import Avatar from "../components/Avatar.jsx";
import PageState from "../components/PageState.jsx";
import "./Scheduling.css";

const EMPTY_ROUND_FORM = {
  roundName: "",
  interviewerId: "",
  durationMinutes: "45",
};

const ROUND_NAME_OPTIONS = ["Coding", "System design", "Values", "Hiring manager", "Portfolio review"];

export default function Scheduling() {
  const { appId } = useParams();
  const [reloadKey, setReloadKey] = useState(0);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [calendarMode, setCalendarMode] = useState("Day");
  const [selectedRoundId, setSelectedRoundId] = useState(null);
  const [schedulingRoundId, setSchedulingRoundId] = useState(null);
  const [showRoundForm, setShowRoundForm] = useState(false);
  const [roundForm, setRoundForm] = useState(EMPTY_ROUND_FORM);
  const [addingRound, setAddingRound] = useState(false);
  const { data, loading, error } = useApiResource(`/scheduling/${appId}${reloadKey ? `?v=${reloadKey}` : ""}`);

  const candidate = data?.candidate;
  const rounds = data?.rounds || [];
  const pendingRounds = rounds.filter((round) => round.id && round.status === "Pending");
  const invitableRounds = pendingRounds.filter((round) => round.scheduledAt);
  const selectedRound = pendingRounds.find((round) => round.id === selectedRoundId) || null;
  const interviewers = data?.interviewers || [];
  const columns = data?.calendar?.columns || [];
  const rows = data?.calendar?.rows || [];
  const confirmedRounds = rounds.filter((round) => round.status === "Confirmed" || round.status === "Completed");
  const busyCells = rows.reduce(
    (count, row) => count + (row.cells || []).filter((cell) => cell.type === "busy").length,
    0
  );
  const gridStyle = {
    gridTemplateColumns: `68px repeat(${Math.max(columns.length, 1)}, minmax(180px, 1fr))`,
  };
  const showAddRoundForm = showRoundForm || rounds.length === 0;

  useEffect(() => {
    if (!data) return;
    const currentPendingRounds = (data.rounds || []).filter((round) => round.id && round.status === "Pending");
    if (!currentPendingRounds.length) {
      if (selectedRoundId !== null) setSelectedRoundId(null);
      return;
    }
    if (!currentPendingRounds.some((round) => round.id === selectedRoundId)) {
      setSelectedRoundId(currentPendingRounds[0].id);
    }
  }, [data, selectedRoundId]);

  useEffect(() => {
    const currentInterviewers = data?.interviewers || [];
    if (!currentInterviewers.length || roundForm.interviewerId) return;
    setRoundForm((current) => ({
      ...current,
      interviewerId: String(currentInterviewers[0].id),
    }));
  }, [data, roundForm.interviewerId]);

  async function handleSendInvites() {
    if (sendingInvites) return;
    if (invitableRounds.length === 0) {
      setSendError(pendingRounds.length ? "Pick a time before sending invites." : null);
      return;
    }

    setSendingInvites(true);
    setSendError(null);
    try {
      await Promise.all(
        invitableRounds.map((round) => postJSON(`/interviews/${round.id}/send-invites`))
      );
      setReloadKey((key) => key + 1);
    } catch (err) {
      setSendError(err.message || "Couldn't send invites.");
    } finally {
      setSendingInvites(false);
    }
  }

  async function handleScheduleCell(cell) {
    if (!cell?.canSchedule || cell.roundId !== selectedRoundId || schedulingRoundId) return;

    setSchedulingRoundId(cell.roundId);
    setSendError(null);
    try {
      await patchJSON(`/interviews/${cell.roundId}`, {
        scheduled_at: cell.slotStart,
      });
      setReloadKey((key) => key + 1);
    } catch (err) {
      setSendError(err.message || "Couldn't schedule this interview.");
    } finally {
      setSchedulingRoundId(null);
    }
  }

  async function handleAddRound(event) {
    event.preventDefault();
    const roundName = roundForm.roundName.trim();
    const interviewerId = Number(roundForm.interviewerId);
    const durationMinutes = Number(roundForm.durationMinutes);
    if (!roundName) {
      setSendError("Round name is required.");
      return;
    }
    if (!interviewerId) {
      setSendError("Choose an interviewer.");
      return;
    }

    setAddingRound(true);
    setSendError(null);
    try {
      const created = await postJSON(`/applications/${appId}/interviews`, {
        round_name: roundName,
        interviewer_id: interviewerId,
        duration_minutes: durationMinutes,
      });
      setRoundForm({
        ...EMPTY_ROUND_FORM,
        interviewerId: String(interviewerId),
      });
      setSelectedRoundId(created.id);
      setShowRoundForm(false);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setSendError(err.message || "Couldn't add interview round.");
    } finally {
      setAddingRound(false);
    }
  }

  async function handleSecondaryAction() {
    if (!data?.actions?.secondaryUrl) return;
    if (data.actions.secondaryUrl.endsWith("/start")) {
      setSendError(null);
      try {
        const result = await postJSON(data.actions.secondaryUrl, {
          return_to: window.location.pathname,
        });
        window.location.href = result.url;
      } catch (err) {
        setSendError(err.message || "Couldn't connect Google Calendar.");
      }
      return;
    }
    window.location.href = `${API_BASE_URL}${data.actions.secondaryUrl}`;
  }

  return (
    <AppFrame title={data?.topTitle || "Scheduling"} hasNotifications={data?.hasNotifications}>
      {loading && <PageState />}
      {!loading && error && (
        <PageState type="error" message={`Couldn't load scheduling. ${error}`} />
      )}

      {!loading && !error && data && candidate && (
        <div className="schedule-page">
          <aside className="schedule-side">
            <div className="schedule-side__candidate">
              <Avatar
                initials={candidate.initials}
                color={candidate.avatarColor}
                size={40}
              />
              <div>
                <h1>{candidate.name}</h1>
                <p>{candidate.summary}</p>
              </div>
            </div>

            {data.roundsLabel && (
              <h2 className="schedule-side__label">{data.roundsLabel}</h2>
            )}

            <div className="schedule-rounds">
              {rounds.map((round) => (
                <button
                  type="button"
                  className={`schedule-round${round.id === selectedRoundId ? " schedule-round--active" : ""}${
                    round.status === "Pending" ? " schedule-round--selectable" : ""
                  }`}
                  key={round.id || round.name}
                  disabled={round.status !== "Pending"}
                  onClick={() => setSelectedRoundId(round.id)}
                >
                  <Avatar
                    initials={round.initials}
                    color={round.avatarColor}
                    size={34}
                  />
                  <span className="schedule-round__text">
                    <strong>{round.name}</strong>
                    <span>{round.detail}</span>
                  </span>
                  <em className={`schedule-round__status schedule-round__status--${round.statusTone || "neutral"}`}>
                    {round.status}
                  </em>
                </button>
              ))}
            </div>

            {showAddRoundForm && (
              <form className="schedule-add-round" onSubmit={handleAddRound}>
                <input
                  type="text"
                  list="schedule-round-names"
                  placeholder="Round name"
                  aria-label="Round name"
                  value={roundForm.roundName}
                  onChange={(event) =>
                    setRoundForm((current) => ({ ...current, roundName: event.target.value }))
                  }
                />
                <datalist id="schedule-round-names">
                  {ROUND_NAME_OPTIONS.map((name) => (
                    <option value={name} key={name} />
                  ))}
                </datalist>
                <select
                  aria-label="Interviewer"
                  value={roundForm.interviewerId}
                  onChange={(event) =>
                    setRoundForm((current) => ({ ...current, interviewerId: event.target.value }))
                  }
                >
                  <option value="" disabled>Interviewer</option>
                  {interviewers.map((interviewer) => (
                    <option value={interviewer.id} key={interviewer.id}>
                      {interviewer.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Duration"
                  value={roundForm.durationMinutes}
                  onChange={(event) =>
                    setRoundForm((current) => ({ ...current, durationMinutes: event.target.value }))
                  }
                >
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                  <option value="90">90 min</option>
                </select>
                <div className="schedule-add-round__actions">
                  {rounds.length > 0 && (
                    <button type="button" onClick={() => setShowRoundForm(false)}>
                      Cancel
                    </button>
                  )}
                  <button type="submit" disabled={addingRound}>
                    {addingRound ? "Adding..." : "Add round"}
                  </button>
                </div>
              </form>
            )}

            {!showAddRoundForm && (
              <button
                type="button"
                className="schedule-add-round-toggle"
                onClick={() => setShowRoundForm(true)}
              >
                Add round
              </button>
            )}

            {selectedRound && (
              <div className="schedule-selection">
                <strong>{selectedRound.roundName}</strong>
                <span>{selectedRound.scheduledAt ? "Scheduled" : "Pending"}</span>
              </div>
            )}

            {data.warning && <div className="schedule-warning">{data.warning}</div>}
            {sendError && <div className="schedule-error">{sendError}</div>}

            <div className="schedule-side__actions">
              {data.actions?.secondary && (
                <button
                  type="button"
                  className="schedule-button"
                  disabled={!data.actions.secondaryUrl}
                  onClick={handleSecondaryAction}
                >
                  {data.actions.secondary}
                </button>
              )}
              {data.actions?.primary && (
                <button
                  type="button"
                  className="schedule-button schedule-button--primary"
                  disabled={sendingInvites || invitableRounds.length === 0}
                  onClick={handleSendInvites}
                >
                  {sendingInvites ? "Sending..." : data.actions.primary}
                </button>
              )}
            </div>
          </aside>

          <main className="schedule-main">
            <div className="schedule-calendar-header">
              <div className="schedule-calendar-header__left">
                <h2>{data.calendar?.dateLabel}</h2>
                <div className="schedule-modes">
                  {(data.calendar?.modes || []).map((mode) => (
                    <button
                      type="button"
                      className={calendarMode === mode.label ? "schedule-mode schedule-mode--active" : "schedule-mode"}
                      key={mode.label}
                      onClick={() => setCalendarMode(mode.label)}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                {data.calendar?.note && <span>{data.calendar.note}</span>}
              </div>

              <div className="schedule-legend">
                {(data.calendar?.legend || []).map((legend) => (
                  <span className={`schedule-legend__item schedule-legend__item--${legend.type}`} key={legend.label}>
                    {legend.label}
                  </span>
                ))}
              </div>
            </div>

            {columns.length === 0 ? (
              <section className="schedule-empty-shell">
                <h2>No rounds yet</h2>
              </section>
            ) : calendarMode === "Day" ? (
              <section className="schedule-grid-shell">
                <div className="schedule-grid schedule-grid--header" style={gridStyle}>
                  <div className="schedule-grid__corner" />
                  {columns.map((column) => (
                    <div className="schedule-person" key={column.id || column.name}>
                      <Avatar
                        initials={column.initials}
                        color={column.avatarColor}
                        size={28}
                      />
                      <span>
                        <strong>{column.name}</strong>
                        <small>{column.roundName}</small>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="schedule-grid schedule-grid--body" style={gridStyle}>
                  {rows.map((row) => (
                    <div className="schedule-grid__row" key={row.slotStart || row.timeLabel}>
                      <div className="schedule-time">{row.timeLabel}</div>
                      {(row.cells || []).map((cell, index) => (
                        <button
                          type="button"
                          className={`schedule-cell schedule-cell--${cell.type || "empty"}${
                            cell.canSchedule && cell.roundId === selectedRoundId ? " schedule-cell--action" : ""
                          }`}
                          key={`${row.slotStart || row.timeLabel}-${cell.columnId || index}`}
                          disabled={!cell.canSchedule || cell.roundId !== selectedRoundId || Boolean(schedulingRoundId)}
                          onClick={() => handleScheduleCell(cell)}
                          aria-label={
                            cell.canSchedule && cell.roundId === selectedRoundId
                              ? `Schedule ${cell.roundName} at ${cell.slotLabel}`
                              : undefined
                          }
                        >
                          {cell.label && <span>{cell.label}</span>}
                          {!cell.label && cell.canSchedule && cell.roundId === selectedRoundId && (
                            <span>Pick</span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="schedule-week-shell">
                <div className="schedule-week-metrics">
                  <article>
                    <span>Rounds</span>
                    <strong>{rounds.length}</strong>
                  </article>
                  <article>
                    <span>Confirmed</span>
                    <strong>{confirmedRounds.length}</strong>
                  </article>
                  <article>
                    <span>Busy blocks</span>
                    <strong>{busyCells}</strong>
                  </article>
                </div>
                <div className="schedule-week-list">
                  {rounds.map((round) => (
                    <div className="schedule-week-row" key={round.id || round.name}>
                      <Avatar initials={round.initials} color={round.avatarColor} size={30} />
                      <span>
                        <strong>{round.name}</strong>
                        <small>{round.detail}</small>
                      </span>
                      <em className={`schedule-round__status schedule-round__status--${round.statusTone || "neutral"}`}>
                        {round.status}
                      </em>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      )}
    </AppFrame>
  );
}
