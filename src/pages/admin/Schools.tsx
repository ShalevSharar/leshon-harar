import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { STAGES, STAGE_LABELS } from '../../lib/labels';

type School = {
  id: string;
  name: string;
  city: string;
  district: string;
  level: string;
  stage: string;
  next_followup_at: string | null;
  is_sample: boolean;
};

const PAGE = 100;

// רשימת בתי ספר עם חיפוש וסינון. נטען בעמודים כי יש אלפי רשומות.
export default function Schools() {
  const [rows, setRows] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    let query = supabase
      .from('schools')
      .select('id,name,city,district,level,stage,next_followup_at,is_sample')
      .order('name')
      .limit(limit);
    if (stage) query = query.eq('stage', stage);
    const term = q.trim();
    if (term) query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
    query.then(({ data, error: err }) => {
      if (err) setError('טעינת בתי הספר נכשלה.');
      else setRows((data ?? []) as School[]);
      setLoading(false);
    });
  }, [q, stage, limit]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => { c[r.stage] = (c[r.stage] ?? 0) + 1; });
    return c;
  }, [rows]);

  return (
    <div className="card">
      <h1>בתי ספר</h1>
      <div className="toolbar">
        <input
          type="search"
          placeholder="חיפוש לפי שם או עיר"
          value={q}
          onChange={(e) => { setLimit(PAGE); setQ(e.target.value); }}
          aria-label="חיפוש"
          style={{ width: 260 }}
        />
        <select value={stage} onChange={(e) => { setLimit(PAGE); setStage(e.target.value); }} aria-label="סינון לפי שלב">
          <option value="">כל השלבים</option>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
      </div>
      <p className="muted">
        מוצגים {rows.length} בתי ספר. {Object.entries(counts).map(([s, n]) => `${STAGE_LABELS[s]}: ${n}`).join(' · ')}
      </p>
      {error && <p className="err" role="alert">{error}</p>}
      {loading ? <p>טוען...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>שם</th><th>עיר</th><th>מחוז</th><th>שלב חינוך</th><th>שלב בתהליך</th><th>מעקב הבא</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/admin/schools/${s.id}`}>{s.name}</Link>{s.is_sample && <span className="tag"> דוגמה</span>}</td>
                  <td>{s.city}</td>
                  <td>{s.district}</td>
                  <td>{s.level}</td>
                  <td>{STAGE_LABELS[s.stage] ?? s.stage}</td>
                  <td>{s.next_followup_at ?? ''}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6}>אין בתי ספר להצגה. אם עדיין לא יובאו נתונים, זה צפוי.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {!loading && rows.length === limit && (
        <button type="button" className="secondary" onClick={() => setLimit((n) => n + PAGE)}>טען עוד</button>
      )}
    </div>
  );
}
