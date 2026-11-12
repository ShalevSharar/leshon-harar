import { FormEvent, ReactNode, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import Login from './Login';

// שער: מציג את התוכן רק למשתמש מחובר שהמייל שלו ברשימה המאושרת (allowed_emails).
// כשהמשתמש נכנס דרך קישור איפוס סיסמה, מוצג קודם טופס בחירת סיסמה חדשה.
export default function AdminGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [denied, setDenied] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      return;
    }

    async function verify(s: Session | null) {
      if (!s || !supabase) return setSession(s);
      const email = (s.user.email ?? '').toLowerCase();
      const { data } = await supabase.from('allowed_emails').select('email').eq('email', email).maybeSingle();
      if (!data) {
        setDenied(true);
        await supabase.auth.signOut();
        return setSession(null);
      }
      setDenied(false);
      setSession(s);
    }

    supabase.auth.getSession().then(({ data }) => verify(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      verify(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="page"><p>טוען...</p></div>;
  if (!session) {
    return (
      <>
        {denied && (
          <div className="page">
            <p className="err" role="alert">המייל הזה אינו מורשה להיכנס למערכת. פנו למי שמנהל את הרשימה.</p>
          </div>
        )}
        <Login />
      </>
    );
  }
  if (recovery) return <SetNewPassword onDone={() => setRecovery(false)} />;
  return <>{children}</>;
}

// טופס בחירת סיסמה חדשה אחרי קישור איפוס
function SetNewPassword({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const f = new FormData(e.currentTarget);
    const p1 = String(f.get('password') ?? '');
    const p2 = String(f.get('confirm') ?? '');
    if (p1.length < 6) return setError('הסיסמה חייבת להכיל לפחות 6 תווים.');
    if (p1 !== p2) return setError('הסיסמאות אינן זהות.');
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (err) return setError('עדכון הסיסמה נכשל. נסו לבקש קישור חדש.');
    onDone();
  }

  return (
    <div className="page">
      <form className="card" onSubmit={onSubmit}>
        <h1>בחירת סיסמה חדשה</h1>
        <label>סיסמה חדשה<input name="password" type="password" required minLength={6} autoComplete="new-password" /></label>
        <label>אימות סיסמה<input name="confirm" type="password" required minLength={6} autoComplete="new-password" /></label>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'שומר...' : 'שמירת סיסמה'}</button>
      </form>
    </div>
  );
}
