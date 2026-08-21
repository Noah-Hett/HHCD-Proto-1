export default function Tooltip({ cluster, x, y }) {
  if (!cluster) return null;

  return (
    <div
      className="tooltip"
      style={{ left: x, top: y }}
      role="tooltip"
    >
      {cluster.reports.map((report) => (
        <div key={report.reportNo} className="tooltip-item">
          <strong>{report.title}</strong>
          <span>{report.author}</span>
          <span className="tooltip-meta">
            {report.category} · {report.projectType}
          </span>
        </div>
      ))}
    </div>
  );
}
