import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearAuthToken, getJSON } from "../api/apiClient.js";
import Avatar from "./Avatar.jsx";
import {
  BriefcaseIcon,
  PipelineIcon,
  InboxIcon,
  UserIcon,
  CalendarIcon,
  FileIcon,
  ChartIcon,
  PlusIcon,
  LogoutIcon,
  TalonMark,
} from "./icons.jsx";
import "./Sidebar.css";

function NavItem({ to, icon: Icon, label, count }) {
  const content = (
    <>
      <Icon className="nav-item__icon" />
      <span className="nav-item__label">{label}</span>
      {typeof count === "number" && (
        <span className="nav-item__count">{count}</span>
      )}
    </>
  );

  if (!to) {
    return <span className="nav-item nav-item--disabled">{content}</span>;
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `nav-item${isActive ? " nav-item--active" : ""}`
      }
    >
      {content}
    </NavLink>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSidebar() {
      setLoading(true);
      setError(null);
      try {
        const json = await getJSON("/sidebar");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err.message || "Couldn't load navigation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSidebar();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = data?.counts || {};
  const user = data?.user;
  const links = data?.links || {};

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-left">
          <span className="sidebar__logo-mark">
            <TalonMark width={22} height={22} />
          </span>
          <span className="sidebar__logo-text">Talon</span>
        </div>
        <span className="sidebar__kbd">{"\u2318K"}</span>
      </div>

      <nav className="sidebar__nav">
        <div className="sidebar__section">
          <div className="sidebar__section-label">Recruit</div>
          <NavItem
            to={links.jobs || "/jobs"}
            icon={BriefcaseIcon}
            label="Jobs"
            count={counts.jobs}
          />
          <NavItem
            to={links.pipeline}
            icon={PipelineIcon}
            label="Pipeline"
            count={counts.pipeline}
          />
          <NavItem
            to={links.reviewInbox || "/review-inbox"}
            icon={InboxIcon}
            label="Review inbox"
            count={counts.reviewInbox}
          />
          <NavItem
            to={links.candidates}
            icon={UserIcon}
            label="Candidates"
          />
        </div>

        <div className="sidebar__section">
          <div className="sidebar__section-label">Coordinate</div>
          <NavItem
            to={links.scheduling}
            icon={CalendarIcon}
            label="Scheduling"
            count={counts.scheduling}
          />
          <NavItem
            to={links.offers}
            icon={FileIcon}
            label="Offers"
            count={counts.offers}
          />
        </div>

        <div className="sidebar__section">
          <div className="sidebar__section-label">Insights</div>
          <NavItem
            to={links.reports || "/reports"}
            icon={ChartIcon}
            label="Reports"
          />
        </div>
      </nav>

      <button
        type="button"
        className="sidebar__new-job"
        onClick={() => navigate("/jobs/new")}
      >
        <PlusIcon />
        New job
      </button>

      <div className="sidebar__footer">
        {loading && <div className="sidebar__footer-skeleton" />}

        {!loading && error && (
          <div className="sidebar__footer-error">Profile unavailable</div>
        )}

        {!loading && !error && user && (
          <>
            <div className="sidebar__footer-info">
              <Avatar
                initials={user.initials}
                color={user.avatarColor}
                size={32}
              />
              <div>
                <div className="sidebar__footer-name">{user.name}</div>
                <div className="sidebar__footer-role">{user.role}</div>
              </div>
            </div>
            <button
              type="button"
              className="sidebar__logout"
              aria-label="Log out"
              onClick={() => {
                clearAuthToken();
                navigate("/login", { replace: true });
              }}
            >
              <LogoutIcon />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
