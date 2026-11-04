import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { VOLUNTEER_AREAS, VOLUNTEER_SOURCES } from '../../config/settings';

type Status = 'new' | 'contacted' | 'active' | 'not_relevant';

type Volunteer = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  email: string;
  city: string;
  areas: string[];
  availability: string | null;
  source: string;
  status: Status;
  is_sample: boolean;
};

const STATUS_LABELS: Record<Status, string> = {
  new: 'חדש',
  contacted: 'יצרנו קשר',
  active: 'פעיל',
  not_relevant: 'לא רלוונטי',
};

const SOURCE_LABEL = (v: string) => VOLUNTEER_SOURCES.find((s) => s.value === v)?.label ?? v;

function toCsv(rows: Volunteer[]): string {
  const headers = ['שם', 'טלפון', 'מייל', 'עיר', 'תחומים', 'זמינות', 'מקור', 'סטטוס', 'תאריך'];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.full_name,
      r.phone,
      r.email,
      r.city,
      r.areas.join(' | '),
      r.availability ?? '',
      SOURCE_LABEL(r.source),
      STATUS_LABELS[r.status],
      new Date(r.created_at).toLocaleString('he-IL'),
    ].map(esc).join(','),
  );
  return [headers.map(esc).join(','), ...lines].join('\n');
}

export default function Volunteers() {
  const [rows, setRows] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [area, setArea] = useState('');
  const [status, setStatus] = useState<'' | Status>('');

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('volunteers')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError('טעינת המתנדבים נכשלה.');
        else setRows((data ?? []) as Volunteer[]);
        setLoading(false);
      });
  }, []);

  const visible = useMemo(
    () =>
      rows.filter(
        (r) => (!area || r.areas.includes(area)) && (!status || r.status === status),
      ),
    [rows, area, status],
  );

  async function changeStatus(id: string, next: Status) {
    if (!supabase) return;
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: next } : r)));
    const { error: err } = await supabase.from('volunteers').update({ status: next }).eq('id', id);
    if (err) {
      setRows(prev);
      setError('עדכון הסטטוס נכשל.');
    }
  }

  function exportCsv() {
    // BOM כדי שאקסל יציג עברית נכון
    const blob = new Blob(['﻿' + toCsv(visible)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `volunteers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="page wide">
      <div className="card">
        <h1>מתנדבים ({visible.length})</h1>
        <div className="toolbar">
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="סינון לפי תחום">
            <option value="">כל התחומים</option>
            {VOLUNTEER_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as '' | Status)} aria-label="סינון לפי סטטוס">
            <option value="">כל הסטטוסים</option>
            {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <button type="button" className="secondary" onClick={exportCsv} disabled={!visible.length}>ייצוא CSV</button>
          <button type="button" className="secondary" onClick={() => supabase?.auth.signOut()}>יציאה</button>
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        {loading ? (
          <p>טוען...</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם</th><th>טלפון</th><th>מייל</th><th>עיר</th><th>תחומים</th><th>מקור</th><th>סטטוס</th><th>תאריך</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td>{r.full_name}{r.is_sample && <span className="tag"> דוגמה</span>}</td>
                    <td><a href={`tel:${r.phone}`}>{r.phone}</a></td>
                    <td><a href={`mailto:${r.email}`}>{r.email}</a></td>
                    <td>{r.city}</td>
                    <td>{r.areas.join(', ')}</td>
                    <td>{SOURCE_LABEL(r.source)}</td>
                    <td>
                      <select value={r.status} onChange={(e) => changeStatus(r.id, e.target.value as Status)} aria-label="סטטוס">
                        {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td>{new Date(r.created_at).toLocaleDateString('he-IL')}</td>
                  </tr>
                ))}
                {!visible.length && (
                  <tr><td colSpan={8}>אין מתנדבים להצגה.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
