/*
  Report fields from @hhcd/data:
  reportNo, category, title, author, year, description, projectType,
  targetedUser, findings, outputs, challenges, budget,
  methodsPrimary[], website, partner, connections, contact.

  Helpers: reports, categories, projectTypes, yearRange, countBy(key).
*/
import { reports } from "@hhcd/data";
import { Shell } from "@hhcd/shell";
import "@hhcd/shell/shell.css";

export default function App() {
  return (
    <Shell title="New visualisation">
      <p className="hint">{reports.length} reports from @hhcd/data</p>
      <div className="canvas">Your visualisation</div>
    </Shell>
  );
}
