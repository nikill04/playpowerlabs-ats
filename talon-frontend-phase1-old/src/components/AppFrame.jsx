import Sidebar from "./Sidebar.jsx";
import TopBar from "./TopBar.jsx";
import "./AppFrame.css";

export default function AppFrame({ title, hasNotifications = true, children }) {
  return (
    <div className="app-frame">
      <Sidebar />
      <div className="app-frame__main">
        <TopBar title={title} hasNotifications={hasNotifications} />
        {children}
      </div>
    </div>
  );
}
