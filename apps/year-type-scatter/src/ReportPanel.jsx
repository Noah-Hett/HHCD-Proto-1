const FIELDS = [
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "year", label: "Year" },
  { key: "category", label: "Category" },
  { key: "projectType", label: "Project type" },
  { key: "description", label: "Description" },
  { key: "targetedUser", label: "Targeted user" },
  { key: "findings", label: "Findings" },
  { key: "outputs", label: "Outputs" },
  { key: "challenges", label: "Challenges" },
  { key: "budget", label: "Budget" },
  { key: "methods", label: "Methods" },
  { key: "website", label: "Website" },
  { key: "partner", label: "Partner" },
  { key: "reportNo", label: "Report no." },
];

function isEmpty(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return String(value).trim() === "";
}

function isLinkField(key) {
  return key === "website";
}

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(value);
}

function FieldValue({ field, value }) {
  if (Array.isArray(value)) {
    return <p>{value.join(", ")}</p>;
  }

  const text = String(value);
  if (isLinkField(field) && looksLikeUrl(text)) {
    return (
      <p>
        <a href={text} target="_blank" rel="noreferrer">
          {text}
        </a>
      </p>
    );
  }

  return <p>{text}</p>;
}

export default function ReportPanel({ cluster, onClose, closeRef }) {
  if (!cluster) return null;

  const heading =
    cluster.reports.length === 1
      ? cluster.reports[0].title
      : `${cluster.reports.length} reports`;

  return (
    <aside className="panel" aria-labelledby="panel-heading">
      <div className="panel-bar">
        <h2 id="panel-heading">{heading}</h2>
        <button
          ref={closeRef}
          type="button"
          className="panel-close"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="panel-body">
        {cluster.reports.map((report) => (
          <article key={report.reportNo} className="report">
            {FIELDS.filter((field) => !isEmpty(report[field.key])).map(
              (field) => (
                <section key={field.key} className="field">
                  <h3>{field.label}</h3>
                  <FieldValue field={field.key} value={report[field.key]} />
                </section>
              ),
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}
