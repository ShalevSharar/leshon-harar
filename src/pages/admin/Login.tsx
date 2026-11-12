import { FormEvent, useState } from 'react';
import { supabase, NO_DB_MESSAGE } from '../../lib/supabase';

// כניסה עם Google מוסתרת עד שההגדרה בסופאבייס תסתיים. להפוך ל-true כשהיא מוכנה.
const GOOGLE_ENABLED = false;

// כניסה והרשמה עם מייל וסיסמה. הרשמה מותרת רק למיילים ברשימה המאושרת (ראו 0010).
export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!supabase) return setError(NO_DB_MESSAGE);
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email') ?? '').trim();
    const password = String(f.get('password') ?? '');
    setBusy(true);

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (err) return setError('פרטי ההתחברות שגויים.');
      // מאזין ל-onAuthStateChange ב-AdminGate מרנדר מחדש אוטומטית
      return;
    }

    const { data, error: err } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) return setError('ההרשמה נכשלה. ודאו שהמייל מאושר במערכת, ושהסיסמה לפחות 6 תווים.');
    if (!data.session) {
      // אם סופאבייס דורש אישור מייל, החשבון ייפתח אחרי לחיצה על הקישור במייל
      setInfo('נשלח מייל אישור. לחצו על הקישור ואז התחברו.');
      setMode('login');
    }
    // אם יש session, AdminGate ייכנס למערכת אוטומטית
  }

  // כניסה עם Google. בפעם הראשונה החשבון נוצר אוטומטית, אבל רק למיילים ברשימה המאושרת.
  async function signInWithGoogle() {
    setError('');
    if (!supabase) return setError(NO_DB_MESSAGE);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin` },
    });
    if (err) setError('ההתחברות עם Google נכשלה.');
  }

  const isSignup = mode === 'signup';

  return (
    <div className="page">
      <form className="card" onSubmit={onSubmit}>
        <h1>{isSignup ? 'הרשמה למערכת' : 'כניסה למערכת'}</h1>
        {GOOGLE_ENABLED && (
          <>
            <button type="button" className="secondary" onClick={signInWithGoogle} style={{ width: '100%' }}>
              כניסה עם Google
            </button>
            <p className="muted" style={{ textAlign: 'center' }}>או עם מייל וסיסמה</p>
          </>
        )}
        <label>מייל<input name="email" type="email" required autoComplete="username" /></label>
        <label>
          סיסמה
          <input
            name="password"
            type="password"
            required
            minLength={isSignup ? 6 : undefined}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
        </label>
        {error && <p className="err" role="alert">{error}</p>}
        {info && <p className="ok" role="status">{info}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'רגע...' : isSignup ? 'הרשמה' : 'כניסה'}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(''); setInfo(''); }}
        >
          {isSignup ? 'יש לי כבר חשבון, כניסה' : 'אין לי חשבון, הרשמה'}
        </button>
      </form>
    </div>
  );
}
