import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { STAGES, STAGE_LABELS } from '../../lib/labels';

type School = {
  id: string; name: string; city: string; district: string; level: string;
  sector: string; phone: string; address: string; stage: string;
  next_followup_at: string | null; last_contact_at: string | null;
};
type Contact = { id: string; role: string; name: string; phone: string; email: string };
type Interaction = { id: string; occurred_at: string; channel: string; summary: string };

const CHANNELS = ['טלפון', 'מייל', 'ווטסאפ', 'דף נחיתה', 'אחר'];
const ROLES = ['יועצת', 'מנהל', 'רכז חברתי', 'אחר'];

// כרטיס בית ספר: פרטים, שלב, אנשי קשר ופניות.
export default function SchoolCard() {
  const { id } = useParams();
  const [school, setSchool] = useState<School | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !id) return;
    const [s, c, i] = await Promise.all([
      supabase.from('schools').select('*').eq('id', id).maybeSingle(),
      supabase.from('contacts').select('*').eq('school_id', id).order('created_at'),
      supabase.from('interactions').select('*').eq('school_id', id).order('occurred_at', { ascending: false }),
    ]);
    if (s.error || c.error || i.error) return setError('טעינת הכרטיס נכשלה.');
    if (!s.data) return setNotFound(true);
    setSchool(s.data as School);
    setContacts((c.data ?? []) as Contact[]);
    setInteractions((i.data ?? []) as Interaction[]);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function changeStage(next: string) {
    if (!supabase || !school) return;
    const { error: err } = await supabase.from('schools').update({ stage: next }).eq('id', school.id);
    if (err) return setError('עדכון השלב נכשל.');
    setSchool({ ...school, stage: next });
  }

  async function addInteraction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !school) return;
    const f = new FormData(e.currentTarget);
    const summary = String(f.get('summary') ?? '').trim();
    if (!summary) return;
    const { error: err } = await supabase.from('interactions').insert({
      school_id: school.id,
      channel: String(f.get('channel') ?? 'אחר'),
      summary,
    });
    if (err) return setError('שמירת הפנייה נכשלה.');
    e.currentTarget.reset();
    await supabase.from('schools').update({ last_contact_at: new Date().toISOString() }).eq('id', school.id);
    load();
  }

  async function addContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !school) return;
    const f = new FormData(e.currentTarget);
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
    e.currentTarget.reset();
    load();
  }

  if (notFound) return <div className="card"><p>בית הספר לא נמצא. <Link to="/admin/schools">חזרה לרשימה</Link></p></div>;
  if (!school) return <div className="card">{error ? <p className="err">{error}</p> : <p>טוען...</p>}</div>;

  return (
    <div className="card">
      <p><Link to="/admin/schools">← חזרה לרשימה</Link></p>
      <h1>{school.name}</h1>
      <p className="muted">{[school.city, school.district, school.level, school.sector].filter(Boolean).join(' · ')}</p>
      <p>{school.phone} {school.address && `· ${school.address}`}</p>

      <label>שלב בתהליך
        <select value={school.stage} onChange={(e) => changeStage(e.target.value)}>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
      </label>
      {error && <p className="err" role="alert">{error}</p>}

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
