import {
  isRouteErrorResponse,
  Link,
  useLocation,
  useRouteError,
} from "react-router-dom";
import { TalonMark } from "../components/icons.jsx";
import "./ErrorPage.css";

function stringifyDetail(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value?.message === "string") return value.message;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ErrorScreen({ status, title, message, details, canReload = false }) {
  return (
    <main className="error-page">
      <section className="error-page__surface" aria-labelledby="error-page-title">
        <div className="error-page__brand">
          <span className="error-page__mark">
            <TalonMark width={22} height={22} />
          </span>
          <span>Talon</span>
        </div>

        <div className="error-page__status">{status}</div>
        <h1 id="error-page-title">{title}</h1>
        <p>{message}</p>

        <div className="error-page__actions">
          <Link className="error-page__button error-page__button--primary" to="/jobs">
            Back to jobs
          </Link>
          {canReload && (
            <button
              className="error-page__button"
              type="button"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          )}
        </div>

        {details && import.meta.env.DEV && (
          <pre className="error-page__details">{details}</pre>
        )}
      </section>
    </main>
  );
}

export function NotFoundPage() {
  const location = useLocation();

  return (
    <ErrorScreen
      status="404 Not found"
      title="We couldn't find that page"
      message={`${location.pathname} does not match an available Talon page.`}
    />
  );
}

export function RouteErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    const detail = stringifyDetail(error.data);
    const isNotFound = error.status === 404;

    return (
      <ErrorScreen
        status={`${error.status} ${error.statusText || "Error"}`}
        title={isNotFound ? "We couldn't find that page" : "The request failed"}
        message={
          isNotFound
            ? "The URL does not match an available Talon page."
            : "The page could not finish loading. Try reloading or return to Jobs."
        }
        details={detail}
        canReload={!isNotFound}
      />
    );
  }

  const detail =
    error instanceof Error
      ? error.stack || error.message
      : stringifyDetail(error);

  return (
    <ErrorScreen
      status="Application error"
      title="Something went wrong"
      message="The page could not finish rendering. Reload the page or return to Jobs."
      details={detail}
      canReload
    />
  );
}
