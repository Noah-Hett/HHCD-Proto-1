import { useEffect, useMemo, useRef, useState } from "react";
import { reports } from "@hhcd/data";
import { Shell } from "@hhcd/shell";
import "@hhcd/shell/shell.css";
import ArchiveScene from "./ArchiveScene.jsx";
import {
  GROUPINGS,
  findReport,
  folderForReport,
  groupReports,
} from "./grouping.js";

const STACKED_QUERY = "(max-width: 860px)";

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function groupingLabel(id) {
  return GROUPINGS.find((item) => item.id === id)?.label ?? id;
}

export default function App() {
  const detailHeadingRef = useRef(null);
  const lastTriggerRef = useRef(null);
  const listButtonRef = useRef(null);
  const [grouping, setGrouping] = useState("theme");
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedReportNo, setSelectedReportNo] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(prefersReducedMotion);
  const [webglFailed, setWebglFailed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [stacked, setStacked] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(STACKED_QUERY).matches
      : false,
  );
  const [listOpen, setListOpen] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(STACKED_QUERY).matches
      : false,
  );

  const folders = useMemo(() => groupReports(grouping), [grouping]);
  const selectedReport = selectedReportNo
    ? findReport(selectedReportNo)
    : null;
  const selectedFolder =
    folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const groupingMeta = GROUPINGS.find((item) => item.id === grouping);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduceMotion(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(STACKED_QUERY);
    const onChange = () => {
      const next = media.matches;
      setStacked(next);
      setListOpen(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const next = folderForReport(grouping, selectedReportNo);
    if (selectedReportNo && next) {
      setSelectedFolderId(next.id);
      return;
    }
    if (
      selectedFolderId &&
      !folders.some((folder) => folder.id === selectedFolderId)
    ) {
      setSelectedFolderId(null);
    }
  }, [grouping, selectedReportNo, folders, selectedFolderId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setAnnouncement(
        `Shelves regrouped by ${groupingLabel(grouping)}. ${folders.length} folders, ${reports.length} reports.`,
      );
    }, 350);
    return () => window.clearTimeout(handle);
  }, [grouping, folders.length]);

  const goToGrouping = (id) => {
    setGrouping(id);
  };

  const openList = () => {
    setListOpen(true);
  };

  const toggleList = () => {
    setListOpen((open) => {
      const next = !open;
      setAnnouncement(next ? "Folder list shown." : "Folder list hidden.");
      return next;
    });
  };

  const selectFolder = (id, trigger) => {
    if (trigger) lastTriggerRef.current = trigger;
    if (!id || id === selectedFolderId) {
      setSelectedFolderId(null);
      setSelectedReportNo(null);
      return;
    }
    setSelectedFolderId(id);
    setSelectedReportNo(null);
  };

  const selectReport = (reportNo, trigger) => {
    if (trigger) lastTriggerRef.current = trigger;
    if (!reportNo) {
      setSelectedReportNo(null);
      return;
    }
    if (reportNo === selectedReportNo) {
      setSelectedReportNo(null);
      return;
    }
    const folder = folderForReport(grouping, reportNo);
    setSelectedFolderId(folder?.id ?? null);
    setSelectedReportNo(reportNo);
    setListOpen(true);
    const report = findReport(reportNo);
    if (report) {
      setAnnouncement(
        `Opened ${report.title} by ${report.author}, ${report.year}.`,
      );
      window.setTimeout(() => detailHeadingRef.current?.focus(), 0);
    }
  };

  const closeDetail = () => {
    setSelectedReportNo(null);
    lastTriggerRef.current?.focus?.();
  };

  const hint =
    "Use Theme, Year, or Project type to regroup. Tap a folder to zoom in; tap a risen report to open it. The list has every report.";

  return (
    <Shell fill title="Project folders">
      <div
        className={`archive ${stacked ? "is-stacked" : "is-wide"} ${listOpen ? "is-list-open" : "is-list-closed"}`}
      >
        <a
          className="skip-link"
          href="#folder-index"
          onClick={(event) => {
            if (listOpen) return;
            event.preventDefault();
            openList();
            window.setTimeout(() => {
              document.getElementById("folder-index")?.scrollIntoView();
            }, 50);
          }}
        >
          Skip 3D scene, browse folders as a list
        </a>
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>

        <header className="archive-bar">
          <fieldset className="grouping-tabs">
            <legend className="sr-only">Regroup the archive</legend>
            {GROUPINGS.map((item) => (
              <label
                key={item.id}
                className={grouping === item.id ? "is-active" : ""}
              >
                <input
                  type="radio"
                  name="archive-grouping"
                  value={item.id}
                  checked={grouping === item.id}
                  onChange={() => goToGrouping(item.id)}
                />
                {item.label}
              </label>
            ))}
          </fieldset>
          <div className="archive-bar-end">
            <p className="scene-status">
              {reports.length} reports · {folders.length} folders
            </p>
            <button
              type="button"
              className="list-toggle"
              ref={listButtonRef}
              aria-expanded={listOpen}
              aria-controls="archive-panel"
              onClick={toggleList}
            >
              {listOpen ? "Hide list" : "Show list"}
            </button>
          </div>
        </header>

        <div className="stage">
          <div className="stage-visual">
            {webglFailed ? (
              <div className="webgl-fallback" role="status">
                <p>
                  The 3D archive could not start in this browser. The folder
                  list on this page has the same reports and grouping.
                </p>
              </div>
            ) : (
              <ArchiveScene
                grouping={grouping}
                reduceMotion={reduceMotion}
                selectedFolderId={selectedFolderId}
                selectedReportNo={selectedReportNo}
                onSelectFolder={(id) => selectFolder(id)}
                onSelectReport={(reportNo) => selectReport(reportNo)}
                onWebglError={() => setWebglFailed(true)}
              />
            )}
            <p className="scene-hint">{hint}</p>
          </div>

          <aside
            className="panel"
            id="archive-panel"
            hidden={!listOpen}
            aria-label="Folder list and report details"
          >
            <div className="panel-scroll">
              {selectedReport ? (
                <ReportDetail
                  report={selectedReport}
                  headingRef={detailHeadingRef}
                  onBack={closeDetail}
                  folderLabel={selectedFolder?.label}
                />
              ) : (
                <FolderIndex
                  groupingMeta={groupingMeta}
                  folders={folders}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={selectFolder}
                  onSelectReport={selectReport}
                />
              )}
            </div>
            <div className="panel-footer">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={reduceMotion}
                  onChange={(event) => setReduceMotion(event.currentTarget.checked)}
                />
                Reduce motion
              </label>
            </div>
          </aside>
        </div>
      </div>
    </Shell>
  );
}

