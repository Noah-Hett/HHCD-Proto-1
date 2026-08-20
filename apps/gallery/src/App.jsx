import { Shell } from "@hhcd/shell";
import "@hhcd/shell/shell.css";
import manifest from "../../manifest.json";

export default function App() {
  return (
    <Shell home>
      <table className="index">
        <thead>
          <tr>
            <th>id</th>
            <th>title</th>
            <th>goal</th>
            <th>owner</th>
            <th>status</th>
          </tr>
        </thead>
        <tbody>
          {manifest.apps.map((app) => (
            <tr key={app.id}>
              <td>
                <a href={`./${app.id}/`}>{app.id}</a>
              </td>
              <td>{app.title}</td>
              <td>{app.goal}</td>
              <td>{app.owner}</td>
              <td>{app.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="foot">
        Add a page: ask a Cursor cloud agent to describe the visualisation you
        want.
      </p>
    </Shell>
  );
}
