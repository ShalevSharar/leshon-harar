import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase, NO_DB_MESSAGE } from '../../lib/supabase';

type Item = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  phone?: string;
  email?: string;
  calendar_token?: string;
  default_minutes?: number | null;
};
type Table = 'lecturers' | 'lecture_types';

// כתובת היומן של המרצה. מי שיש לו את הקישור רואה את היומן, לכן הטוקן הוא סוד.
function feedPath(token: string) {
  return `/cal/${token}.ics`;
}

// מרצים וסוגי הרצאה. השבתה או מחיקה: מחיקה משאירה את ההרצאות ללא שיוך, ולא מוחקת אותן.
export default function LectureSettings() {
  return (
    <div className="card">
      <h1>מרצים וסוגי הרצאה</h1>
      <ItemList table="lecturers" title="מרצים" addLabel="מרצה חדש" withContacts />
      <ItemList table="lecture_types" title="סוגי הרצאה" addLabel="סוג חדש" withDuration />
    </div>
  );
}

function ItemList({ table, title, addLabel, withContacts = false, withDuration = false }: {
  table: Table;
  title: string;
  addLabel: string;
  withContacts?: boolean;
  withDuration?: boolean;
}) {
  const [rows, setRows] = useState<Item[]>([]);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [contacts, setContacts] = useState<Record<string, { phone: string; email: string }>>({});
  const [durations, setDurations] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return setError(NO_DB_MESSAGE);
    const fields = ['id', 'name', 'color', 'active'];
    if (withContacts) fields.push('phone', 'email', 'calendar_token', 'photo_data');
    if (withDuration) fields.push('default_minutes');
    const { data, error: err } = await supabase.from(table).select(fields.join(',')).order('name');
    if (err) return setError('טעינת הרשימה נכשלה.');
    const list = (data ?? []) as unknown as Item[];
    setRows(list);
    if (withContacts) {
      setContacts(Object.fromEntries(list.map((r) => [r.id, { phone: r.phone ?? '', email: r.email ?? '' }])));
    }
    if (withDuration) {
      setDurations(Object.fromEntries(list.map((r) => [r.id, r.default_minutes?.toString() ?? ''])));
    }
  }, [table, withContacts, withDuration]);

  useEffect(() => { load(); }, [load]);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return setError(NO_DB_MESSAGE);
    // שומרים את הטופס לפני ה-await: אחרי await, e.currentTarget כבר null
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get('name') ?? '').trim();
    if (name.length < 2) return setError('יש להזין שם (לפחות 2 תווים).');
    const payload: Record<string, string | number | null> = { name, color: String(f.get('color') ?? '#4a4a4a') };
    if (withContacts) {
      payload.phone = String(f.get('phone') ?? '').trim();
      payload.email = String(f.get('email') ?? '').trim();
    }
    if (withDuration) {
      const parsed = parseDuration(String(f.get('default_minutes') ?? ''));
      if (parsed === 'invalid') return setError('משך חייב להיות בין 5 ל-480 דקות.');
      payload.default_minutes = parsed;
    }
    const { error: err } = await supabase.from(table).insert(payload);
    if (err) return setError('השמירה נכשלה.');
    form.reset();
    setShowNew(false);
    setError('');
    load();
  }

  async function update(id: string, patch: Partial<Item>) {
    if (!supabase) return setError(NO_DB_MESSAGE);
    const { error: err } = await supabase.from(table).update(patch).eq('id', id);
    if (err) return setError('העדכון נכשל.');
    setError('');
    load();
  }

  async function saveContacts(id: string) {
    const c = contacts[id];
    if (c) await update(id, { phone: c.phone, email: c.email });
  }

  async function saveDuration(id: string) {
    const parsed = parseDuration(durations[id] ?? '');
    if (parsed === 'invalid') return setError('משך חייב להיות בין 5 ל-480 דקות.');
    await update(id, { default_minutes: parsed });
  }

  async function remove(r: Item) {
    if (!supabase) return setError(NO_DB_MESSAGE);
    const after = table === 'lecturers' ? 'ההרצאות שלו יישארו ללא מרצה.' : 'ההרצאות מסוג זה יישארו ללא סוג.';
    if (!window.confirm(`למחוק את "${r.name}" לצמיתות? ${after}`)) return;
    const { error: err } = await supabase.from(table).delete().eq('id', r.id);
    if (err) return setError('המחיקה נכשלה.');
    setError('');
    load();
  }

  async function copyFeed(token: string) {
    const url = `${window.location.origin}${feedPath(token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
    } catch {
      setCopied('');
      setError(`העתקה נכשלה. הקישור: ${url}`);
    }
  }

  // החלפת טוקן מבטלת את הקישור הישן. מתאים כשקישור נחשף בטעות.
  async function regenerateFeed(id: string, name: string) {
    if (!supabase) return setError(NO_DB_MESSAGE);
    if (!window.confirm(`להחליף את קישור היומן של ${name}? הקישור הנוכחי יפסיק לעבוד, וצריך להוסיף את החדש ליומן.`)) return;
    const { error: err } = await supabase.from('lecturers').update({ calendar_token: crypto.randomUUID() }).eq('id', id);
    if (err) return setError('החלפת הקישור נכשלה.');
    setCopied('');
    setError('');
    load();
  }

  const colCount = 3 + (withContacts ? 3 : 0) + (withDuration ? 1 : 0) + 1;

  return (
    <section>
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button type="button" className="secondary" onClick={() => setShowNew((v) => !v)}>
          {showNew ? 'ביטול' : addLabel}
        </button>
      </div>
      {error && <p className="err" role="alert">{error}</p>}

      {showNew && (
        <form onSubmit={add} className="toolbar">
          <input name="name" placeholder="שם" required minLength={2} aria-label="שם" />
          <input name="color" type="color" defaultValue="#4a4a4a" aria-label="צבע" style={{ width: 56 }} />
          {withContacts && <input name="phone" type="tel" placeholder="טלפון" aria-label="טלפון" />}
          {withContacts && <input name="email" type="email" placeholder="מייל" aria-label="מייל" />}
          {withDuration && (
            <input name="default_minutes" type="number" min={5} max={480} placeholder="משך (דקות)" aria-label="משך משוער בדקות" style={{ width: 140 }} />
          )}
          <button type="submit">שמירה</button>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>שם</th>{withContacts && <th>תמונה</th>}
              <th>צבע</th>
              {withContacts && <th>טלפון</th>}
              {withContacts && <th>מייל</th>}
              {withContacts && <th>יומן</th>}
              {withDuration && <th>משך משוער (דקות)</th>}
              <th>פעיל</th>
              <th>מחיקה</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {withContacts && (
                  <td>
                    <PhotoCell
                      name={r.name}
                      photo={(r as Item & { photo_data?: string | null }).photo_data ?? null}
                      onChange={(data) => update(r.id, { photo_data: data } as Partial<Item>)}
                    />
                  </td>
                )}
                <td>
                  <input
                    defaultValue={r.name}
                    key={`${r.id}-${r.name}`}
                    aria-label={`שם של ${r.name}`}
                    style={{ minWidth: 160 }}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== r.name) {
                        if (v.length < 2) return setError('השם חייב להכיל לפחות 2 תווים.');
                        update(r.id, { name: v });
                      } else {
                        e.target.value = r.name;
                      }
                    }}
                  />
                </td>
                <td>
                  <input
                    type="color"
                    value={r.color}
                    aria-label={`צבע של ${r.name}`}
                    style={{ width: 48, padding: 2 }}
                    onChange={(e) => update(r.id, { color: e.target.value })}
                  />
                </td>
                {withContacts && (
                  <td>
                    <input
                      type="tel"
                      value={contacts[r.id]?.phone ?? ''}
                      aria-label={`טלפון של ${r.name}`}
                      onChange={(e) => setContacts((c) => ({ ...c, [r.id]: { phone: e.target.value, email: c[r.id]?.email ?? '' } }))}
                      onBlur={() => saveContacts(r.id)}
                    />
                  </td>
                )}
                {withContacts && (
                  <td>
                    <input
                      type="email"
                      value={contacts[r.id]?.email ?? ''}
                      aria-label={`מייל של ${r.name}`}
                      onChange={(e) => setContacts((c) => ({ ...c, [r.id]: { phone: c[r.id]?.phone ?? '', email: e.target.value } }))}
                      onBlur={() => saveContacts(r.id)}
                    />
                  </td>
                )}
                {withContacts && (
                  <td>
                    {r.calendar_token && (
                      <div className="toolbar">
                        <button type="button" className="secondary" onClick={() => copyFeed(r.calendar_token!)}>
                          {copied === r.calendar_token ? 'הקישור הועתק' : 'העתק קישור ליומן'}
                        </button>
                        <a href={`webcal://${window.location.host}${feedPath(r.calendar_token)}`}>פתיחה באפל</a>
                        <button type="button" className="ghost" onClick={() => regenerateFeed(r.id, r.name)}>
                          החלפת קישור
                        </button>
                      </div>
                    )}
                    <p className="muted">בגוגל קלנדר: הוספת יומן ← מכתובת URL, והדבקה.</p>
                  </td>
                )}
                {withDuration && (
                  <td>
                    <input
                      type="number"
                      min={5}
                      max={480}
                      value={durations[r.id] ?? ''}
                      aria-label={`משך משוער של ${r.name}`}
                      style={{ width: 110 }}
                      onChange={(e) => setDurations((d) => ({ ...d, [r.id]: e.target.value }))}
                      onBlur={() => saveDuration(r.id)}
                    />
                  </td>
                )}
                <td>
                  <label className="checkline">
                    <input
                      type="checkbox"
                      checked={r.active}
                      onChange={(e) => update(r.id, { active: e.target.checked })}
                    />
                    פעיל
                  </label>
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    onClick={() => remove(r)}
                  >
                    מחיקה
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={colCount}>אין עדיין.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// תמונה למרצה: בחירת קובץ, הקטנה ל-256px בדפדפן, ושמירה כ-JPEG קטן
function PhotoCell({ name, photo, onChange }: {
  name: string;
  photo: string | null;
  onChange: (data: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function pick(file: File) {
    setErr('');
    if (!file.type.startsWith('image/')) return setErr('יש לבחור קובץ תמונה.');
    setBusy(true);
    try {
      const data = await shrinkImage(file, 256);
      if (data.length > 150000) return setErr('התמונה גדולה מדי גם אחרי הקטנה. נסו תמונה אחרת.');
      onChange(data);
    } catch {
      setErr('לא ניתן לקרוא את התמונה.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="photo-cell">
      {photo
        ? <img src={photo} alt={`תמונה של ${name}`} className="avatar" />
        : <span className="avatar avatar-empty" aria-hidden="true">{name.slice(0, 1)}</span>}
      <label className="btn-soft photo-btn">
        {busy ? 'מעלה...' : photo ? 'החלפה' : 'העלאה'}
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }}
        />
      </label>
      {photo && <button type="button" className="ghost" onClick={() => onChange(null)}>הסרה</button>}
      {err && <span className="err small">{err}</span>}
    </div>
  );
}

// הקטנת תמונה לריבוע בגודל size, ומחזיר data URL של JPEG
function shrinkImage(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no canvas'));
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

// ערך משך מהשדה: ריק -> null, מספר בטווח -> המספר, אחרת -> 'invalid'
export function parseDuration(raw: string): number | null | 'invalid' {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 5 || n > 480) return 'invalid';
  return n;
}
