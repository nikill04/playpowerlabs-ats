// Minimal outline icon set (stroke = currentColor) shared across pages.
// Keeping these as small functional components avoids repeating raw SVG
// markup inside Sidebar / TopBar / page files.

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function BriefcaseIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}

export function PipelineIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="6" height="16" rx="1.4" />
      <rect x="10.5" y="4" width="6" height="10" rx="1.4" />
      <rect x="18" y="4" width="3.2" height="6" rx="1.2" />
    </svg>
  );
}

export function InboxIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h4.5l1.5 3h6l1.5-3H21" />
      <path d="M5.5 5h13l2.5 7v7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19v-7l2.5-7Z" />
    </svg>
  );
}

export function UserIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4" />
    </svg>
  );
}

export function CalendarIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}

export function FileIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5V8h4" />
    </svg>
  );
}

export function ChartIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M2.5 20h19" />
    </svg>
  );
}

export function SearchIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.4-3.4" />
    </svg>
  );
}

export function BellIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.4 5.2 1.4 5.2H4.6S6 14 6 10Z" />
      <path d="M10.3 18.5a1.9 1.9 0 0 0 3.4 0" />
    </svg>
  );
}

export function ChevronDownIcon(props) {
  return (
    <svg {...base} width={14} height={14} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg {...base} width={14} height={14} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function LogoutIcon(props) {
  return (
    <svg {...base} width={16} height={16} {...props}>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M15 16l4-4-4-4" />
      <path d="M19 12H9" />
    </svg>
  );
}

export function TalonMark(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 5v8.2c0 3.1-2.5 5.6-5.6 5.6"
        stroke="#4F46E5"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M12 13.2c0 3.1 2.5 5.6 5.6 5.6"
        stroke="#4F46E5"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
