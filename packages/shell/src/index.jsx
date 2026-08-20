import { reports, yearRange } from "@hhcd/data";

export function Shell({ home = false, title, fill = false, children }) {
  return (
    <div className={fill ? "shell shell-fill" : "shell"}>
      <header className="shell-bar">
        {home ? (
          <>
            <span className="shell-wordmark">HHCD</span>
            <span className="shell-meta">
              {reports.length} reports · {yearRange.min}–{yearRange.max}
            </span>
          </>
        ) : (
          <nav className="shell-crumb">
            <a href="../">HHCD</a>
            <span className="shell-sep">/</span>
            <span>{title}</span>
          </nav>
        )}
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}
