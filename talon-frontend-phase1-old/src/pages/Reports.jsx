import { useMemo } from "react";
import { useApiResource } from "../api/useApiResource.js";
import AppFrame from "../components/AppFrame.jsx";
import PageState from "../components/PageState.jsx";
import "./Reports.css";

export default function Reports() {
  const { data, loading, error } = useApiResource("/reports");

  const trend = data?.interviewsTrend?.items || [];
  const maxTrendValue = useMemo(
    () => Math.max(1, ...trend.map((item) => Number(item.value) || 0)),
    [trend]
  );

  return (
    <AppFrame title={data?.topTitle || "Reports"} hasNotifications={data?.hasNotifications}>
      {loading && <PageState />}
      {!loading && error && (
        <PageState type="error" message={`Couldn't load reports. ${error}`} />
      )}

      {!loading && !error && data && (
        <main className="reports-page">
          <div className="reports-header">
            <h1>{data.title}</h1>
            {data.subtitle && <span>{data.subtitle}</span>}
          </div>

          <section className="reports-metrics">
            {(data.metrics || []).map((metric) => (
              <article className="reports-metric-card" key={metric.label}>
                <h2>{metric.label}</h2>
                <strong>{metric.value}</strong>
                {metric.delta && (
                  <span className={`reports-delta reports-delta--${metric.deltaTone || "success"}`}>
                    {metric.delta}
                  </span>
                )}
              </article>
            ))}
          </section>

          <section className="reports-grid">
            <article className="reports-card reports-conversion">
              <h2>{data.pipelineConversion?.title}</h2>
              <div className="reports-conversion__rows">
                {(data.pipelineConversion?.items || []).map((item) => (
                  <div className="reports-conversion-row" key={item.label}>
                    <span>{item.label}</span>
                    <div className="reports-conversion-row__track">
                      <em
                        style={{
                          width: `${item.percent || 0}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="reports-card reports-source">
              <h2>{data.hiresBySource?.title}</h2>
              <div className="reports-source__rows">
                {(data.hiresBySource?.items || []).map((item) => (
                  <div className="reports-source-row" key={item.label}>
                    <span
                      className="reports-source-row__dot"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="reports-card reports-trend">
            <div className="reports-trend__header">
              <h2>{data.interviewsTrend?.title}</h2>
              {data.interviewsTrend?.caption && (
                <span>{data.interviewsTrend.caption}</span>
              )}
            </div>
            <div
              className="reports-bars"
              style={{
                gridTemplateColumns: `repeat(${Math.max(trend.length, 1)}, minmax(0, 1fr))`,
              }}
            >
              {trend.map((item) => (
                <div className="reports-bar" key={item.label}>
                  <span>{item.value}</span>
                  <em
                    className={item.active ? "reports-bar__fill reports-bar__fill--active" : "reports-bar__fill"}
                    style={{
                      height: `${item.heightPercent || (Number(item.value) / maxTrendValue) * 100}%`,
                    }}
                  />
                  <strong>{item.label}</strong>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}
    </AppFrame>
  );
}
