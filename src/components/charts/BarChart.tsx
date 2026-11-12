// גרף עמודות פשוט ב-SVG, בלי ספרייה חיצונית. צבעים מתוך משתני העיצוב.
// אם אין נתונים (כל הערכים 0) מוצגת הודעה במקום גרף ריק.

export type Series = { name: string; color: string; values: number[] };

export default function BarChart({ labels, series, height = 220 }: {
  labels: string[];
  series: Series[];
  height?: number;
}) {
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  if (!labels.length || max === 0) {
    return <p className="muted">אין עדיין נתונים לתקופה הזו.</p>;
  }

  const W = Math.max(360, labels.length * 52);
  const padB = 28;
  const padT = 10;
  const chartH = height - padB - padT;
  const group = W / labels.length;
  const barW = Math.max(4, Math.min(16, (group - 10) / series.length));

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="גרף עמודות">
        {labels.map((label, i) => {
          const x0 = i * group + group / 2 - (barW * series.length) / 2;
          return (
            <g key={label}>
              {series.map((s, j) => {
                const v = s.values[i] ?? 0;
                const h = (v / max) * chartH;
                return (
                  <rect
                    key={s.name}
                    x={x0 + j * barW}
                    y={padT + chartH - h}
                    width={barW - 2}
                    height={Math.max(h, v > 0 ? 1 : 0)}
                    rx={3}
                    fill={s.color}
                  >
                    <title>{`${label} · ${s.name}: ${v}`}</title>
                  </rect>
                );
              })}
              <text x={i * group + group / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.name}><i style={{ background: s.color }} /> {s.name}</span>
        ))}
      </div>
    </div>
  );
}
