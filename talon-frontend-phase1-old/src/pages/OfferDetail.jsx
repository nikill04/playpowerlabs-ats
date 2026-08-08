import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { postJSON } from "../api/apiClient.js";
import { useApiResource } from "../api/useApiResource.js";
import AppFrame from "../components/AppFrame.jsx";
import PageState from "../components/PageState.jsx";
import "./OfferDetail.css";

function RichText({ paragraph }) {
  if (typeof paragraph === "string") return paragraph;
  return (paragraph?.parts || []).map((part, index) =>
    part.bold ? (
      <strong key={`${part.text}-${index}`}>{part.text}</strong>
    ) : (
      <span key={`${part.text}-${index}`}>{part.text}</span>
    )
  );
}

export default function OfferDetail() {
  const { id } = useParams();
  const letterRef = useRef(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingAction, setPendingAction] = useState("");
  const [actionError, setActionError] = useState(null);
  const [showResponseActions, setShowResponseActions] = useState(false);
  const { data, loading, error } = useApiResource(`/offers/${id}${reloadKey ? `?v=${reloadKey}` : ""}`);

  const offer = data?.offer;
  const rows = offer?.rows || [];
  const approvalChain = offer?.approvalChain || [];
  const letter = offer?.letter;
  function refreshOffer() {
    setReloadKey((key) => key + 1);
  }

  async function handleSendForApproval() {
    if (pendingAction) return;

    setPendingAction("send-for-approval");
    setActionError(null);
    try {
      await postJSON(`/offers/${id}/send-for-approval`);
      refreshOffer();
    } catch (err) {
      setActionError(err.message || "Couldn't send this offer for approval.");
    } finally {
      setPendingAction("");
    }
  }

  async function handleSendOffer() {
    if (pendingAction) return;

    setPendingAction("send-offer");
    setActionError(null);
    try {
      await postJSON(`/offers/${id}/send`);
      refreshOffer();
    } catch (err) {
      setActionError(err.message || "Couldn't send this offer.");
    } finally {
      setPendingAction("");
    }
  }

  async function handleRecordResponse(status) {
    if (pendingAction) return;

    setPendingAction(`response:${status}`);
    setActionError(null);
    try {
      await postJSON(`/offers/${id}/respond`, { status });
      setShowResponseActions(false);
      refreshOffer();
    } catch (err) {
      setActionError(err.message || "Couldn't record this response.");
    } finally {
      setPendingAction("");
    }
  }

  function handlePrimaryAction() {
    const action = offer?.actions?.primary;
    if (action === "Send for approval") {
      handleSendForApproval();
      return;
    }
    if (action === "Send offer") {
      handleSendOffer();
      return;
    }
    if (action === "Record response") {
      setShowResponseActions((open) => !open);
      setActionError(null);
      return;
    }
    setActionError("This offer is waiting on pending approvers.");
  }

  function handlePreviewLetter() {
    letterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleApprovalDecision(approvalId, status) {
    if (!approvalId || pendingAction) return;

    setPendingAction(`${approvalId}:${status}`);
    setActionError(null);
    try {
      await postJSON(`/offer-approvals/${approvalId}/decide`, { status });
      refreshOffer();
    } catch (err) {
      setActionError(err.message || "Couldn't update this approval.");
    } finally {
      setPendingAction("");
    }
  }

  return (
    <AppFrame title={data?.topTitle || "Offer"} hasNotifications={data?.hasNotifications}>
      {loading && <PageState />}
      {!loading && error && (
        <PageState type="error" message={`Couldn't load offer. ${error}`} />
      )}

      {!loading && !error && data && offer && (
        <main className="offer-page">
          <div className="offer-page__header">
            <div className="offer-page__title-row">
              <h1>{offer.title}</h1>
              {offer.statusLabel && (
                <span className={`offer-status offer-status--${offer.statusTone || "warning"}`}>
                  {offer.statusLabel}
                </span>
              )}
            </div>
            {offer.versionLabel && <span>{offer.versionLabel}</span>}
          </div>

          <div className="offer-layout">
            <section className="offer-left">
              <div className="offer-card offer-summary-card">
                {rows.map((row) => (
                  <div className="offer-summary-row" key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                    {row.badge && <em>{row.badge}</em>}
                  </div>
                ))}

                <div className="offer-summary-actions">
                  {offer.actions?.primary && (
                    <button
                      type="button"
                      className="offer-button offer-button--primary"
                      disabled={Boolean(pendingAction)}
                      onClick={handlePrimaryAction}
                    >
                      {offer.actions.primary}
                    </button>
                  )}
                  {offer.actions?.secondary && (
                    <button type="button" className="offer-button" onClick={handlePreviewLetter}>
                      {offer.actions.secondary}
                    </button>
                  )}
                </div>
                {showResponseActions && (
                  <div className="offer-response-actions">
                    <button
                      type="button"
                      className="offer-response-actions__accept"
                      disabled={Boolean(pendingAction)}
                      onClick={() => handleRecordResponse("Accepted")}
                    >
                      Accepted
                    </button>
                    <button
                      type="button"
                      className="offer-response-actions__decline"
                      disabled={Boolean(pendingAction)}
                      onClick={() => handleRecordResponse("Declined")}
                    >
                      Declined
                    </button>
                  </div>
                )}
                {actionError && <div className="offer-action-error">{actionError}</div>}
              </div>

              {offer.approvalTitle && (
                <h2 className="offer-section-label">{offer.approvalTitle}</h2>
              )}

              <div className="offer-approval-list">
                {approvalChain.map((item) => (
                  <div className="offer-approval-row" key={item.id || item.name}>
                    <span className={`offer-approval-row__dot offer-approval-row__dot--${item.statusTone || "neutral"}`} />
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.role}</p>
                    </div>
                    <em className={`offer-approval-row__status offer-approval-row__status--${item.statusTone || "neutral"}`}>
                      {item.status}
                    </em>
                    {item.decisionActions && (
                      <span className="offer-approval-row__actions">
                        <button
                          type="button"
                          className="offer-approval-decision offer-approval-decision--approve"
                          disabled={Boolean(pendingAction)}
                          onClick={() => handleApprovalDecision(item.id, "Approved")}
                        >
                          {item.decisionActions.approve}
                        </button>
                        <button
                          type="button"
                          className="offer-approval-decision offer-approval-decision--reject"
                          disabled={Boolean(pendingAction)}
                          onClick={() => handleApprovalDecision(item.id, "Rejected")}
                        >
                          {item.decisionActions.reject}
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {letter && (
              <section className="offer-letter" ref={letterRef}>
                <h2>{letter.title}</h2>
                {(letter.paragraphs || []).map((paragraph, index) => (
                  <p key={index}>
                    <RichText paragraph={paragraph} />
                  </p>
                ))}
                {letter.closing?.length > 0 && (
                  <div className="offer-letter__closing">
                    {letter.closing.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      )}
    </AppFrame>
  );
}
