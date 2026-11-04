import { FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { VOLUNTEER_AREAS, VOLUNTEER_CONSENT_TEXT, VOLUNTEER_SOURCES } from '../config/settings';

const SOURCE_VALUES: string[] = VOLUNTEER_SOURCES.map((s) => s.value);

export default function VolunteerForm() {
  const [params] = useSearchParams();
  // מי שהגיע מ-QR/קישור מקבל מקור; ערך לא מוכר נופל ל"אחר"
  const rawSource = params.get('source') ?? 'other';
  const source = SOURCE_VALUES.includes(rawSource) ? rawSource : 'other';

  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const f = new FormData(e.currentTarget);
    // honeypot: בוט ממלא את השדה הנסתר
    if (f.get('website')) return setDone(true);
    if (!supabase) return setError('השמירה לא מוגדרת עדיין. פנו למנהל המערכת.');
    if (f.get('consent') !== 'on') return setError('יש לאשר את ההסכמה כדי להירשם.');

    setBusy(true);
    const { error: err } = await supabase.from('volunteers').insert({
      full_name: String(f.get('full_name') ?? '').trim(),
      phone: String(f.get('phone') ?? '').trim(),
      email: String(f.get('email') ?? '').trim(),
      city: String(f.get('city') ?? '').trim(),
      areas: f.getAll('areas').map(String),
      availability: String(f.get('availability') ?? '').trim(),
      source,
      consent: true,
    });
    setBusy(false);
    if (err) return setError('משהו השתבש, נסו שוב. אם זה חוזר, פנו אלינו.');
    setDone(true);
  }

  if (done) {
    return (
      <div className="page">
        <div className="card">
          <h1>תודה שנרשמתם!</h1>
          <p>ניצור איתכם קשר בקרוב.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <form className="card" onSubmit={onSubmit}>
        <h1>להתנדב עם "לשון הרע לא מדבר אליי"</h1>
        <label>שם מלא<input name="full_name" required minLength={2} autoComplete="name" /></label>
        <label>טלפון<input name="phone" type="tel" required inputMode="tel" autoComplete="tel" /></label>
        <label>מייל<input name="email" type="email" required autoComplete="email" /></label>
        <label>עיר<input name="city" required autoComplete="address-level2" /></label>
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 600, marginTop: 14 }}>איך תרצו לעזור?</legend>
          <div className="checks">
            {VOLUNTEER_AREAS.map((a) => (
              <label key={a}><input type="checkbox" name="areas" value={a} /> {a}</label>
            ))}
          </div>
        </fieldset>
        <label>זמינות<textarea name="availability" rows={2} /></label>
        <label className="checks" style={{ marginTop: 16 }}>
          <input type="checkbox" name="consent" required /> {VOLUNTEER_CONSENT_TEXT}
        </label>
        <input className="hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'שולח...' : 'שליחה'}</button>
      </form>
    </div>
  );
}
