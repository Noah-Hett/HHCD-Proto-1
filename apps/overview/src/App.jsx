import { useMemo, useState } from "react";
import { countBy, reports, yearRange } from "@hhcd/data";
import { Shell } from "@hhcd/shell";
import "@hhcd/shell/shell.css";

export default function App() {
  const [category, setCategory] = useState("All");
  const categories = useMemo(() => countBy("category"), []);
  const types = useMemo(() => countBy("projectType"), []);
  const years = useMemo(() => {
    const buckets = new Map();
    for (let year = yearRange.min; year <= yearRange.max; year += 1) {
      buckets.set(year, 0);
    }
    for (const report of reports) {
      if (typeof report.year === "number") {
        buckets.set(report.year, (buckets.get(report.year) ?? 0) + 1);
      }
    }
    return [...buckets.entries()].map(([label, count]) => ({ label, count }));
  }, []);

  const visible = reports.filter(
    (report) => category === "All" || report.category === category,
  );
  const maxCategory = Math.max(...categories.map((item) => item.count));
  const maxYear = Math.max(...years.map((item) => item.count), 1);

  return (
    <Shell title="Dataset overview">
      <div className="workspace">
        <div className="stat-strip">
          <span>
            <b>{reports.length}</b> reports
          </span>
          <span>
            <b>{categories.length}</b> categories
          </span>
          <span>
            <b>
              {yearRange.min}–{yearRange.max}
            </b>
          </span>
        </div>

        <section className="stats">
          <article>
            <h2>By category</h2>
            <ul className="bars">
              {categories.map((item) => (
                <li key={item.label}>
                  <button
                    className={category === item.label ? "active" : ""}
                    onClick={() =>
                      setCategory(category === item.label ? "All" : item.label)
                    }
                  >
                    <span className="label">{item.label}</span>
                    <span
                      className="bar"
                      style={{ width: `${(item.count / maxCategory) * 100}%` }}
                    />
                    <span className="count">{item.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </article>
          <article>
            <h2>By year</h2>
            <div className="years" aria-hidden="true">
              {years.map((item) => (
                <span
                  key={item.label}
                  title={`${item.label}: ${item.count}`}
                  style={{ height: `${8 + (item.count / maxYear) * 48}px` }}
                />
              ))}
            </div>
            <p className="year-range">
              {yearRange.min} — {yearRange.max}
            </p>
            <h2>Project types</h2>
            <p className="types">
              {types.map((item) => (
                <span key={item.label}>
                  {item.label} {item.count}
                </span>
              ))}
            </p>
          </article>
        </section>

        <section>
          <div className="list-head">
            <h2>
              {category === "All" ? "All reports" : category}
              <span> {visible.length}</span>
            </h2>
            {category !== "All" && (
              <button className="clear" onClick={() => setCategory("All")}>
                Clear filter
              </button>
            )}
          </div>
          <ul className="catalogue">
            {visible.map((report) => (
              <li key={report.reportNo}>
                <span className="year">{report.year}</span>
                <div>
                  <strong>{report.title}</strong>
                  <p>
                    {report.author}
                    {report.projectType ? ` · ${report.projectType}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}
