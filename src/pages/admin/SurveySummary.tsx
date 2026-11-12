import { useEffect, useMemo, useState } from 'react';
import { supabase, NO_DB_MESSAGE } from '../../lib/supabase';
import BarChart from '../../components/charts/BarChart';

type Question = { id: string; audience: 'student' | 'teacher'; position: number; text: string; type: 'scale' | 'open' };
type Lecture = { id: string; lecture_date: string | null; lecture_type_id: string | null; schools: { name: string } | null; lecture_types: { name: string } | null };
type Response = { lecture_id: string; audience: 'student' | 'teacher'; answers: Record<string, number | string> };

const AUD_LABEL: Record<string, string> = { student: 'תלמידים', teacher: 'מורים' };
const NO_TYPE = 'ללא סוג הרצאה';

// סיכום סקרים מכל ההרצאות, מקובץ לפי סוג הרצאה. בלי בחירה בין מורה לתלמיד: הממוצעים והתשובות מוצגים יחד,
// עם תווית קטנה לקהל. בראש כל סוג: מה לשפר (שאלות חלשות ותשובות "מה לשפר").
export default function SurveySummary() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setError(NO_DB_MESSAGE);
      setLoading(false);
      return;
    }
    const db = supabase;
    (async () => {
      const [qs, ls, rs] = await Promise.all([
        db.from('survey_questions').select('id,audience,position,text,type').eq('active', true).order('position'),
        db.from('lectures').select('id,lecture_date,lecture_type_id,schools(name),lecture_types(name)'),
        db.from('survey_responses').select('lecture_id,audience,answers'),
      ]);
      if (qs.error || ls.error || rs.error) {
        setError('טעינת הסיכום נכשלה.');
      } else {
        // הסקר לתלמידים בלבד: שאלות ותשובות של מורים לא מוצגות
        setQuestions(((qs.data ?? []) as Question[]).filter((q) => q.audience === 'student'));
        setLectures((ls.data ?? []) as unknown as Lecture[]);
        setResponses(((rs.data ?? []) as Response[]).filter((r) => r.audience === 'student'));
      }
      setLoading(false);
    })();
  }, []);

  // הרצאות ותשובותיהן, מקובצות לפי שם סוג ההרצאה
  const groups = useMemo(() => {
    const byType = new Map<string, { lectures: Lecture[]; responses: Response[] }>();
    const lectureType = new Map(lectures.map((l) => [l.id, l.lecture_types?.name ?? NO_TYPE]));
    for (const l of lectures) {
      const key = l.lecture_types?.name ?? NO_TYPE;
      const g = byType.get(key) ?? { lectures: [], responses: [] };
      g.lectures.push(l);
      byType.set(key, g);
    }
    for (const r of responses) {
      const key = lectureType.get(r.lecture_id) ?? NO_TYPE;
      const g = byType.get(key);
      if (g) g.responses.push(r);
    }
    return [...byType.entries()].sort(([a], [b]) => a.localeCompare(b, 'he'));
  }, [lectures, responses]);

  if (loading) return <div className="card"><p>טוען...</p></div>;

  return (
    <div className="card">
      <h1>סיכום סקרים</h1>
      <p className="muted">מכל ההרצאות, לפי סוג הרצאה. לפירוט של הרצאה בודדת: מהרשימה או מלוח השנה, לחצו "תוצאות".</p>
      {error && <p className="err" role="alert">{error}</p>}
      {!lectures.length && <p className="muted">עדיין אין הרצאות.</p>}

      {groups.map(([typeName, g]) => (
        <TypeSection key={typeName} typeName={typeName} lectures={g.lectures} responses={g.responses} questions={questions} />
      ))}
    </div>
  );
}

function TypeSection({ typeName, lectures, responses, questions }: {
  typeName: string;
  lectures: Lecture[];
  responses: Response[];
  questions: Question[];
}) {
  const scaleQs = questions.filter((q) => q.type === 'scale');
  const openQs = questions.filter((q) => q.type === 'open');

  // ממוצע לכל שאלת סולם, על כל התשובות (תלמידים ומורים יחד, לפי השאלה עצמה)
  const rows = scaleQs.map((q) => {
    const vals = responses
      .filter((r) => r.audience === q.audience)
      .map((r) => r.answers[q.id])
      .filter((v): v is number => typeof v === 'number');
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return { q, avg, n: vals.length };
  });

  const avgLabels = rows.map((_, i) => `ש${i + 1}`);
  // כמה ענו 1,2,3,4,5 בכל שאלה
  const countsFor = (q: Question) =>
    [1, 2, 3, 4, 5].map((score) =>
      responses.filter((r) => r.audience === q.audience && r.answers[q.id] === score).length,
    );

  const weak = rows.filter((x) => x.avg !== null && x.avg < 3.5);
  const improveQs = openQs.filter((q) => q.text.includes('לשפר'));
  const improveTexts = improveQs.flatMap((q) =>
    responses.filter((r) => r.audience === q.audience && typeof r.answers[q.id] === 'string' && r.answers[q.id])
      .map((r) => r.answers[q.id] as string),
  );

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2>{typeName}</h2>
      <p className="muted">
        הרצאות: <strong>{lectures.length}</strong> · תשובות סקר: <strong>{responses.length}</strong>
      </p>

      <h3>לשיפור</h3>
      {weak.length ? (
        <ul>
          {weak.map((x) => (
            <li key={x.q.id} className="important">
              {x.q.text} <span className="tag">({AUD_LABEL[x.q.audience]})</span> · ממוצע {x.avg?.toFixed(1)} מתוך {x.n} תשובות
            </li>
          ))}
        </ul>
      ) : <p className="muted">אין שאלות מתחת לממוצע 3.5.</p>}
      {improveTexts.length > 0 && (
        <>
          <p><strong>הצעות לשיפור מהמשיבים:</strong></p>
          <ul>{improveTexts.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </>
      )}

      <h3>ממוצעים (מתוך 5)</h3>
      <BarChart
        labels={avgLabels}
        series={[{ name: 'ממוצע', color: 'var(--accent)', values: rows.map((x) => x.avg ?? 0) }]}
      />
      <h3>כמה ענו 1 עד 5 בכל שאלה</h3>
      <div className="q-charts">
        {rows.map((x, i) => (
          <div key={x.q.id} className="q-card">
            <p><strong>ש{i + 1}.</strong> {x.q.text}</p>
            <BarChart labels={['1', '2', '3', '4', '5']} series={[{ name: 'תשובות', color: 'var(--accent)', values: countsFor(x.q) }]} height={170} />
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>שאלה</th><th>קהל</th><th>ממוצע</th><th>תשובות</th></tr></thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.q.id}>
                <td>{x.q.text}</td>
                <td>{AUD_LABEL[x.q.audience]}</td>
                <td>{x.avg !== null ? x.avg.toFixed(1) : '—'}</td>
                <td>{x.n}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4}>אין שאלות סולם פעילות.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3>תשובות פתוחות</h3>
      {openQs.map((q) => {
        const items = responses
          .filter((r) => r.audience === q.audience && typeof r.answers[q.id] === 'string' && r.answers[q.id])
          .map((r) => r.answers[q.id] as string);
        return (
          <div key={q.id} className="open-block">
            <p><strong>{q.text}</strong> <span className="tag">({AUD_LABEL[q.audience]})</span></p>
            {items.length ? <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="muted">עדיין אין תשובות.</p>}
          </div>
        );
      })}
    </section>
  );
}
