import { useState } from "react";
import { useParams } from "react-router-dom";
import { postJSON } from "../api/apiClient.js";
import { API_BASE_URL } from "../api/config.js";
import { useApiResource } from "../api/useApiResource.js";
import AppFrame from "../components/AppFrame.jsx";
import Avatar from "../components/Avatar.jsx";
import PageState from "../components/PageState.jsx";
import "./Scheduling.css";

export default function Scheduling() {
  const { appId } = useParams();
  const [reloadKey, setReloadKey] = useState(0);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [sendError, setSendError] = useState(null);
  const { data, loading, error } = useApiResource(`/scheduling/${appId}${reloadKey ? `?v=${reloadKey}` : ""}`);

  const candidate = data?.candidate;
  const rounds = data?.rounds || [];
  const pendingRounds = rounds.filter((round) => round.id && round.status === "Pending");
  const columns = data?.calendar?.columns || [];
  const rows = data?.calendar?.rows || [];
  const gridStyle = {
    gridTemplateColumns: `68px repeat(${Math.max(columns.length, 1)}, minmax(180px, 1fr))`,
  };

  async function handleSendInvites() {
    if (sendingInvites || pendingRounds.length === 0) return;

    setSendingInvites(true);
    setSendError(null);
    try {
      await Promise.all(
        pendingRounds.map((round) => postJSON(`/interviews/${round.id}/send-invites`))
      );
      setReloadKey((key) => key + 1);
    } catch (err) {
      setSendError(err.message || "Couldn't send invites.");
    } finally {
      setSendingInvites(false);
    }
  }

  function handleSecondaryAction() {
    if (!data?.actions?.secondaryUrl) return;
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
                <div className="schedule-round" key={round.id || round.name}>
                  <Avatar
                    initials={round.initials}
                    color={round.avatarColor}
                    size={34}
                  />
                  <div className="schedule-round__text">
                    <strong>{round.name}</strong>
                    <span>{round.detail}</span>
                  </div>
                  <em className={`schedule-round__status schedule-round__status--${round.statusTone || "neutral"}`}>
                    {round.status}
                  </em>
                </div>
              ))}
            </div>

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
                  disabled={sendingInvites || pendingRounds.length === 0}
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
                      className={mode.active ? "schedule-mode schedule-mode--active" : "schedule-mode"}
                      key={mode.label}
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
                    <strong>{column.name}</strong>
                  </div>
                ))}
              </div>

              <div className="schedule-grid schedule-grid--body" style={gridStyle}>
                {rows.map((row) => (
                  <div className="schedule-grid__row" key={row.timeLabel}>
                    <div className="schedule-time">{row.timeLabel}</div>
                    {(row.cells || []).map((cell, index) => (
                      <div
                        className={`schedule-cell schedule-cell--${cell.type || "empty"}`}
                        key={`${row.timeLabel}-${cell.columnId || index}`}
                      >
                        {cell.label && <span>{cell.label}</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>
      )}
    </AppFrame>
  );
}
