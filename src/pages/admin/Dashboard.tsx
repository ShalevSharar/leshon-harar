import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { STAGES, STAGE_LABELS } from '../../lib/labels';

type Due = { id: string; name: string; city: string; next_followup_at: string };

// דשבורד: תמונת מצב ורשימת "לטפל היום".
export default function Dashboard() {
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [lecturesDone, setLecturesDone] = useState(0);
  const [lecturesPlanned, setLecturesPlanned] = useState(0);
  const [newRequests, setNewRequests] = useState(0);
  const [volunteers, setVolunteers] = useState(0);
  const [due, setDue] = useState<Due[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    const today = new Date().toISOString().slice(0, 10);
    const yearStart = `${new Date().getFullYear()}-01-01`;

    (async () => {
      const stageResults = await Promise.all(
        STAGES.map((s) => db.from('schools').select('id', { count: 'exact', head: true }).eq('stage', s)),
      );
      const counts: Record<string, number> = {};
      STAGES.forEach((s, i) => { counts[s] = stageResults[i].count ?? 0; });
      setStageCounts(counts);
      setTotal(Object.values(counts).reduce((a, b) => a + b, 0));

      const [done, planned, reqs, vols, dueRes] = await Promise.all([
        db.from('lectures').select('id', { count: 'exact', head: true }).eq('status', 'done').gte('lecture_date', yearStart),
        db.from('lectures').select('id', { count: 'exact', head: true }).eq('status', 'planned'),
        db.from('lecture_requests').select('id', { count: 'exact', head: true }).in('match_status', ['review', 'matched']),
        db.from('volunteers').select('id', { count: 'exact', head: true }),
        db.from('schools').select('id,name,city,next_followup_at').lte('next_followup_at', today).order('next_followup_at').limit(50),
      ]);
      const failed = [done, planned, reqs, vols, dueRes].find((r) => r.error);
      if (failed) return setError('חלק מהנתונים לא נטענו.');
      setLecturesDone(done.count ?? 0);
      setLecturesPlanned(planned.count ?? 0);
      setNewRequests(reqs.count ?? 0);
      setVolunteers(vols.count ?? 0);
      setDue((dueRes.data ?? []) as Due[]);
    })();
  }, []);

  const tile = (label: string, value: number) => (
    <div className="card" style={{ textAlign: 'center', padding: 14 }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div className="muted">{label}</div>
    </div>
  );

  return (
    <div>
      <div className="card">
        <h1>דשבורד</h1>
        {error && <p className="err" role="alert">{error}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {tile('בתי ספר במאגר', total)}
          {tile('לא פנינו עדיין', stageCounts.not_contacted ?? 0)}
          {tile('הרצאות שהתקיימו השנה', lecturesDone)}
          {tile('הרצאות מתוכננות', lecturesPlanned)}
          {tile('בקשות מדף הנחיתה', newRequests)}
          {tile('מתנדבים', volunteers)}
        </div>
        <h2>לפי שלב בתהליך</h2>
        <ul>
          {STAGES.map((s) => <li key={s}>{STAGE_LABELS[s]}: {stageCounts[s] ?? 0}</li>)}
        </ul>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>לטפל היום (מעקבים שהגיע זמנם)</h2>
        {due.length ? (
          <ul>
            {due.map((d) => (
              <li key={d.id}>
                <Link to={`/admin/schools/${d.id}`}>{d.name}</Link> ({d.city}), מעקב: {d.next_followup_at}
              </li>
            ))}
          </ul>
        ) : <p className="muted">אין מעקבים להיום.</p>}
      </div>
    </div>
  );
}
