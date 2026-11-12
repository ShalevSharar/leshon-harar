import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, NO_DB_MESSAGE } from '../../lib/supabase';
import BarChart from '../../components/charts/BarChart';
import StackedBar100 from '../../components/charts/StackedBar100';
import {
  LectureInfo, LOW_SAMPLE, MIN_LECTURER_RESPONSES, NO_LECTURER, NO_TYPE, Period, SurveyQuestion, SurveyResponse,
  average, countOf, distribution, filterResponses, groupStats, headline, rankScaleQuestions, topBoxPct, wordFrequency,
} from '../../lib/surveyStats';

type RawLecture = {
  id: string; lecture_date: string | null;
  schools: { name: string } | null;
  lecture_types: { name: string } | null;
  lecturers: { name: string } | null;
};

const PERIOD_LABEL: Record<Period, string> = { all: 'כל הזמנים', '90': '3 חודשים אחרונים', year: 'השנה' };
const TABS_LABEL_FALLBACK = 'תשובות';

// דוח סקרים לתלמידים. סדר העמוד: סיכום, מה חזק ומה לשפר, כל השאלות בתרשים אחד,
// השוואות, תשובות פתוחות, ורשימת הרצאות. הכול מחושב מהתשובות בפועל, בלי נתוני דוגמה.
export default function SurveySummary() {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [lectures, setLectures] = useState<LectureInfo[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [typeF, setTypeF] = useState('all');
  const [period, setPeriod] = useState<Period>('all');
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [sortLectures, setSortLectures] = useState<'avg' | 'date'>('avg');

  useEffect(() => {
    if (!supabase) {
      setError(NO_DB_MESSAGE);
      setLoading(false);
      return;
    }
    const db = supabase;
    (async () => {
      const [qs, ls, rs] = await Promise.all([
        db.from('survey_questions').select('id,text,type,position,audience').eq('active', true).eq('audience', 'student').order('position'),
        db.from('lectures').select('id,lecture_date,schools(name),lecture_types(name),lecturers(name)'),
        db.from('survey_responses').select('lecture_id,answers,created_at').eq('audience', 'student'),
      ]);
      if (qs.error || ls.error || rs.error) {
        setError('טעינת הדוח נכשלה.');
      } else {
        setQuestions(((qs.data ?? []) as (SurveyQuestion & { audience: string })[]).map((q) => ({ id: q.id, text: q.text, type: q.type, position: q.position })));
        setLectures(((ls.data ?? []) as unknown as RawLecture[]).map((l) => ({
          id: l.id,
          lecture_date: l.lecture_date,
          school: l.schools?.name ?? '',
          type: l.lecture_types?.name ?? NO_TYPE,
          lecturer: l.lecturers?.name ?? NO_LECTURER,
        })));
        setResponses((rs.data ?? []) as SurveyResponse[]);
      }
      setLoading(false);
    })();
  }, []);

  const typeNames = useMemo(() => [...new Set(lectures.map((l) => l.type))].sort((a, b) => a.localeCompare(b, 'he')), [lectures]);
  const filtered = useMemo(() => filterResponses(responses, lectures, { type: typeF, period }), [responses, lectures, typeF, period]);
  const ranked = useMemo(() => rankScaleQuestions(questions, filtered), [questions, filtered]);
  const scaleQs = useMemo(() => questions.filter((q) => q.type === 'scale'), [questions]);
  const openQs = useMemo(() => questions.filter((q) => q.type === 'open'), [questions]);

  // סיכום כללי: כל התשובות לשאלות הסולם יחד
  const totalCounts = [0, 0, 0, 0, 0];
  for (const r of ranked) r.counts.forEach((c, i) => { totalCounts[i] += c; });
  const overallAvg = average(totalCounts);
  const overallTopBox = topBoxPct(totalCounts);
  const respondentCount = filtered.length;
  const lecturesWithResponses = new Set(filtered.map((r) => r.lecture_id)).size;

  const typeStats = useMemo(() => groupStats(filtered, questions, (r) => lectures.find((l) => l.id === r.lecture_id)?.type ?? NO_TYPE), [filtered, questions, lectures]);
  const lecturerStats = useMemo(
    () => groupStats(filtered, questions, (r) => lectures.find((l) => l.id === r.lecture_id)?.lecturer ?? NO_LECTURER, MIN_LECTURER_RESPONSES),
    [filtered, questions, lectures],
  );
  const lectureStats = useMemo(() => groupStats(filtered, questions, (r) => r.lecture_id), [filtered, questions]);

  const strengths = ranked.filter((r) => r.n > 0).slice(0, 3);
  const weak = ranked.filter((r) => r.n > 0).slice(-3).reverse();

  if (loading) return <div className="card"><p>טוען...</p></div>;

  return (
    <div className="report">
      {/* סרגל סינון דביק: מוסתר בהדפסה */}
      <div className="report-filters no-print">
        <div className="chips" role="group" aria-label="סוג הרצאה">
          <button type="button" className={`chip ${typeF === 'all' ? 'on' : ''}`} onClick={() => setTypeF('all')}>כל הסוגים</button>
          {typeNames.map((t) => (
            <button key={t} type="button" className={`chip ${typeF === t ? 'on' : ''}`} onClick={() => setTypeF(t)}>{t}</button>
          ))}
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="תקופה">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}
        </select>
        <button type="button" className="secondary" onClick={() => window.print()}>הדפסה / PDF</button>
        <nav className="report-nav" aria-label="ניווט בדוח">
          <a href="#summary">סיכום</a><a href="#questions">שאלות</a><a href="#compare">השוואות</a><a href="#open">תשובות פתוחות</a><a href="#lectures">הרצאות</a>
        </nav>
      </div>

      <h1>דוח סקרי תלמידים</h1>
      {error && <p className="err" role="alert">{error}</p>}
      {!responses.length && <div className="card"><p className="muted">עדיין אין תשובות סקר. הדוח יתמלא אוטומטית אחרי שתלמידים ישיבו.</p></div>}

      {/* 1. סיכום */}
      <section id="summary" className="report-section">
        <div className="summary-cards">
          <div className="kpi-card"><div className="kpi-value">{respondentCount}</div><div className="kpi-label">תשובות סקר</div></div>
          <div className="kpi-card"><div className="kpi-value">{lecturesWithResponses}</div><div className="kpi-label">הרצאות עם תשובות</div></div>
          <div className="kpi-card"><div className="kpi-value">{overallAvg !== null ? overallAvg.toFixed(1) : '—'}</div><div className="kpi-label">ממוצע (מתוך 5)</div></div>
          <div className="kpi-card"><div className="kpi-value">{overallTopBox !== null ? `${overallTopBox}%` : '—'}</div><div className="kpi-label">ענו 4 או 5</div></div>
        </div>
        <p className="headline">{headline(respondentCount, overallAvg, overallTopBox)}</p>
        {respondentCount > 0 && respondentCount < LOW_SAMPLE && <p className="muted small">מדגם קטן: מומלץ לקרוא את המספרים כמגמה ראשונית.</p>}
        <p className="muted small">הדוח לא מציג שיעור השבה, כי הזמנות לסקר אינן נשמרות במערכת.</p>
      </section>

      {/* 2. חזק ולשיפור */}
      <section className="report-section two-cols">
        <div className="card">
          <h2>החזקות ביותר</h2>
          {strengths.length ? strengths.map((r) => (
            <p key={r.q.id} className="ranked"><span className="dot ok" /> {r.q.text} <span className="muted">· {r.avg?.toFixed(1)} · {r.topBox}%</span></p>
          )) : <p className="muted">אין תשובות עדיין.</p>}
        </div>
        <div className="card">
          <h2>לשיפור</h2>
          {weak.length ? weak.map((r) => (
            <p key={r.q.id} className="ranked"><span className={`dot ${(r.avg ?? 5) < 3.5 ? 'warn' : 'neutral'}`} /> {r.q.text} <span className="muted">· {r.avg?.toFixed(1)} · {r.topBox}%</span></p>
          )) : <p className="muted">אין תשובות עדיין.</p>}
        </div>
      </section>

      {/* 3. כל השאלות בתרשים אחד */}
      <section id="questions" className="report-section card">
        <h2>כל השאלות במבט אחד</h2>
        <p className="muted small">כל פס מחולק לפי התשובות 1 עד 5. לחצו על שאלה כדי לראות כמה ענו בכל ציון.</p>
        <StackedBar100
          rows={ranked.map((r) => ({
            id: r.q.id,
            label: `ש${scaleQs.findIndex((q) => q.id === r.q.id) + 1}. ${r.q.text}`,
            counts: r.counts,
            avg: r.avg,
            topBox: r.topBox,
          }))}
          activeId={expandedQ}
          onRowClick={(id) => setExpandedQ(expandedQ === id ? null : id)}
        />
        {expandedQ && (() => {
          const r = ranked.find((x) => x.q.id === expandedQ);
          if (!r) return null;
          return (
            <div className="q-card expanded">
              <p><strong>{r.q.text}</strong></p>
              <BarChart labels={['1', '2', '3', '4', '5']} series={[{ name: 'תשובות', color: 'var(--accent)', values: distribution(r.q, filtered) }]} height={180} />
            </div>
          );
        })()}
      </section>

      {/* 4. השוואות */}
      <section id="compare" className="report-section two-cols">
        <div className="card">
          <h2>לפי סוג הרצאה</h2>
          {typeStats.length ? typeStats.map((g) => (
            <Bar key={g.key} label={g.key} value={g.avg} n={g.n} />
          )) : <p className="muted">אין מספיק נתונים.</p>}
        </div>
        <div className="card">
          <h2>לפי מרצה</h2>
          <p className="muted small">מוצג רק למרצים עם לפחות {MIN_LECTURER_RESPONSES} תשובות.</p>
          {lecturerStats.length ? lecturerStats.map((g) => (
            g.hidden
              ? <p key={g.key} className="muted">{g.key}: פחות מ-{MIN_LECTURER_RESPONSES} תשובות</p>
              : <Bar key={g.key} label={g.key} value={g.avg} n={g.n} />
          )) : <p className="muted">אין מספיק נתונים.</p>}
        </div>
      </section>

      {/* 5. תשובות פתוחות */}
      <section id="open" className="report-section card">
        <h2>מה אמרו התלמידים</h2>
        <div className="chips" role="tablist">
          {openQs.map((q, i) => (
            <button
              key={q.id}
              type="button"
              role="tab"
              aria-selected={(openQ ?? openQs[0]?.id) === q.id}
              className={`chip ${(openQ ?? openQs[0]?.id) === q.id ? 'on' : ''}`}
              onClick={() => { setOpenQ(q.id); setShowAll(false); setSearch(''); }}
            >
              {q.text.length > 40 ? q.text.slice(0, 40) + '…' : q.text || `${TABS_LABEL_FALLBACK} ${i + 1}`}
            </button>
          ))}
        </div>
        {(() => {
          const q = openQs.find((x) => x.id === (openQ ?? openQs[0]?.id));
          if (!q) return <p className="muted">אין שאלות פתוחות פעילות.</p>;
          const items = filtered
            .filter((r) => typeof r.answers[q.id] === 'string' && (r.answers[q.id] as string).trim())
            .map((r) => ({ text: (r.answers[q.id] as string).trim(), at: r.created_at }))
            .sort((a, b) => b.at.localeCompare(a.at));
          const words = wordFrequency(items.map((i) => i.text));
          const shown = items.filter((i) => !search.trim() || i.text.includes(search.trim()));
          const visible = showAll ? shown : shown.slice(0, 10);
          return (
            <>
              <p className="muted small">{items.length} תשובות</p>
              {words.length > 0 && (
                <div className="word-chips">
                  <span className="muted small">מילים נפוצות:</span>
                  {words.map((w) => (
                    <button key={w.word} type="button" className="chip" onClick={() => setSearch(w.word)}>{w.word} ({w.count})</button>
                  ))}
                </div>
              )}
              <input className="no-print" type="search" placeholder="חיפוש בתשובות" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="חיפוש בתשובות" />
              {visible.length ? (
                <ul className="quotes">
                  {visible.map((i, idx) => <li key={idx}>“{i.text}”</li>)}
                </ul>
              ) : <p className="muted">אין תשובות שתואמות.</p>}
              {shown.length > 10 && (
                <button type="button" className="secondary no-print" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'הצגת פחות' : `הצגת כל ${shown.length} התשובות`}
                </button>
              )}
            </>
          );
        })()}
      </section>

      {/* 6. הרצאות */}
      <section id="lectures" className="report-section card">
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>הרצאות</h2>
          <select value={sortLectures} onChange={(e) => setSortLectures(e.target.value as 'avg' | 'date')} aria-label="מיון הרצאות" className="no-print">
            <option value="avg">מיון: הציון הנמוך קודם</option>
            <option value="date">מיון: תאריך</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="pretty">
            <thead><tr><th>בית ספר</th><th>תאריך</th><th>סוג</th><th>מרצה</th><th className="num">תשובות</th><th className="num">ממוצע</th><th></th></tr></thead>
            <tbody>
              {lectureStats
                .map((g) => ({ g, lec: lectures.find((l) => l.id === g.key) }))
                .filter((x) => x.lec)
                .sort((a, b) => sortLectures === 'date'
                  ? (b.lec!.lecture_date ?? '').localeCompare(a.lec!.lecture_date ?? '')
                  : (a.g.avg ?? 99) - (b.g.avg ?? 99))
                .map(({ g, lec }) => (
                  <tr key={g.key}>
                    <td>{lec!.school}</td>
                    <td className="nowrap">{lec!.lecture_date ?? ''}</td>
                    <td>{lec!.type}</td>
                    <td>{lec!.lecturer}</td>
                    <td className="num">{g.n}</td>
                    <td className="num">{g.avg !== null ? g.avg.toFixed(1) : '—'}</td>
                    <td><Link className="btn-soft no-print" to={`/admin/lectures/${g.key}`}>📊 פירוט</Link></td>
                  </tr>
                ))}
              {!lectureStats.length && <tr><td colSpan={7}>אין הרצאות עם תשובות בסינון הזה.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <p className="muted small no-print">
        {countOf(totalCounts)} תשובות לשאלות סולם בסינון הנבחר.
      </p>
    </div>
  );
}

// שורת השוואה: שם, פס ממוצע מתוך 5, ומספר התשובות
function Bar({ label, value, n }: { label: string; value: number | null; n: number }) {
  const pct = value !== null ? (value / 5) * 100 : 0;
  return (
    <div className="cmp-row">
      <span>{label}</span>
      <div className="funnel-bar"><div style={{ width: `${pct}%` }} /></div>
      <span className="muted">{value !== null ? value.toFixed(1) : '—'} · {n}</span>
    </div>
  );
}
