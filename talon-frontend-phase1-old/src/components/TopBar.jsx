import { SearchIcon, BellIcon } from "./icons.jsx";
import "./TopBar.css";

/**
 * Top header bar shared across authenticated pages.
 * `title` is the small page label on the left (e.g. "Jobs").
 * `hasNotifications` controls the red dot on the bell — passed in by the
 * page from data it already fetched, rather than fetched again here.
 */
export default function TopBar({ title, hasNotifications = true }) {
  const parts =
    typeof title === "string" && title.includes(" / ") ? title.split(" / ") : [];

  return (
    <header className="topbar">
      <div className="topbar__title">
        {parts.length > 0
          ? parts.map((part, index) => (
              <span
                className={
                  index === parts.length - 1
                    ? "topbar__title-current"
                    : "topbar__title-parent"
                }
                key={`${part}-${index}`}
              >
                {index > 0 && <span className="topbar__title-separator">/</span>}
                {part}
              </span>
            ))
          : title}
      </div>
      <div className="topbar__right">
        <div className="topbar__search">
          <SearchIcon className="topbar__search-icon" />
          <input type="text" placeholder="Search candidates, jobs" />
        </div>
        <button type="button" className="topbar__bell" aria-label="Notifications">
          <BellIcon />
          {hasNotifications && <span className="topbar__bell-dot" />}
        </button>
      </div>
    </header>
  );
}
