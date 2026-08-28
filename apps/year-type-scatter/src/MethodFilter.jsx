import { useEffect, useId, useRef, useState } from "react";

export default function MethodFilter({ methods, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonId = useId();
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function onKey(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const selectedCount = selected.size;
  const label =
    selectedCount === 0
      ? "All methods"
      : selectedCount === 1
        ? [...selected][0]
        : `${selectedCount} methods`;

  return (
    <div className="method-filter" ref={rootRef}>
      <button
        type="button"
        id={buttonId}
        className="method-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="method-toggle-label">Methods</span>
        <span className="method-toggle-value">{label}</span>
      </button>
      {open ? (
        <div
          className="method-menu"
          id={menuId}
          role="listbox"
          aria-labelledby={buttonId}
          aria-multiselectable="true"
        >
          {selectedCount > 0 ? (
            <button type="button" className="method-clear" onClick={onClear}>
              Show all methods
            </button>
          ) : (
            <p className="method-hint">Select one or more to filter</p>
          )}
          <ul>
            {methods.map((method) => {
              const checked = selected.has(method.label);
              return (
                <li key={method.label}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(method.label)}
                    />
                    <span>{method.label}</span>
                    <span className="method-count">{method.count}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
