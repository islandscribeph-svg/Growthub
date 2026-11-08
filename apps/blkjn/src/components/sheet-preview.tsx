export function SheetPreview({
  columns,
}: {
  columns: readonly [string, string, string];
}) {
  return (
    <div className="sheet" aria-hidden="true">
      <div className="sheet-head">
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="sheet-body">
        {[0, 1, 2].map((row) => (
          <div className="sheet-row" key={row}>
            <span className="bar wide" />
            <span className="bar short" />
            <span className="bar wide" />
          </div>
        ))}
      </div>
    </div>
  );
}
