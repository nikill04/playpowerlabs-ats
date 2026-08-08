import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";
import { isLoggedIn } from "./api/apiClient.js";
import Login from "./pages/Login.jsx";
import AuthCallback from "./pages/AuthCallback.jsx";
import Jobs from "./pages/Jobs.jsx";
import Pipeline from "./pages/Pipeline.jsx";
import ReviewInbox from "./pages/ReviewInbox.jsx";
import CandidateDetail from "./pages/CandidateDetail.jsx";
import Scheduling from "./pages/Scheduling.jsx";
import OfferDetail from "./pages/OfferDetail.jsx";
import Reports from "./pages/Reports.jsx";
import NewJob from "./pages/NewJob.jsx";
import { NotFoundPage, RouteErrorPage } from "./pages/ErrorPage.jsx";

function RequireAuth() {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Outlet />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      { path: "login", element: <Login /> },
      { path: "auth/callback", element: <AuthCallback /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "jobs", element: <Jobs /> },
          { path: "jobs/new", element: <NewJob /> },
          { path: "pipeline/:jobId", element: <Pipeline /> },
          { path: "review-inbox", element: <ReviewInbox /> },
          { path: "candidates/:id", element: <CandidateDetail /> },
          { path: "scheduling/:appId", element: <Scheduling /> },
          { path: "offers/:id", element: <OfferDetail /> },
          { path: "reports", element: <Reports /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
