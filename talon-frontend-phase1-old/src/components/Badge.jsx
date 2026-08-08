import "./Badge.css";

/**
 * Small pill-shaped label. Reused across pages for stage/status tags
 * (e.g. "Onsite" on the login preview card, "Active" / "On hold" /
 * "Closing" on the Jobs page).
 */
export default function Badge({ children, tone = "default" }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
