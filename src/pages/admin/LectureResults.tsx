import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type Question = { id: string; audience: 'student' | 'teacher'; position: number; text: string; type: 'scale' | 'open' };
type Response = { audience: 'student' | 'teacher'; answers: Record<string, number | string>; created_at: string };

// תוצאות סקר להרצאה אחת: ממוצע לכל שאלת סולם, שאלות חלשות באדום, ותשובות פתוחות.
export default function LectureResults() {
  const { id } = useParams();
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !id) return;
    const db = supabase;
    (async () => {
      const [lec, qs, rs] = await Promise.all([
        db.from('lectures').select('lecture_date, schools(name)').eq('id', id).maybeSingle(),
        db.from('survey_questions').select('*').eq('active', true).order('position'),
        db.from('survey_responses').select('audience, answers, created_at').eq('lecture_id', id),
      ]);
      if (lec.error || qs.error || rs.error) {
        setError('טעינת התוצאות נכשלה.');
      } else {
        const schoolName = (lec.data as unknown as { schools?: { name?: string } } | null)?.schools?.name ?? '';
        setTitle(`${schoolName}${lec.data?.lecture_date ? ` · ${lec.data.lecture_date}` : ''}`);
        // הסקר לתלמידים בלבד: שאלות ותשובות של מורים לא מוצגות
        setQuestions(((qs.data ?? []) as Question[]).filter((q) => q.audience === 'student'));
        setResponses(((rs.data ?? []) as Response[]).filter((r) => r.audience === 'student'));
      }
      setLoading(false);
    })();
  }, [id]);

  const counts = { student: responses.length };

  function average(q: Question): number | null {
    const vals = responses
      .filter((r) => r.audience === q.audience)
      .map((r) => r.answers[q.id])
      .filter((v): v is number => typeof v === 'number');
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  const scaleQs = questions.filter((q) => q.type === 'scale');
  const weakest = scaleQs
    .map((q) => ({ q, avg: average(q) }))
    .filter((x): x is { q: Question; avg: number } => x.avg !== null && x.avg < 3.5);

  if (loading) return <div className="card"><p>טוען...</p></div>;

  return (
    <div className="card">
      <p><Link to="/admin/lectures">← חזרה להרצאות</Link></p>
      <h1>תוצאות סקר</h1>
      <p className="muted">{title}</p>
      {error && <p className="err" role="alert">{error}</p>}

      <p>
        משיבים: תלמידים <strong>{counts.student}</strong>
      </p>

      {weakest.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <h2 className="important">לשיפור בהרצאה הבאה</h2>
          <ul>
            {weakest.map((x) => <li key={x.q.id} className="important">{x.q.text} · ממוצע {x.avg.toFixed(1)}</li>)}
          </ul>
        </div>
      )}

      <h2>ממוצעים (מתוך 5)</h2>
      {scaleQs.length === 0 && <p className="muted">אין שאלות סולם פעילות.</p>}
      {scaleQs.map((q) => {
        const avg = average(q);
        return (
          <div key={q.id} className="bar-row">
            <div>{q.text}</div>
            <div className="bar">
              <div className="bar-fill" style={{ width: avg ? `${(avg / 5) * 100}%` : '0%' }} />
            </div>
            <div className="muted">{avg ? avg.toFixed(1) : 'אין תשובות'}</div>
          </div>
        );
      })}

      <h2>תשובות פתוחות</h2>
      {questions.filter((q) => q.type === 'open').map((q) => {
        const items = responses
          .filter((r) => r.audience === q.audience && typeof r.answers[q.id] === 'string' && r.answers[q.id])
          .map((r) => r.answers[q.id] as string);
        return (
          <div key={q.id} className="open-block">
            <p><strong>{q.text}</strong></p>
            {items.length ? (
              <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
            ) : <p className="muted">עדיין אין תשובות.</p>}
          </div>
        );
      })}
    </div>
  );
}
