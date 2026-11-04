import { FormEvent, useState } from 'react';
import { supabase } from '../../lib/supabase';

// התחברות לדוד בלבד (מייל + סיסמה). הרשמה ציבורית כבויה ב-Supabase.
export default function Login() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!supabase) return setError('השירות לא מוגדר. פנו למנהל המערכת.');
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: String(f.get('email') ?? '').trim(),
      password: String(f.get('password') ?? ''),
    });
    setBusy(false);
    if (err) return setError('פרטי ההתחברות שגויים.');
    // מאזין ל-onAuthStateChange ב-AdminGate מרנדר מחדש אוטומטית
  }

  return (
    <div className="page">
      <form className="card" onSubmit={onSubmit}>
        <h1>כניסה למערכת</h1>
        <label>מייל<input name="email" type="email" required autoComplete="username" /></label>
        <label>סיסמה<input name="password" type="password" required autoComplete="current-password" /></label>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'מתחבר...' : 'כניסה'}</button>
      </form>
    </div>
  );
}
