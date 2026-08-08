import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJSON } from "../api/apiClient.js";
import { useApiResource } from "../api/useApiResource.js";
import AppFrame from "../components/AppFrame.jsx";
import PageState from "../components/PageState.jsx";
import "./NewJob.css";

function formatActionLabel(label = "") {
  return label.replace(/<-/g, "\u2190").replace(/->/g, "\u2192");
}

export default function NewJob() {
  const navigate = useNavigate();
  const { data, loading, error } = useApiResource("/jobs/new");
  const [form, setForm] = useState({
    title: "",
    department: "",
    location: "",
    bandMin: "",
    bandMax: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!data?.form) return;
    setForm({
      title: data.form.defaults?.title || "",
      department:
        data.form.defaults?.department ||
        data.form.departments?.find((item) => item.selected)?.value ||
        data.form.departments?.[0]?.value ||
        "",
      location:
        data.form.defaults?.location ||
        data.form.locations?.find((item) => item.selected)?.value ||
        data.form.locations?.[0]?.value ||
        "",
      bandMin: data.form.defaults?.bandMin || "",
      bandMax: data.form.defaults?.bandMax || "",
    });
  }, [data]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await postJSON("/jobs", {
        title: form.title,
        department: form.department,
        location: form.location,
        band_min: form.bandMin,
        band_max: form.bandMax,
      });
      if (created.id) navigate(`/pipeline/${created.id}`);
    } catch (err) {
      setSubmitError(err.message || "Couldn't continue.");
    } finally {
      setSubmitting(false);
    }
  }

  const pageTitle = data?.title || "New job";
  const pageForm = data?.form;

  return (
    <AppFrame title={data?.topTitle || pageTitle} hasNotifications={data?.hasNotifications}>
      {loading && <PageState />}
      {!loading && error && (
        <PageState type="error" message={`Couldn't load new job form. ${error}`} />
      )}

      {!loading && !error && data && pageForm && (
        <main className="new-job-page">
          <div className="new-job-shell">
            <div className="new-job-header">
              <div className="new-job-header__title">
                <h1>{pageTitle}</h1>
                {data.stepLabel && <span>{data.stepLabel}</span>}
              </div>
              {data.actions?.cancel && (
                <button
                  type="button"
                  className="new-job-cancel"
                  onClick={() => navigate("/jobs")}
                >
                  {data.actions.cancel}
                </button>
              )}
            </div>

            <div className="new-job-steps">
              {(data.steps || []).map((step) => (
                <button
                  type="button"
                  className={`new-job-step${step.active ? " new-job-step--active" : ""}`}
                  key={step.label}
                  disabled={!step.active}
                  aria-current={step.active ? "step" : undefined}
                >
                  <span>{step.number}</span>
                  {step.label}
                </button>
              ))}
            </div>

            <form className="new-job-form" onSubmit={handleSubmit}>
              <label className="new-job-field">
                <span>{pageForm.titleLabel}</span>
                <input
                  type="text"
                  value={form.title}
                  placeholder={pageForm.titlePlaceholder || ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </label>

              <fieldset className="new-job-chip-group">
                <legend>{pageForm.departmentLabel}</legend>
                <div>
                  {(pageForm.departments || []).map((department) => (
                    <button
                      type="button"
                      className={`new-job-chip${
                        form.department === department.value ? " new-job-chip--active" : ""
                      }`}
                      key={department.value}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          department: department.value,
                        }))
                      }
                    >
                      {department.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="new-job-chip-group">
                <legend>{pageForm.locationLabel}</legend>
                <div>
                  {(pageForm.locations || []).map((location) => (
                    <button
                      type="button"
                      className={`new-job-chip${
                        form.location === location.value ? " new-job-chip--active" : ""
                      }`}
                      key={location.value}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          location: location.value,
                        }))
                      }
                    >
                      {location.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="new-job-salary-row">
                <label className="new-job-field">
                  <span>{pageForm.bandMinLabel}</span>
                  <input
                    type="number"
                    value={form.bandMin}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bandMin: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="new-job-field">
                  <span>{pageForm.bandMaxLabel}</span>
                  <input
                    type="number"
                    value={form.bandMax}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bandMax: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              {submitError && <div className="new-job-error">{submitError}</div>}
            </form>

            <div className="new-job-actions">
              {data.actions?.back && (
                <button
                  type="button"
                  className="new-job-nav-button"
                  onClick={() => navigate("/jobs")}
                >
                  {formatActionLabel(data.actions.back)}
                </button>
              )}
              {data.actions?.continue && (
                <button
                  type="submit"
                  className="new-job-nav-button new-job-nav-button--primary"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting
                    ? data.actions.submitting || formatActionLabel(data.actions.continue)
                    : formatActionLabel(data.actions.continue)}
                </button>
              )}
            </div>
          </div>
        </main>
      )}
    </AppFrame>
  );
}
