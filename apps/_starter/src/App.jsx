import { useMemo, useState } from "react";
import { reports } from "@hhcd/data";

export default function App() {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return reports.slice(0, 8);
    return reports
      .filter((report) =>
        [report.title, report.author, report.category, report.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 12);
  }, [query]);

  return (
    <div className="page">
      <p className="back">
        <a href="../">Report Atlas</a>
      </p>
      <p className="banner">Starter template — replace this view with your visualisation.</p>
      <h1>New visualisation</h1>
      <p className="lede">
        Import the shared catalogue from <code>@hhcd/data</code>. Search is only
        here to prove the data is wired up.
      </p>
      <label>
        Search reports
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="title, author, category…"
        />
      </label>
      <ul>
        {matches.map((report) => (
          <li key={report.reportNo}>
            <strong>{report.title}</strong>
            <span>
              {report.year} · {report.author}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
