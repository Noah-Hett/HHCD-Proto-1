export default function MethodFilter({ methods, selected, onToggle }) {
  return (
    <fieldset className="method-filter">
      <legend>Methods</legend>
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
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
