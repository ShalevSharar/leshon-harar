import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase, NO_DB_MESSAGE } from '../../lib/supabase';

type Allowed = { email: string; note: string; created_at: string };

// ניהול המיילים שמורשים להיכנס למערכת. הוספה מאפשרת לאדם החדש להירשם (עם מייל וסיסמה או Google).
export default function AdminUsers() {
  const [rows, setRows] = useState<Allowed[]>([]);
  const [me, setMe] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return setError(NO_DB_MESSAGE);
    const { data: s } = await supabase.auth.getSession();
    setMe((s.session?.user.email ?? '').toLowerCase());
    const { data, error: err } = await supabase
      .from('allowed_emails')
      .select('email,note,created_at')
      .order('created_at', { ascending: true });
    if (err) return setError('טעינת הרשימה נכשלה.');
    setError('');
    setRows((data ?? []) as Allowed[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return setError(NO_DB_MESSAGE);
    // שומרים את הטופס לפני ה-await: אחרי await, e.currentTarget כבר null
    const form = e.currentTarget;
    const f = new FormData(form);
    const email = String(f.get('email') ?? '').trim().toLowerCase();
    const note = String(f.get('note') ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('כתובת המייל לא תקינה.');
    const { error: err } = await supabase.from('allowed_emails').insert({ email, note });
    if (err) {
      return setError(err.code === '23505' ? 'המייל הזה כבר ברשימה.' : 'ההוספה נכשלה.');
    }
    form.reset();
    setInfo(`${email} נוסף לרשימה. אפשר להירשם עם המייל הזה.`);
    setError('');
    load();
  }

  async function remove(email: string) {
    if (!supabase) return setError(NO_DB_MESSAGE);
    if (email === me) return setError('לא ניתן להסיר את המייל שלכם.');
    if (!window.confirm(`להסיר את ${email} מהרשימה? מי שכבר נרשם לא ייכנס יותר למערכת, והרשמה חדשה לא תתאפשר.`)) return;
    const { error: err } = await supabase.from('allowed_emails').delete().eq('email', email);
    if (err) return setError('ההסרה נכשלה.');
    setInfo(`${email} הוסר מהרשימה.`);
    setError('');
    load();
  }

  return (
    <div className="card">
      <h1>משתמשים</h1>
      <p className="muted">מיילים שמורשים להיכנס למערכת. הוסיפו כאן מייל של מי שצריך גישה.</p>

      <form onSubmit={add} className="toolbar">
        <input name="email" type="email" required placeholder="מייל" aria-label="מייל חדש" style={{ width: 280 }} />
        <input name="note" placeholder="הערה (למשל: שם או תפקיד)" aria-label="הערה" style={{ width: 240 }} />
        <button type="submit">הוספה</button>
      </form>

      {error && <p className="err" role="alert">{error}</p>}
      {info && <p className="ok" role="status">{info}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>מייל</th><th>הערה</th><th>נוסף בתאריך</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email}>
                <td>{r.email}{r.email === me && <span className="tag"> (אתם)</span>}</td>
                <td>{r.note}</td>
                <td>{new Date(r.created_at).toLocaleDateString('he-IL')}</td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    disabled={r.email === me}
                    onClick={() => remove(r.email)}
                  >
                    הסרה
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4}>אין מיילים ברשימה.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
