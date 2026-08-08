import "./ProgressBar.css";

/**
 * Segmented pipeline progress bar.
 * `segments` = [{ label, value, color }, ...] — widths are proportional
 * to each segment's value out of the segment total. All values come from
 * the API; nothing here is hardcoded.
 */
export default function ProgressBar({ segments = [] }) {
  const total = segments.reduce((sum, s) => sum + (s.value || 0), 0);

  return (
    <div className="progress-bar">
      {total > 0 ? (
        segments.map((s, i) => (
          <span
            key={s.label || i}
            className="progress-bar__segment"
            style={{
              width: `${(s.value / total) * 100}%`,
              backgroundColor: s.color,
            }}
          />
        ))
      ) : (
        <span className="progress-bar__segment progress-bar__segment--empty" />
      )}
    </div>
  );
}
