import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJSON, setAuthToken } from "../api/apiClient.js";
import "./Login.css";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [pendingToken, setPendingToken] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("token");
    const pending = params.get("pending_token");
    const callbackError = params.get("error");

    if (callbackError) {
      setError(callbackError);
      return;
    }

    if (token) {
      setAuthToken(token);
      navigate("/jobs", { replace: true });
      return;
    }

    if (pending) {
      setPendingToken(pending);
      return;
    }

    setError("The sign-in callback did not include a token.");
  }, [navigate]);

  async function handleVerify(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await postJSON("/auth/2fa/verify", {
        pending_token: pendingToken,
        code,
      });
      setAuthToken(result.token);
      navigate("/jobs", { replace: true });
    } catch (err) {
      setError(err.message || "Couldn't verify the code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-right" style={{ flex: 1 }}>
        <div className="login-form-wrap">
          <h2 className="login-form-wrap__title">Finishing sign in</h2>
          {!pendingToken && !error && (
            <p className="login-form-wrap__subtitle">Checking your Talon session.</p>
          )}
          {pendingToken && (
            <form onSubmit={handleVerify} noValidate>
              <p className="login-form-wrap__subtitle">
                Enter the code from your authenticator app.
              </p>
              <label className="field-label" htmlFor="oauth-two-factor-code">
                6-digit code
              </label>
              <input
                id="oauth-two-factor-code"
                type="text"
                className="field-input"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                autoComplete="one-time-code"
              />
              {error && <div className="form-error">{error}</div>}
              <button type="submit" className="signin-button" disabled={submitting}>
                {submitting ? "Verifying..." : "Verify code"}
              </button>
            </form>
          )}
          {!pendingToken && error && <div className="form-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