function FolderIndex({
  groupingMeta,
  folders,
  selectedFolderId,
  onSelectFolder,
  onSelectReport,
}) {
  return (
    <div>
      <h1 className="panel-title">Project folders</h1>
      <p className="panel-lead">
        {groupingMeta?.description} The shelves show a peek of documents in
        each folder — this list is the full set. Jackets are mostly
        paper-white, with a few tinted covers; colour is decorative, not a
        theme code.
      </p>

      <h2 className="panel-kicker" id="folder-heading">
        Folders by {groupingMeta?.label?.toLowerCase()}
      </h2>
      <ul className="folder-list" id="folder-index">
        {folders.map((folder) => {
          const open = folder.id === selectedFolderId;
          return (
            <li key={folder.id}>
              <button
                type="button"
                className={`folder-btn ${open ? "is-open" : ""}`}
                aria-expanded={open}
                aria-controls={`folder-reports-${folder.id}`}
                onClick={(event) => onSelectFolder(folder.id, event.currentTarget)}
              >
                <span className="folder-btn-label">{folder.label}</span>
                <span className="folder-btn-count">
                  {folder.count} {folder.count === 1 ? "report" : "reports"}
                </span>
              </button>
              <ul
                id={`folder-reports-${folder.id}`}
                className="report-list"
                hidden={!open}
              >
                {folder.reports.map((report) => (
                  <li key={report.reportNo}>
                    <button
                      type="button"
                      className="report-btn"
                      onClick={(event) =>
                        onSelectReport(report.reportNo, event.currentTarget)
                      }
                    >
                      <span className="report-btn-meta">
                        {report.year}
                        <span aria-hidden="true"> · </span>
                        <span className="sr-only">Theme: </span>
                        {report.category}
                      </span>
                      <span className="report-btn-title">{report.title}</span>
                      <span className="report-btn-author">{report.author}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      <p className="panel-footnote">
        Keyboard: Theme, Year, and Project type regroup the shelves. Folder
        buttons expand the list. Enter opens a report. Escape closes the
        detail pane. Show list keeps this catalogue available when the 3D
        stage is zoomed.
      </p>
    </div>
  );
}

function ReportDetail({ report, headingRef, onBack, folderLabel }) {
  useEscape(onBack);

  return (
    <article className="detail" aria-labelledby="report-heading">
      <button type="button" className="back-btn" onClick={onBack}>
        Back to {folderLabel || "folders"}
      </button>
      <p className="detail-meta">
        Report {report.reportNo}
        {report.year != null ? ` · ${report.year}` : ""}
        {report.category ? ` · ${report.category}` : ""}
      </p>
      <h2 id="report-heading" className="detail-title" tabIndex={-1} ref={headingRef}>
        {report.title}
      </h2>
      <p className="detail-author">{report.author}</p>
      {report.projectType && (
        <p className="detail-type">Project type: {report.projectType}</p>
      )}
      {report.description && <p className="detail-body">{report.description}</p>}
      <DefinitionList report={report} />
    </article>
  );
}

function DefinitionList({ report }) {
  const rows = [
    ["Targeted user", report.targetedUser],
    ["Findings", report.findings],
    ["Outputs", report.outputs],
    ["Challenges", report.challenges],
    ["Budget", report.budget],
    [
      "Methods",
      Array.isArray(report.methodsPrimary) && report.methodsPrimary.length
        ? report.methodsPrimary.join(", ")
        : null,
    ],
    ["Partner", report.partner],
    ["Connections", report.connections],
  ].filter(([, value]) => value);

  return (
    <div>
      {rows.map(([label, value]) => (
        <div className="field" key={label}>
          <h3 className="field-label">{label}</h3>
          <p className="field-value">{value}</p>
        </div>
      ))}
      {isHttpUrl(report.website) && (
        <p className="field">
          <a href={report.website} rel="noopener noreferrer" target="_blank">
            Project website (opens in a new tab)
          </a>
        </p>
      )}
      {isHttpUrl(report.contact) && (
        <p className="field">
          <a href={report.contact} rel="noopener noreferrer" target="_blank">
            Author contact (opens in a new tab)
          </a>
        </p>
      )}
    </div>
  );
}

function useEscape(onEscape) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);
}
