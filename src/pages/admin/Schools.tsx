import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { CHANNELS, STAGES, STAGE_LABELS } from '../../lib/labels';

type School = {
  id: string;
  name: string;
  city: string;
  level: string;
  phone: string;
  stage: string;
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
  const [q, setQ] = useState('');
  const [letter, setLetter] = useState('');
  const [stages, setStages] = useState<string[]>([]);
  const [limit, setLimit] = useState(PAGE);
  const [reload, setReload] = useState(0);
  const [quick, setQuick] = useState<School | null>(null);

  useEffect(() => {
    if (!supabase) return;
    setLoading(true);
    let query = supabase
      .from('schools')
      .select('id,name,city,level,phone,stage,next_followup_at,is_sample')
      .order('name')
      .limit(limit);
    if (letter) query = query.ilike('name', `${letter}%`);
    if (stages.length) query = query.in('stage', stages);
    const term = q.trim();
    if (term) query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%,phone.ilike.%${term}%`);
    query.then(({ data, error: err }) => {
      if (err) setError('טעינת בתי הספר נכשלה.');
      else setRows((data ?? []) as School[]);
      setLoading(false);
    });
  }, [q, letter, stages, limit, reload]);

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
      </div>

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
              <tr><th>שם</th><th>עיר</th><th>טלפון</th><th>שלב חינוך</th><th>שלב בתהליך</th><th>מעקב הבא</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/admin/schools/${s.id}`}>{s.name}</Link>{s.is_sample && <span className="tag"> דוגמה</span>}</td>
                  <td>{s.city}</td>
                  <td><a href={`tel:${s.phone}`}>{s.phone}</a></td>
                  <td>{s.level}</td>
                  <td>{STAGE_LABELS[s.stage] ?? s.stage}</td>
                  <td>{s.next_followup_at ?? ''}</td>
                  <td><button type="button" className="secondary" onClick={() => setQuick(s)}>תצוגה מהירה</button></td>
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
