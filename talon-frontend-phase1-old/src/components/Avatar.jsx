import "./Avatar.css";

/**
 * Colored initials circle. Used for job owners, assignees, the signed-in
 * user, etc. `color` is a hex/rgb string supplied by the API so each
 * person gets a stable color from the backend rather than being guessed
 * on the client.
 */
export default function Avatar({ initials, color = "#6B7280", size = 28 }) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initials}
    </div>
  );
}
