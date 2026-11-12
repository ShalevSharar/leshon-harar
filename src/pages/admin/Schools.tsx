import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { CHANNELS, ORG_TYPES, STAGES, STAGE_LABELS } from '../../lib/labels';

type School = {
  id: string;
  name: string;
  city: string;
  level: string;
  phone: string;
  stage: string;
  org_type: string;
  next_followup_at: string | null;
  is_sample: boolean;
};

const PAGE = 100;
const LETTERS = ['א','ב','ג','ד','ה','ו','ז','ח','ט','י','כ','ל','מ','נ','ס','ע','פ','צ','ק','ר','ש','ת'];

// רשימת בתי ספר: סינון לפי אות ראשונה (א׳-ת׳), בחירה מרובה של שלבים, חיפוש,
// טלפון בטבלה, ותצוגה מהירה לעדכון פנייה בלי להיכנס לכרטיס.
export default function Schools() {
  const [rows, setRows] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // החיפוש מהסרגל העליון מגיע כ-?q= בכתובת
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [letter, setLetter] = useState('');
  const [stages, setStages] = useState<string[]>([]);
  const [limit, setLimit] = useState(PAGE);
  const [reload, setReload] = useState(0);
  const [quick, setQuick] = useState<School | null>(null);
  const [orgType, setOrgType] = useState('');
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    let query = supabase
      .from('schools')
      .select('id,name,city,level,phone,stage,org_type,next_followup_at,is_sample')
      .order('name')
      .limit(limit);
    if (orgType) query = query.eq('org_type', orgType);
    if (letter) query = query.ilike('name', `${letter}%`);
    if (stages.length) query = query.in('stage', stages);
    const term = q.trim();
    if (term) query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%,phone.ilike.%${term}%`);
    query.then(({ data, error: err }) => {
      if (err) setError('טעינת בתי הספר נכשלה.');
      else setRows((data ?? []) as School[]);
      setLoading(false);
    });
  }, [q, letter, stages, limit, reload, orgType]);

  function toggleStage(s: string) {
    setLimit(PAGE);
    setStages((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  return (
    <div className="card">
      <h1>בתי ספר</h1>

      <div className="toolbar">
        <input
          type="search"
          placeholder="חיפוש לפי שם, עיר או טלפון"
          value={q}
          onChange={(e) => { setLimit(PAGE); setQ(e.target.value); }}
          aria-label="חיפוש"
          style={{ width: 280 }}
        />
        <select
          value={orgType}
          onChange={(e) => { setLimit(PAGE); setOrgType(e.target.value); }}
          aria-label="סינון לפי סוג מוסד"
        >
          <option value="">כל הסוגים</option>
          {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="button" onClick={() => setShowNew((v) => !v)}>
          {showNew ? 'ביטול' : 'מוסד חדש'}
        </button>
      </div>

      {showNew && (
        <NewOrganization
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); setReload((n) => n + 1); }}
        />
      )}

      <div className="letters" role="group" aria-label="סינון לפי אות ראשונה">
        <button type="button" className={letter === '' ? 'chip on' : 'chip'} onClick={() => { setLimit(PAGE); setLetter(''); }}>הכול</button>
        {LETTERS.map((l) => (
          <button key={l} type="button" className={letter === l ? 'chip on' : 'chip'} onClick={() => { setLimit(PAGE); setLetter(l); }}>{l}</button>
        ))}
      </div>

      <fieldset className="stages">
        <legend>שלב בתהליך (אפשר לבחור כמה)</legend>
        {STAGES.map((s) => (
          <label key={s} className="checkline">
            <input type="checkbox" checked={stages.includes(s)} onChange={() => toggleStage(s)} /> {STAGE_LABELS[s]}
          </label>
        ))}
      </fieldset>

      {error && <p className="err" role="alert">{error}</p>}
      {loading ? <p>טוען...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>שם</th><th>סוג</th><th>עיר</th><th>טלפון</th><th>שלב חינוך</th><th>שלב בתהליך</th><th>מעקב הבא</th><th></th></tr>
            </thead>
            <tbody>
              {/* ראו NewOrganization למטה: רשומה חדשה נשמרת עם סוג מוסד וללא סמל משרד החינוך */}
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/admin/schools/${s.id}`}>{s.name}</Link>{s.is_sample && <span className="tag"> דוגמה</span>}</td>
                  <td data-label="סוג">{s.org_type}</td>
                  <td data-label="עיר">{s.city}</td>
                  <td data-label="טלפון"><a href={`tel:${s.phone}`}>{s.phone}</a></td>
                  <td data-label="רמה">{s.level}</td>
                  <td data-label="שלב"><span className={`stage s-${s.stage}`}>{STAGE_LABELS[s.stage] ?? s.stage}</span></td>
                  <td data-label="מעקב">{s.next_followup_at ?? ''}</td>
                  <td><button type="button" className="secondary" onClick={() => setQuick(s)}>עדכון פנייה</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7}>אין בתי ספר להצגה.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {!loading && rows.length === limit && (
        <button type="button" className="secondary" onClick={() => setLimit((n) => n + PAGE)}>טען עוד</button>
      )}

      {quick && (
        <QuickView
          school={quick}
          onClose={() => setQuick(null)}
          onSaved={() => { setQuick(null); setReload((n) => n + 1); }}
        />
      )}
    </div>
  );
}

