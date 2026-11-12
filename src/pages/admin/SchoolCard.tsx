import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase, NO_DB_MESSAGE } from '../../lib/supabase';
import { STAGES, STAGE_LABELS } from '../../lib/labels';

type School = {
  id: string; name: string; city: string; district: string; level: string;
  sector: string; phone: string; address: string; stage: string; org_type: string;
  assigned_to: string; next_followup_at: string | null; last_contact_at: string | null;
};
type Contact = { id: string; role: string; name: string; phone: string; email: string };
type Interaction = { id: string; occurred_at: string; channel: string; summary: string };
type Task = { id: string; title: string; due_date: string | null; done: boolean; assigned_to: string };
type Lec = { id: string; lecture_date: string | null; start_time: string | null; status: string; lecturers: { name: string } | null };

const CHANNELS = ['טלפון', 'מייל', 'ווטסאפ', 'דף נחיתה', 'אחר'];
const ROLES = ['יועצת', 'מנהל', 'רכז חברתי', 'אחר'];
const LEC_STATUS: Record<string, string> = { planned: 'מתוכננת', done: 'התקיימה', cancelled: 'בוטלה' };

// כרטיס בית ספר: פרטים, שלב, אחראי, אנשי קשר, פניות, הרצאות ומשימות. הכול נשמר ישירות בבסיס הנתונים.
export default function SchoolCard() {
  const { id } = useParams();
  const [school, setSchool] = useState<School | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lectures, setLectures] = useState<Lec[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !id) return setError(NO_DB_MESSAGE);
    const db = supabase;
    const [s, c, i, t, l, a] = await Promise.all([
      db.from('schools').select('*').eq('id', id).maybeSingle(),
      db.from('contacts').select('*').eq('school_id', id).order('created_at'),
      db.from('interactions').select('*').eq('school_id', id).order('occurred_at', { ascending: false }),
      db.from('tasks').select('id,title,due_date,done,assigned_to').eq('school_id', id).order('done').order('due_date', { ascending: true, nullsFirst: false }),
      db.from('lectures').select('id,lecture_date,start_time,status,lecturers(name)').eq('school_id', id).order('lecture_date', { ascending: false }),
      db.from('allowed_emails').select('email').order('email'),
    ]);
    if (s.error || c.error || i.error) return setError('טעינת הכרטיס נכשלה.');
    if (!s.data) return setNotFound(true);
    setSchool(s.data as School);
    setContacts((c.data ?? []) as Contact[]);
    setInteractions((i.data ?? []) as Interaction[]);
    // משימות והרצאות: אם הטבלה לא זמינה עדיין, הכרטיס ממשיך לעבוד בלעדיהן
    setTasks((t.data ?? []) as Task[]);
    setLectures((l.data ?? []) as unknown as Lec[]);
    setAssignees(((a.data ?? []) as { email: string }[]).map((x) => x.email));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function changeStage(next: string) {
    if (!supabase || !school) return;
    const { error: err } = await supabase.from('schools').update({ stage: next }).eq('id', school.id);
    if (err) return setError('עדכון השלב נכשל.');
    setSchool({ ...school, stage: next });
  }

  async function changeAssignee(email: string) {
    if (!supabase || !school) return;
    const { error: err } = await supabase.from('schools').update({ assigned_to: email }).eq('id', school.id);
    if (err) return setError('עדכון האחראי נכשל.');
    setSchool({ ...school, assigned_to: email });
  }

  async function addInteraction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !school) return;
    // שומרים את הטופס לפני ה-await: אחרי await, e.currentTarget כבר null
    const form = e.currentTarget;
    const f = new FormData(form);
    const summary = String(f.get('summary') ?? '').trim();
    if (!summary) return;
    const { error: err } = await supabase.from('interactions').insert({
      school_id: school.id,
      channel: String(f.get('channel') ?? 'אחר'),
      summary,
    });
    if (err) return setError('שמירת הפנייה נכשלה.');
    form.reset();
    await supabase.from('schools').update({ last_contact_at: new Date().toISOString() }).eq('id', school.id);
    load();
  }

  async function addContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !school) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get('name') ?? '').trim();
    if (!name) return;
    const { error: err } = await supabase.from('contacts').insert({
      school_id: school.id,
      role: String(f.get('role') ?? 'אחר'),
      name,
      phone: String(f.get('phone') ?? '').trim(),
      email: String(f.get('email') ?? '').trim(),
    });
    if (err) return setError('שמירת איש הקשר נכשלה.');
    form.reset();
    load();
  }

  async function addTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !school) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const title = String(f.get('title') ?? '').trim();
    if (title.length < 2) return setError('יש להזין כותרת למשימה.');
    const { error: err } = await supabase.from('tasks').insert({
      school_id: school.id,
      title,
      due_date: String(f.get('due_date') ?? '') || null,
      assigned_to: school.assigned_to,
    });
    if (err) return setError('שמירת המשימה נכשלה.');
    form.reset();
    setError('');
    load();
  }

  async function toggleTask(t: Task) {
    if (!supabase) return;
    const { error: err } = await supabase
      .from('tasks')
      .update({ done: !t.done, done_at: !t.done ? new Date().toISOString() : null })
      .eq('id', t.id);
    if (err) return setError('עדכון המשימה נכשל.');
    load();
  }

  if (notFound) return <div className="card"><p>בית הספר לא נמצא. <Link to="/admin/schools">חזרה לרשימה</Link></p></div>;
  if (!school) return <div className="card">{error ? <p className="err">{error}</p> : <p>טוען...</p>}</div>;

  const openTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

  return (
    <div className="card">
      <p><Link to="/admin/schools">← חזרה לרשימה</Link></p>
      <h1>{school.name}</h1>
      <p className="muted">
        {[school.org_type, school.city, school.district, school.level, school.sector].filter(Boolean).join(' · ')}
      </p>
      <p>{school.phone} {school.address && `· ${school.address}`}</p>

      <div className="toolbar">
        <label style={{ margin: 0 }}>שלב בתהליך
          <select value={school.stage} onChange={(e) => changeStage(e.target.value)}>
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </label>
        <label style={{ margin: 0 }}>אחראי
          <select value={school.assigned_to} onChange={(e) => changeAssignee(e.target.value)} aria-label="אחראי על המוסד">
            <option value="">לא שויך</option>
            {assignees.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="err" role="alert">{error}</p>}

      <h2>משימות ותזכורות</h2>
      {openTasks.length + doneTasks.length === 0 && <p className="muted">אין משימות למוסד הזה.</p>}
      <ul className="plain">
        {openTasks.map((t) => (
          <li key={t.id}>
            <label className="checkline">
              <input type="checkbox" checked={false} onChange={() => toggleTask(t)} /> {t.title}
            </label>
            {t.due_date && <span className="muted"> · עד {t.due_date}</span>}
          </li>
        ))}
        {doneTasks.map((t) => (
          <li key={t.id} className="muted">
            <label className="checkline">
              <input type="checkbox" checked onChange={() => toggleTask(t)} /> <s>{t.title}</s>
            </label>
          </li>
        ))}
      </ul>
      <form onSubmit={addTask}>
        <div className="toolbar">
          <input name="title" placeholder="משימה (למשל: להתקשר ליועצת)" required minLength={2} style={{ width: 300 }} />
          <input name="due_date" type="date" aria-label="תאריך יעד" />
          <button type="submit" className="secondary">הוספת משימה</button>
        </div>
      </form>

      <h2>הרצאות</h2>
      {lectures.length ? (
        <ul className="plain">
          {lectures.map((l) => (
            <li key={l.id}>
              <Link to={`/admin/lectures/${l.id}`}>{l.lecture_date ?? 'ללא תאריך'}</Link>
              {l.start_time && ` · ${l.start_time.slice(0, 5)}`}
              {' · '}{l.lecturers?.name ?? 'ללא מרצה'}
              {' · '}<span className="muted">{LEC_STATUS[l.status] ?? l.status}</span>
            </li>
          ))}
        </ul>
      ) : <p className="muted">אין הרצאות מוסד זה עדיין.</p>}

      <h2>אנשי קשר</h2>
      {contacts.length ? (
        <ul>
          {contacts.map((c) => (
            <li key={c.id}>{c.role} · {c.name} {c.phone && `· ${c.phone}`} {c.email && `· ${c.email}`}</li>
          ))}
        </ul>
      ) : <p className="muted">אין אנשי קשר עדיין.</p>}
      <form onSubmit={addContact}>
        <div className="toolbar">
          <select name="role" aria-label="תפקיד">{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          <input name="name" placeholder="שם" required />
          <input name="phone" placeholder="טלפון" />
          <input name="email" placeholder="מייל" />
          <button type="submit" className="secondary">הוספת איש קשר</button>
        </div>
      </form>

      <h2>היסטוריית פניות</h2>
      {interactions.length ? (
        <ul>
          {interactions.map((i) => (
            <li key={i.id}>{new Date(i.occurred_at).toLocaleDateString('he-IL')} · {i.channel} · {i.summary}</li>
          ))}
        </ul>
      ) : <p className="muted">עדיין לא תועדו פניות.</p>}
      <form onSubmit={addInteraction}>
        <div className="toolbar">
          <select name="channel" aria-label="ערוץ">{CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <input name="summary" placeholder="סיכום הפנייה" required style={{ width: 320 }} />
          <button type="submit" className="secondary">תיעוד פנייה</button>
        </div>
      </form>
    </div>
  );
}
