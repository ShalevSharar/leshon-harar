import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Question = { id: string; audience: 'student' | 'teacher'; text: string; type: 'scale' | 'open' };
type SurveyData = {
  school_name: string;
  lecture_date: string | null;
  grade: string;
  questions: Question[];
};

const AUDIENCES = [
  { value: 'student', label: 'אני תלמיד/ה' },
  { value: 'teacher', label: 'אני מורה' },
] as const;

// דף סקר ציבורי: בלי התחברות. תלמידים אנונימיים לגמרי: אין זיהוי, ואין שמירה של מזהה.
export default function Survey() {
  const { token } = useParams();
  const [data, setData] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [audience, setAudience] = useState<'student' | 'teacher' | ''>('');
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const doneKey = `survey-done-${token}`;

  useEffect(() => {
    if (!supabase || !token) {
      setLoading(false);
      setError('הקישור לא תקין.');
      return;
    }
    try {
      if (localStorage.getItem(doneKey)) setDone(true);
    } catch { /* אין גישה לאחסון: נמשיך בלי חסימה מקומית */ }

    supabase.rpc('get_survey', { p_token: token }).then(({ data: d, error: err }) => {
      if (err || !d) setError('הקישור לא נמצא. בדקו שהעתקתם את הכתובת המלאה.');
      else setData(d as SurveyData);
      setLoading(false);
    });
  }, [token, doneKey]);

  function setAnswer(id: string, value: number | string) {
    setAnswers((cur) => ({ ...cur, [id]: value }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !token || !audience || !data) return;
    const f = new FormData(e.currentTarget);
    // honeypot: בוט ממלא את השדה הנסתר
    if (f.get('website')) return setDone(true);

    const mine = data.questions.filter((q) => q.audience === audience);
    const missing = mine.find((q) => q.type === 'scale' && answers[q.id] === undefined);
    if (missing) return setError('נא לענות על כל השאלות בסולם.');

    const payload: Record<string, number | string> = {};
    mine.forEach((q) => {
      const v = answers[q.id];
      if (v !== undefined && v !== '') payload[q.id] = v;
    });

    setBusy(true);
    setError('');
    const { data: ok, error: err } = await supabase.rpc('submit_survey', {
      p_token: token,
      p_audience: audience,
      p_answers: payload,
    });
    setBusy(false);
    if (err || !ok) return setError('השליחה לא הצליחה. נסו שוב.');
    try { localStorage.setItem(doneKey, '1'); } catch { /* ignore */ }
    setDone(true);
  }

  if (loading) return <div className="page"><p>טוען...</p></div>;

  if (!data) {
    return <div className="page"><div className="card"><p className="err" role="alert">{error}</p></div></div>;
  }

  if (done) {
    return (
      <div className="page">
        <div className="card">
          <h1>תודה!</h1>
          <p>התשובות נשמרו. זה עוזר לנו להבין מה עובד ומה אפשר לשפר.</p>
        </div>
      </div>
    );
  }

  const mine = audience ? data.questions.filter((q) => q.audience === audience) : [];

  return (
    <div className="page">
      <form className="card" onSubmit={onSubmit}>
        <h1>סקר אחרי ההרצאה</h1>
        <p className="muted">{data.school_name}{data.grade && ` · ${data.grade}`}</p>

        {!audience && (
          <>
            <p><strong>מי אתם?</strong></p>
            <div className="choice-row">
              {AUDIENCES.map((a) => (
                <button key={a.value} type="button" className="secondary big" onClick={() => setAudience(a.value)}>
                  {a.label}
                </button>
              ))}
            </div>
          </>
        )}

        {audience && (
          <>
            {mine.map((q) => (
              <div key={q.id} className="question">
                <p><strong>{q.text}</strong></p>
                {q.type === 'scale' ? (
                  <div className="scale" role="radiogroup" aria-label={q.text}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={answers[q.id] === n}
                        className={answers[q.id] === n ? 'scale-btn on' : 'scale-btn'}
                        onClick={() => setAnswer(q.id, n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={(answers[q.id] as string) ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    aria-label={q.text}
                  />
                )}
              </div>
            ))}
            <input className="hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            {error && <p className="err" role="alert">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? 'שולח...' : 'שליחה'}</button>
            <button type="button" className="ghost" onClick={() => setAudience('')}>חזרה</button>
          </>
        )}
      </form>
    </div>
  );
}
