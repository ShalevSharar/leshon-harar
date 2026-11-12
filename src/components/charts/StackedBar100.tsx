// שורה לכל שאלה: פס 100% מוערם של התשובות 1-5, משמאל שלילי (אדום/אפרסק), באמצע ניטרלי, מימין חיובי.
// אחוזים מוצגים בתוך הפס רק כששטח הקטע מספיק גדול, והערך המספרי תמיד נשמר בטקסט הנגיש.

const COLORS = ['var(--danger)', 'var(--peach)', 'var(--line)', 'var(--sky)', 'var(--accent)'];

export type StackedRow = { id: string; label: string; counts: number[]; avg: number | null; topBox: number | null };

export default function StackedBar100({ rows, onRowClick, activeId }: {
  rows: StackedRow[];
  onRowClick?: (id: string) => void;
  activeId?: string | null;
}) {
  if (!rows.length) return <p className="muted">אין שאלות סולם להצגה.</p>;
  return (
    <div className="stacked">
      <div className="stacked-legend">
        {['1 בכלל לא', '2', '3', '4', '5 במידה רבה'].map((t, i) => (
          <span key={t}><i style={{ background: COLORS[i] }} /> {t}</span>
        ))}
      </div>
      {rows.map((r) => {
        const total = r.counts.reduce((a, b) => a + b, 0);
        return (
          <button
            key={r.id}
            type="button"
            className={`stacked-row ${activeId === r.id ? 'active' : ''}`}
            onClick={() => onRowClick?.(r.id)}
            aria-expanded={activeId === r.id}
          >
            <span className="stacked-label">{r.label}</span>
            <span className="stacked-bar" role="img" aria-label={`${r.label}: ${r.counts.join(', ')}`}>
              {total > 0 && r.counts.map((c, i) => {
                const pct = (c / total) * 100;
                return (
                  <span key={i} style={{ width: `${pct}%`, background: COLORS[i] }} title={`${i + 1}: ${c}`}>
                    {pct >= 8 ? `${Math.round(pct)}%` : ''}
                  </span>
                );
              })}
            </span>
            <span className="stacked-meta">
              {r.avg !== null ? <strong>{r.avg.toFixed(1)}</strong> : '—'}
              <span className="muted"> · {r.topBox !== null ? `${r.topBox}%` : ''}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
