import "./PageState.css";

export default function PageState({ type = "loading", message }) {
  if (type === "loading") {
    return (
      <div className="page-state">
        <div className="page-state__skeleton page-state__skeleton--wide" />
        <div className="page-state__skeleton" />
        <div className="page-state__skeleton page-state__skeleton--short" />
      </div>
    );
  }

  return (
    <div className={`page-state page-state--${type}`}>
      {message || "Couldn't load this page."}
    </div>
  );
}
