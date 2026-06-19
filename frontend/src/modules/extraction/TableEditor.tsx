import { useCallback } from "react";
import type { TableData } from "@/shared/types";

interface TableEditorProps {
  data: TableData;
  onChange: (data: TableData) => void;
}

const cellInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "none",
  padding: "4px 6px",
  fontSize: 12,
  fontFamily: 'ui-monospace, "SF Mono", monospace',
  background: "transparent",
  color: "var(--text-primary)",
  outline: "none",
  minWidth: 60,
};

const headerInput: React.CSSProperties = {
  ...cellInput,
  color: "var(--text-primary)",
  fontWeight: 600,
};

const headerCell: React.CSSProperties = {
  background: "var(--bg-tertiary)",
  borderRight: "1px solid var(--border)",
  borderBottom: "1px solid var(--border)",
  minWidth: 70,
  position: "relative",
};

const dataCell: React.CSSProperties = {
  borderRight: "1px solid var(--border)",
  borderBottom: "1px solid var(--border)",
  minWidth: 70,
  position: "relative",
};

const deleteBtn: React.CSSProperties = {
  position: "absolute",
  top: 2,
  right: 2,
  width: 14,
  height: 14,
  border: "none",
  background: "#ef4444",
  color: "#fff",
  fontSize: 8,
  fontWeight: "bold",
  cursor: "pointer",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  zIndex: 10,
  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
};

const rowActionCell: React.CSSProperties = {
  borderRight: "1px solid var(--border)",
  borderBottom: "1px solid var(--border)",
  width: 28,
  textAlign: "center",
  verticalAlign: "middle",
  padding: 0,
};

const deleteRowBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#ef4444",
  fontSize: 12,
  cursor: "pointer",
  padding: 4,
  display: "inline-block",
  lineHeight: "12px",
  transition: "transform 0.1s",
};

const actionBtn: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 600,
  border: "1px solid var(--border-light)",
  borderRadius: 6,
  background: "var(--bg-tertiary)",
  cursor: "pointer",
  color: "var(--text-primary)",
  fontFamily: '"Plus Jakarta Sans", sans-serif',
};

export function TableEditor({ data, onChange }: TableEditorProps) {
  const { headings, rows } = data;

  const updateCell = useCallback(
    (rowIdx: number, colIdx: number, value: string) => {
      const newRows: string[][] = rows.map((r: string[], ri: number) =>
        ri === rowIdx ? r.map((c: string, ci: number) => (ci === colIdx ? value : c)) : r,
      );
      onChange({ headings, rows: newRows });
    },
    [headings, rows, onChange],
  );

  const updateHeading = useCallback(
    (colIdx: number, value: string) => {
      const newHeadings: string[] = headings.map((h: string, i: number) => (i === colIdx ? value : h));
      onChange({ headings: newHeadings, rows });
    },
    [headings, rows, onChange],
  );

  const addRow = useCallback(() => {
    const empty = headings.map(() => "");
    onChange({ headings, rows: [...rows, empty] });
  }, [headings, rows, onChange]);

  const addColumn = useCallback(() => {
    const newHeadings: string[] = [...headings, ""];
    const newRows: string[][] = rows.map((r: string[]) => [...r, ""]);
    onChange({ headings: newHeadings, rows: newRows });
  }, [headings, rows, onChange]);

  const deleteRow = useCallback(
    (rowIdx: number) => {
      if (rows.length <= 1) return;
      onChange({ headings, rows: rows.filter((_, i: number) => i !== rowIdx) });
    },
    [headings, rows, onChange],
  );

  const deleteColumn = useCallback(
    (colIdx: number) => {
      if (headings.length <= 1) return;
      const newHeadings: string[] = headings.filter((_, i: number) => i !== colIdx);
      const newRows: string[][] = rows.map((r: string[]) => r.filter((_, i: number) => i !== colIdx));
      onChange({ headings: newHeadings, rows: newRows });
    },
    [headings, rows, onChange],
  );

  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          fontSize: 12,
          fontFamily: '"Plus Jakarta Sans", sans-serif',
        }}
      >
        <thead>
          <tr>
            {headings.map((h: string, ci: number) => (
              <th key={`h-${ci}`} style={headerCell}>
                <input
                  style={headerInput}
                  value={h}
                  onChange={(e) => updateHeading(ci, e.target.value)}
                  placeholder={`Col ${ci + 1}`}
                />
                {headings.length > 1 && (
                  <button
                    style={deleteBtn}
                    onClick={() => deleteColumn(ci)}
                    title="Delete column"
                  >
                    ✕
                  </button>
                )}
              </th>
            ))}
            <th style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", width: 28 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row: string[], ri: number) => (
            <tr
              key={`r-${ri}`}
              style={{ background: ri % 2 === 1 ? "rgba(255, 255, 255, 0.02)" : "transparent" }}
            >
              {row.map((cell: string, ci: number) => (
                <td key={`c-${ri}-${ci}`} style={dataCell}>
                  <input
                    style={cellInput}
                    value={cell}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                    placeholder="—"
                  />
                </td>
              ))}
              <td style={rowActionCell}>
                {rows.length > 1 && (
                  <button
                    style={deleteRowBtn}
                    onClick={() => deleteRow(ri)}
                    title="Delete row"
                  >
                    🗑
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button style={actionBtn} onClick={addRow}>
          + Row
        </button>
        <button style={actionBtn} onClick={addColumn}>
          + Column
        </button>
      </div>
    </div>
  );
}
