import { reports, yearRange } from "@hhcd/data";
import manifest from "../../manifest.json";

const STATUS_LABEL = {
  live: "Live",
  draft: "Draft",
};

export default function App() {
  return (
    <div className="page">
      <header className="masthead">
        <p className="kicker">Helen Hamlyn Centre for Design</p>
        <h1>Report Atlas</h1>
        <p className="lede">
          Shared previews of graduate and associate research reports,
          {` ${reports.length} studies from ${yearRange.min}–${yearRange.max}.`}
          Each visualisation is its own small React app, hosted from this repo.
        </p>
      </header>

      <section className="apps">
        <h2>Visualisations</h2>
        <ul className="cards">
          {manifest.apps.map((app) => (
            <li key={app.id}>
              <a className="card" href={`./${app.id}/`}>
                <div className="card-meta">
                  <span className={`status status-${app.status}`}>
                    {STATUS_LABEL[app.status] ?? app.status}
                  </span>
                  <span>{app.owner}</span>
                </div>
                <h3>{app.title}</h3>
                <p>{app.goal}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="howto">
        <h2>Add another visualisation</h2>
        <ol>
          <li>
            From the repo root, run <code>pnpm new-app your-name</code>.
          </li>
          <li>
            Build it in <code>apps/your-name</code>. Keep other apps untouched.
          </li>
          <li>
            Push to <code>main</code>. GitHub Pages publishes it at
            {" "}
            <code>/your-name/</code> — no localhost required.
          </li>
        </ol>
      </section>
    </div>
  );
}
