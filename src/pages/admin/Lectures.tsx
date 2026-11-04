import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import SchoolPicker, { PickedSchool } from '../../components/SchoolPicker';

type Lecture = {
  id: string; lecture_date: string | null; grade: string; est_students: number | null;
  status: string; notes: string; survey_token: string; school_id: string;
  schools: { name: string; city: string } | null;
};
const STATUS_LABELS: Record<string, string> = { planned: 'מתוכננת', done: 'התקיימה', cancelled: 'בוטלה' };

// הרצאות: רשימה, תזמון חדש, סימון סטטוס והעתקת קישור לסקר.
export default function Lectures() {
  const [rows, setRows] = useState<Lecture[]>([]);
  const [school, setSchool] = useState<PickedSchool | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    const l = await supabase.from('lectures').select('*, schools(name,city)').order('lecture_date', { ascending: false });
    if (l.error) return setError('טעינת ההרצאות נכשלה.');
    setRows((l.data ?? []) as unknown as Lecture[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addLecture(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const f = new FormData(e.currentTarget);
    const schoolId = school?.id ?? '';
    if (!schoolId) return setError('יש לבחור בית ספר.');
    const est = String(f.get('est_students') ?? '').trim();
    const { error: err } = await supabase.from('lectures').insert({
      school_id: schoolId,
      lecture_date: String(f.get('lecture_date') ?? '') || null,
      grade: String(f.get('grade') ?? '').trim(),
      est_students: est ? Number(est) : null,
    });
    if (err) return setError('שמירת ההרצאה נכשלה.');
    // עדכון שלב בית הספר להרצאה שנקבעה
    await supabase.from('schools').update({ stage: 'lecture_scheduled' }).eq('id', schoolId);
    e.currentTarget.reset();
    setSchool(null);
    setError('');
    load();
  }

  async function setStatus(id: string, status: string, schoolId: string) {
    if (!supabase) return;
    const { error: err } = await supabase.from('lectures').update({ status }).eq('id', id);
    if (err) return setError('עדכון הסטטוס נכשל.');
    if (status === 'done') await supabase.from('schools').update({ stage: 'lecture_done' }).eq('id', schoolId);
    load();
  }

  async function copySurvey(token: string) {
    const url = `${window.location.origin}/survey/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
    } catch {
      setCopied('');
      setError(`העתקה נכשלה. הקישור: ${url}`);
    }
  }

  return (
    <div className="card">
      <h1>הרצאות</h1>
      {error && <p className="err" role="alert">{error}</p>}

      <form onSubmit={addLecture} className="card" style={{ background: 'transparent', padding: 0, marginBottom: 16 }}>
        <h2>הרצאה חדשה</h2>
        <div className="toolbar">
          <SchoolPicker value={school} onChange={setSchool} />
          <input name="lecture_date" type="date" aria-label="תאריך" />
          <input name="grade" placeholder="שכבה" />
          <input name="est_students" type="number" min={0} placeholder="מספר תלמידים" />
          <button type="submit" className="secondary">שמירה</button>
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>תאריך</th><th>בית ספר</th><th>שכבה</th><th>תלמידים</th><th>סטטוס</th><th>סקר</th></tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td>{l.lecture_date ?? 'לא נקבע'}</td>
                <td><Link to={`/admin/schools/${l.school_id}`}>{l.schools?.name ?? ''}</Link></td>
                <td>{l.grade}</td>
                <td>{l.est_students ?? ''}</td>
                <td>
                  <select value={l.status} onChange={(e) => setStatus(l.id, e.target.value, l.school_id)} aria-label="סטטוס הרצאה">
                    {Object.entries(STATUS_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                </td>
                <td>
                  <button type="button" className="secondary" onClick={() => copySurvey(l.survey_token)}>
                    {copied === l.survey_token ? 'הקישור הועתק' : 'העתק קישור לסקר'}
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6}>אין הרצאות עדיין.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
