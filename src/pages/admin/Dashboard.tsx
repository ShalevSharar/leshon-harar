import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, NO_DB_MESSAGE } from '../../lib/supabase';
import { STAGES, STAGE_LABELS } from '../../lib/labels';
import { toLocalISO, addDays, HEB_MONTHS } from '../../lib/calendar';
import BarChart from '../../components/charts/BarChart';

type Due = { id: string; name: string; city: string; next_followup_at: string };
type Task = { id: string; title: string; due_date: string; schools: { name: string } | null };
type Upcoming = { id: string; lecture_date: string; start_time: string | null; schools: { name: string } | null; lecturers: { name: string } | null };
type Interaction = { occurred_at: string; channel: string; summary: string; schools: { name: string } | null };
type Req = { id: string; created_at: string; school_name: string; city: string; match_status: string };
type Monthly = { month: string; lectures: number; requests: number; interactions: number };
type CityRow = { city: string; schools: number; reached: number; interested: number };

const MATCH_LABEL: Record<string, string> = { pending: 'ממתין', matched: 'שויך', review: 'לבדיקה' };

// דשבורד: תמונת מצב, מה לטפל היום, מה קרוב, פעילות אחרונה, וגרפים מהנתונים בלבד.
// אם משהו לא נטען, מוצגת הודעה במקום מספר מומצא. "בתהליך" = שלב "נפנה" או מעלה.
export default function Dashboard() {
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [kpi, setKpi] = useState({ lecturesHeld: 0, lecturesPlanned: 0, requests: 0, volunteers: 0, lecturers: 0 });
  const [due, setDue] = useState<Due[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  const [recentInt, setRecentInt] = useState<Interaction[]>([]);
  const [recentReq, setRecentReq] = useState<Req[]>([]);
  const [monthly, setMonthly] = useState<Monthly[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setError(NO_DB_MESSAGE);
      setLoading(false);
      return;
    }
    const db = supabase;
    const now = new Date();
    const today = toLocalISO(now);
    const yearStart = `${now.getFullYear()}-01-01`;
    const monthsFrom = toLocalISO(new Date(now.getFullYear(), now.getMonth() - 11, 1));

    (async () => {
      const count = (q: PromiseLike<{ count: number | null; error: unknown }>) => q.then((r) => ({ n: r.count ?? 0, err: r.error }));
      const [stageRes, held, planned, reqs, vols, lecs, dueRes, taskRes, upRes, intRes, reqRes, monRes, cityRes] = await Promise.all([
        Promise.all(STAGES.map((s) => db.from('schools').select('id', { count: 'exact', head: true }).eq('stage', s))),
        count(db.from('lectures').select('id', { count: 'exact', head: true }).eq('status', 'done').gte('lecture_date', yearStart)),
        count(db.from('lectures').select('id', { count: 'exact', head: true }).eq('status', 'planned')),
        count(db.from('lecture_requests').select('id', { count: 'exact', head: true })),
        count(db.from('volunteers').select('id', { count: 'exact', head: true }).eq('status', 'active')),
        count(db.from('lecturers').select('id', { count: 'exact', head: true }).eq('active', true)),
        db.from('schools').select('id,name,city,next_followup_at').lte('next_followup_at', today).order('next_followup_at').limit(8),
        db.from('tasks').select('id,title,due_date,schools(name)').eq('done', false).lte('due_date', today).order('due_date').limit(8),
        db.from('lectures').select('id,lecture_date,start_time,schools(name),lecturers(name)').eq('status', 'planned').gte('lecture_date', today).order('lecture_date').limit(8),
        db.from('interactions').select('occurred_at,channel,summary,schools(name)').order('occurred_at', { ascending: false }).limit(8),
        db.from('lecture_requests').select('id,created_at,school_name,city,match_status').order('created_at', { ascending: false }).limit(8),
        db.rpc('analytics_monthly', { p_from: monthsFrom }),
        db.rpc('analytics_by_city'),
      ]);

      const counts: Record<string, number> = {};
      STAGES.forEach((s, i) => { counts[s] = stageRes[i].count ?? 0; });
      setStageCounts(counts);
      setKpi({ lecturesHeld: held.n, lecturesPlanned: planned.n, requests: reqs.n, volunteers: vols.n, lecturers: lecs.n });
      setDue((dueRes.data ?? []) as Due[]);
      setTasks((taskRes.data ?? []) as unknown as Task[]);
      setUpcoming((upRes.data ?? []) as unknown as Upcoming[]);
      setRecentInt((intRes.data ?? []) as unknown as Interaction[]);
      setRecentReq((reqRes.data ?? []) as Req[]);
      setMonthly((monRes.data ?? []) as Monthly[]);
      setCities((cityRes.data ?? []) as CityRow[]);

      const failed = [held, planned, reqs, vols, lecs, dueRes, taskRes, upRes, intRes, reqRes].find((r) => ('err' in r ? r.err : r.error));
      if (failed || monRes.error || cityRes.error) {
        setError('חלק מהנתונים לא נטען. אם זו הפעם הראשונה, ודאו שהרצתם את 0013 ו-0014 ב-Supabase.');
      }
      setLoading(false);
    })();
  }, []);

  const total = useMemo(() => Object.values(stageCounts).reduce((a, b) => a + b, 0), [stageCounts]);
  // "בתהליך" = יצרנו קשר ואילך (לא "לא פנינו" ולא "לא רלוונטי/סירב")
  const reached = (stageCounts.contacted ?? 0) + (stageCounts.interested ?? 0) + (stageCounts.lecture_scheduled ?? 0) + (stageCounts.lecture_done ?? 0) + (stageCounts.feedback_received ?? 0);
  const interested = stageCounts.interested ?? 0;
  const scheduled = stageCounts.lecture_scheduled ?? 0;

  const monthLabels = monthly.map((m) => `${HEB_MONTHS[Number(m.month.slice(5, 7)) - 1].slice(0, 3)} ${m.month.slice(2, 4)}`);

  // תובנות: רק כשיש מספיק נתונים כדי שהן יהיו משמעותיות
  const insights: string[] = [];
  if (total >= 10 && reached >= 10) {
    insights.push(`מתוך ${reached} בתי ספר שנפנה אליהם, ${interested} הביעו עניין (${Math.round((interested / reached) * 100)}%).`);
    insights.push(`${scheduled} בתי ספר במצב "נקבעה הרצאה" (${Math.round((scheduled / reached) * 100)}% מהפניות).`);
  }
  const topCity = cities.filter((c) => c.reached >= 3).sort((a, b) => b.reached - a.reached)[0];
  if (topCity) insights.push(`העיר עם הכי הרבה פניות: ${topCity.city} (${topCity.reached} בתי ספר).`);
  const waiting = Object.entries(stageCounts).sort((a, b) => b[1] - a[1])[0];
  if (waiting && waiting[1] >= 10) insights.push(`השלב עם הכי הרבה בתי ספר: "${STAGE_LABELS[waiting[0]]}" (${waiting[1]}).`);

  const kpiCards = [
    { label: 'בתי ספר במאגר', value: total, to: '/admin/schools' },
    { label: 'לא פנינו עדיין', value: stageCounts.not_contacted ?? 0, to: '/admin/schools' },
    { label: 'פנינו (בתהליך)', value: reached, to: '/admin/schools' },
    { label: 'בתי ספר שהביעו עניין', value: interested, to: '/admin/schools' },
    { label: 'בקשות שהתקבלו', value: kpi.requests, to: '/admin/requests' },
    { label: 'הרצאות מתוכננות', value: kpi.lecturesPlanned, to: '/admin/lectures' },
    { label: 'הרצאות שהתקיימו השנה', value: kpi.lecturesHeld, to: '/admin/lectures' },
    { label: 'מרצים פעילים', value: kpi.lecturers, to: '/admin/lecture-settings' },
    { label: 'מתנדבים פעילים', value: kpi.volunteers, to: '/admin/volunteers' },
  ];

  if (loading) return <div className="card"><p>טוען...</p></div>;

  return (
    <div className="dash">
      <h1>דשבורד</h1>
      {error && <p className="err" role="alert">{error}</p>}

      {/* שורה עליונה: מה דורש טיפול */}
      <div className="dash-grid">
        <section className="card">
          <h2 className="important">לטפל היום</h2>
          {due.length + tasks.length === 0 ? <p className="muted">אין משימות או מעקבים להיום.</p> : (
            <ul className="plain">
              {tasks.map((t) => <li key={t.id}>📌 {t.title}{t.schools?.name && ` · ${t.schools.name}`} <span className="muted">({t.due_date})</span></li>)}
              {due.map((d) => <li key={d.id}>⏰ <Link to={`/admin/schools/${d.id}`}>{d.name}</Link> <span className="muted">· מעקב {d.next_followup_at}</span></li>)}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>הרצאות קרובות</h2>
          {upcoming.length === 0 ? <p className="muted">אין הרצאות מתוכננות בהמשך.</p> : (
            <ul className="plain">
              {upcoming.map((u) => (
                <li key={u.id}>
                  <strong>{new Date(u.lecture_date + 'T00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}{u.start_time && ` ${u.start_time.slice(0, 5)}`}</strong>
                  {' · '}{u.schools?.name ?? ''}{' · '}<span className="muted">{u.lecturers?.name ?? 'ללא מרצה'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* כרטיסי KPI: כל כרטיס מוביל למסך הרלוונטי */}
      <div className="kpi-grid">
        {kpiCards.map((k) => (
          <Link key={k.label} to={k.to} className="kpi-card">
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </Link>
        ))}
      </div>

      <div className="dash-grid">
        <section className="card">
          <h2>פעילות חודשית (12 חודשים)</h2>
          <BarChart
            labels={monthLabels}
            series={[
              { name: 'פניות (יומן)', color: 'var(--accent)', values: monthly.map((m) => Number(m.interactions)) },
              { name: 'בקשות', color: 'var(--sage)', values: monthly.map((m) => Number(m.requests)) },
              { name: 'הרצאות', color: 'var(--peach)', values: monthly.map((m) => Number(m.lectures)) },
            ]}
          />
        </section>

        <section className="card">
          <h2>משפך טיפול (לפי שלב נוכחי)</h2>
          {total === 0 ? <p className="muted">אין עדיין בתי ספר במאגר.</p> : (
            <div className="funnel">
              {STAGES.map((s) => {
                const n = stageCounts[s] ?? 0;
                const pct = total ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={s} className="funnel-row">
                    <span>{STAGE_LABELS[s]}</span>
                    <div className="funnel-bar"><div style={{ width: `${pct}%` }} /></div>
                    <span className="muted">{n} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="muted small">המשפך מציג את השלב הנוכחי של כל בית ספר. המעבר בין שלבים לאורך זמן לא נשמר עדיין.</p>
        </section>
      </div>

      <div className="dash-grid">
        <section className="card">
          <h2>פעילות אחרונה</h2>
          <h3>פניות אחרונות</h3>
          {recentInt.length === 0 ? <p className="muted">אין פניות שנרשמו.</p> : (
            <ul className="plain">
              {recentInt.map((i, idx) => (
                <li key={idx}>{i.schools?.name ?? ''} · <span className="muted">{i.channel}</span> · {i.summary}</li>
              ))}
            </ul>
          )}
          <h3>בקשות אחרונות</h3>
          {recentReq.length === 0 ? <p className="muted">אין בקשות.</p> : (
            <ul className="plain">
              {recentReq.map((r) => (
                <li key={r.id}>{r.school_name} · {r.city} · <span className="muted">{MATCH_LABEL[r.match_status] ?? r.match_status}</span></li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>תובנות מהפעילות</h2>
          {insights.length === 0 ? (
            <p className="muted">עדיין אין מספיק נתונים לתובנות אמינות. התובנות יופיעו כשיהיו לפחות 10 בתי ספר במאגר ו-10 בתהליך.</p>
          ) : (
            <ul>{insights.map((t, i) => <li key={i}>{t}</li>)}</ul>
          )}
        </section>
      </div>

      <p className="muted small">תאריך היום: {toLocalISO(addDays(new Date(), 0))}</p>
    </div>
  );
}