// טופס להוספת מוסד חדש: בית ספר, מתנסים, חברתון או ארגון אחר.
// נשמר עם manual = true כדי להבדיל מרשומות שיובאו ממשרד החינוך.
function NewOrganization({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return setError('אין חיבור לשרת הנתונים.');
    // שומרים את הטופס לפני ה-await: אחרי await, e.currentTarget כבר null
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get('name') ?? '').trim();
    if (name.length < 2) return setError('יש להזין שם (לפחות 2 תווים).');
    setBusy(true);
    const { error: err } = await supabase.from('schools').insert({
      name,
      org_type: String(f.get('org_type') ?? 'ארגון אחר'),
      city: String(f.get('city') ?? '').trim(),
      phone: String(f.get('phone') ?? '').trim(),
      address: String(f.get('address') ?? '').trim(),
      manual: true,
    });
    setBusy(false);
    if (err) return setError('השמירה נכשלה. ייתכן שהשם כבר קיים או שהנתונים לא תקינים.');
    form.reset();
    onSaved();
  }

  return (
    <form className="card" onSubmit={onSubmit} style={{ marginBottom: 16 }}>
      <h2>מוסד חדש</h2>
      <div className="toolbar">
        <input name="name" placeholder="שם המוסד" required minLength={2} aria-label="שם המוסד" />
        <select name="org_type" defaultValue="מתנסים" aria-label="סוג המוסד">
          {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input name="city" placeholder="עיר" aria-label="עיר" />
        <input name="phone" type="tel" placeholder="טלפון" aria-label="טלפון" />
        <input name="address" placeholder="כתובת" aria-label="כתובת" />
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      <div className="toolbar">
        <button type="submit" disabled={busy}>{busy ? 'שומר...' : 'שמירה'}</button>
        <button type="button" className="secondary" onClick={onClose}>ביטול</button>
      </div>
    </form>
  );
}

// תצוגה מהירה: שינוי שלב ותיעוד פנייה בלי לעבור לכרטיס המלא.
function QuickView({ school, onClose, onSaved }: { school: School; onClose: () => void; onSaved: () => void }) {
  const [stage, setStage] = useState(school.stage);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    setError('');
    const f = new FormData(e.currentTarget);
    const summary = String(f.get('summary') ?? '').trim();
    const channel = String(f.get('channel') ?? 'אחר');
    setBusy(true);
    if (summary) {
      const { error: err } = await supabase.from('interactions').insert({ school_id: school.id, channel, summary });
      if (err) { setBusy(false); return setError('שמירת הפנייה נכשלה.'); }
    }
    const { error: err2 } = await supabase
      .from('schools')
      .update({ stage, last_contact_at: new Date().toISOString() })
      .eq('id', school.id);
    setBusy(false);
    if (err2) return setError('עדכון השלב נכשל.');
    setSaved('נשמר');
    setTimeout(onSaved, 400);
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="תצוגה מהירה">
      <form className="card quick" onSubmit={onSubmit}>
        <h2>{school.name}</h2>
        <p className="muted">{school.city} · <a href={`tel:${school.phone}`}>{school.phone}</a></p>

        <label>שלב בתהליך
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </label>
        <label>ערוץ
          <select name="channel">{CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </label>
        <label>סיכום הפנייה (אופציונלי)
          <textarea name="summary" rows={3} />
        </label>

        {error && <p className="err" role="alert">{error}</p>}
        {saved && <p role="status">{saved}</p>}
        <div className="toolbar">
          <button type="submit" disabled={busy}>{busy ? 'שומר...' : 'שמירה'}</button>
          <button type="button" className="secondary" onClick={onClose}>סגירה</button>
          <Link to={`/admin/schools/${school.id}`}>לכרטיס המלא</Link>
        </div>
      </form>
    </div>
  );
}
