import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getJSON, postJSON, setAuthToken } from "../api/apiClient.js";
import { API_BASE_URL } from "../api/config.js";
import Badge from "../components/Badge.jsx";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const [highlights, setHighlights] = useState(null);
  const [highlightsLoading, setHighlightsLoading] = useState(true);
  const [highlightsError, setHighlightsError] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHighlights() {
      setHighlightsLoading(true);
      setHighlightsError(null);
      try {
        const data = await getJSON("/login/highlights");
        if (!cancelled) setHighlights(data);
      } catch (err) {
        if (!cancelled) {
          setHighlightsError(err.message || "Couldn't load workspace stats.");
        }
      } finally {
        if (!cancelled) setHighlightsLoading(false);
      }
    }

    loadHighlights();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignIn(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const data = pendingToken
        ? await postJSON("/auth/2fa/verify", {
            pending_token: pendingToken,
            code: twoFactorCode,
          })
        : await postJSON("/auth/login", { email, password });

      if (data.requires_2fa && data.pending_token) {
        setPendingToken(data.pending_token);
        setTwoFactorCode("");
        return;
      }

      if (!data.token) throw new Error("Login succeeded but no token was returned.");
      setAuthToken(data.token);
      navigate("/jobs");
    } catch (err) {
      setFormError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOAuth(provider) {
    if (provider === "saml") {
      setFormError("SAML SSO is not configured for this local workspace.");
      return;
    }
    window.location.href = `${API_BASE_URL}/auth/${provider}`;
  }

  const candidate = highlights?.candidate;
  const stats = highlights?.stats || [];

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-left__glow login-left__glow--one" />
        <div className="login-left__glow login-left__glow--two" />

        <div className="login-logo">
          <span className="login-logo__mark">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 5v8.2c0 3.1-2.5 5.6-5.6 5.6"
                stroke="#4F55CF"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M12 13.2c0 3.1 2.5 5.6 5.6 5.6"
                stroke="#4F55CF"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="login-logo__text">Talon</span>
        </div>

        <div className="login-hero">
          <h1 className="login-hero__title">Hiring, coordinated.</h1>
          <p className="login-hero__subtitle">
            One pipeline for every role, every interview, every offer. Your
            team stops chasing threads and starts closing candidates.
          </p>

          {highlightsLoading && (
            <div className="candidate-card candidate-card--skeleton">
              <div className="candidate-card__avatar candidate-card__avatar--skeleton" />
              <div className="candidate-card__info">
                <div className="skeleton-line skeleton-line--wide" />
                <div className="skeleton-line skeleton-line--narrow" />
              </div>
            </div>
          )}

          {!highlightsLoading && highlightsError && (
            <div className="candidate-card candidate-card--error">
              Couldn't load candidate preview.
            </div>
          )}

          {!highlightsLoading && !highlightsError && candidate && (
            <div className="candidate-card">
              <div className="candidate-card__avatar">{candidate.initials}</div>
              <div className="candidate-card__info">
                <div className="candidate-card__name">{candidate.name}</div>
                <div className="candidate-card__meta">{candidate.meta}</div>
              </div>
              <Badge>{candidate.status}</Badge>
            </div>
          )}
        </div>

        <div className="stats-bar">
          {highlightsLoading &&
            [0, 1, 2].map((i) => (
              <div className="stat stat--skeleton" key={i}>
                <div className="skeleton-line skeleton-line--stat" />
                <div className="skeleton-line skeleton-line--label" />
              </div>
            ))}

          {!highlightsLoading && highlightsError && (
            <div className="stats-bar__error">Stats unavailable right now.</div>
          )}

          {!highlightsLoading &&
            !highlightsError &&
            stats.map((stat) => (
              <div className="stat" key={stat.label}>
                <div className="stat__value">{stat.value}</div>
                <div className="stat__label">{stat.label}</div>
              </div>
            ))}
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-wrap">
          <h2 className="login-form-wrap__title">Welcome back</h2>
          <p className="login-form-wrap__subtitle">
            {pendingToken
              ? "Enter the code from your authenticator app."
              : "Sign in to your Talon workspace."}
          </p>

          {!pendingToken && (
            <>
              <button
                type="button"
                className="oauth-button"
                onClick={() => handleOAuth("google")}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
                  />
                </svg>
                Continue with Google
              </button>

              <button
                type="button"
                className="oauth-button"
                onClick={() => handleOAuth("saml")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="9"
                    rx="2"
                    stroke="#374151"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M8 11V8a4 4 0 0 1 8 0v3"
                    stroke="#374151"
                    strokeWidth="1.6"
                  />
                </svg>
                Continue with SAML SSO
              </button>

              <div className="divider">
                <span className="divider__line" />
                <span className="divider__text">or use email</span>
                <span className="divider__line" />
              </div>
            </>
          )}

          <form onSubmit={handleSignIn} noValidate>
            {pendingToken ? (
              <>
                <label className="field-label" htmlFor="two-factor-code">
                  6-digit code
                </label>
                <input
                  id="two-factor-code"
                  type="text"
                  className="field-input"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) =>
                    setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  autoComplete="one-time-code"
                />
              </>
            ) : (
              <>
                <label className="field-label" htmlFor="email">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  className="field-input"
                  placeholder="maya@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />

                <div className="field-label-row">
                  <label className="field-label" htmlFor="password">
                    Password
                  </label>
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={() => setFormError("Password reset is not configured for this local workspace.")}
                  >
                    Forgot?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  className="field-input"
                  placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </>
            )}

            {formError && <div className="form-error">{formError}</div>}

            <button type="submit" className="signin-button" disabled={submitting}>
              {submitting
                ? pendingToken
                  ? "Verifying..."
                  : "Signing in..."
                : pendingToken
                  ? "Verify code"
                  : "Sign in"}
            </button>
          </form>

          <p className="compliance-note">
            SOC 2 Type II {"\u00b7"} SSO enforced for admin roles
          </p>
        </div>
      </div>
    </div>
  );
}
