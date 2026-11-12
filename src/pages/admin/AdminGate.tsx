import { ReactNode, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import Login from './Login';

// שער: מציג את התוכן רק למשתמש מחובר שהמייל שלו ברשימה המאושרת (allowed_emails).
// מי שהוסר מהרשימה מנותק בטעינה הבאה. הבדיקה כאן היא בצד הלקוח; ההגנה על הנתונים עצמם היא ברמת הבסיס.
export default function AdminGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [denied, setDenied] = useState(false);

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
    const { data } = supabase.auth.onAuthStateChange((_event, s) => { verify(s); });
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
  return <>{children}</>;
}
