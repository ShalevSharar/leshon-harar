import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase, NO_DB_MESSAGE } from '../../lib/supabase';
import SchoolPicker, { PickedSchool } from '../../components/SchoolPicker';
import { addMinutesToTime } from '../../lib/calendar';

type Lecture = {
  id: string; lecture_date: string | null; grade: string; est_students: number | null;
  status: string; notes: string; survey_token: string; school_id: string;
  start_time: string | null; end_time: string | null;
  lecturer_id: string | null; lecture_type_id: string | null;
  schools: { name: string; city: string } | null;
  lecturers: { name: string } | null;
  lecture_types: { name: string } | null;
};
type Named = { id: string; name: string; default_minutes?: number | null };
const STATUS_LABELS: Record<string, string> = { planned: 'מתוכננת', done: 'התקיימה', cancelled: 'בוטלה' };

// הרצאות: רשימה, תזמון חדש, סימון סטטוס והעתקת קישור לסקר.
export default function Lectures() {
  const [rows, setRows] = useState<Lecture[]>([]);
  const [school, setSchool] = useState<PickedSchool | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [qrImg, setQrImg] = useState('');
  const [lecturers, setLecturers] = useState<Named[]>([]);
  const [types, setTypes] = useState<Named[]>([]);
  const [typeId, setTypeId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const typeMinutes = types.find((t) => t.id === typeId)?.default_minutes ?? null;

  useEffect(() => {
    if (!qrFor) return setQrImg('');
    QRCode.toDataURL(`${window.location.origin}/survey/${qrFor}`, { width: 260, margin: 1 }).then(setQrImg);
  }, [qrFor]);

  const load = useCallback(async () => {
    if (!supabase) return setError(NO_DB_MESSAGE);
    const [l, lec, tp] = await Promise.all([
      supabase.from('lectures').select('*, schools(name,city), lecturers(name), lecture_types(name)').order('lecture_date', { ascending: false }),
      supabase.from('lecturers').select('id,name').eq('active', true).order('name'),
      supabase.from('lecture_types').select('id,name,default_minutes').eq('active', true).order('name'),
    ]);
    if (l.error) return setError('טעינת ההרצאות נכשלה.');
    setRows((l.data ?? []) as unknown as Lecture[]);
    setLecturers((lec.data ?? []) as Named[]);
    setTypes((tp.data ?? []) as Named[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addLecture(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return setError(NO_DB_MESSAGE);
    // שומרים את הטופס לפני ה-await: אחרי await, e.currentTarget כבר null
    const form = e.currentTarget;
    const f = new FormData(form);
    const schoolId = school?.id ?? '';
    if (!schoolId) return setError('יש לבחור בית ספר.');
    const est = String(f.get('est_students') ?? '').trim();
    const { error: err } = await supabase.from('lectures').insert({
      school_id: schoolId,
      lecture_date: String(f.get('lecture_date') ?? '') || null,
      start_time: String(f.get('start_time') ?? '') || null,
      end_time: String(f.get('end_time') ?? '') || null,
      lecturer_id: String(f.get('lecturer_id') ?? '') || null,
      lecture_type_id: String(f.get('lecture_type_id') ?? '') || null,
      grade: String(f.get('grade') ?? '').trim(),
      est_students: est ? Number(est) : null,
    });
    if (err) return setError('שמירת ההרצאה נכשלה.');
    // עדכון שלב בית הספר להרצאה שנקבעה
    await supabase.from('schools').update({ stage: 'lecture_scheduled' }).eq('id', schoolId);
    form.reset();
    setSchool(null);
    setTypeId('');
    setStartTime('');
    setEndTime('');
    setError('');
    load();
  }

  async function setStatus(id: string, status: string, schoolId: string) {
    if (!supabase) return setError(NO_DB_MESSAGE);
    const { error: err } = await supabase.from('lectures').update({ status }).eq('id', id);
    if (err) return setError('עדכון הסטטוס נכשל.');
    if (status === 'done') await supabase.from('schools').update({ stage: 'lecture_done' }).eq('id', schoolId);
    load();
  }

  async function removeLecture(id: string) {
    if (!supabase) return setError(NO_DB_MESSAGE);
    if (!window.confirm('למחוק את ההרצאה לצמיתות? לא ניתן לשחזר אותה.')) return;
    const { error: err } = await supabase.from('lectures').delete().eq('id', id);
    if (err) return setError('המחיקה נכשלה.');
    load();
  }

  async function copySurvey(token: string) {
    const url = `${window.location.origin}/survey/${token}`;
    // על localhost הקישור עובד רק על המחשב הזה. לשליחה לבתי הספר יש להעתיק מהאתר החי.
    if (window.location.hostname === 'localhost') {
      setError('שימו לב: הקישור הזה עובד רק על המחשב הזה. להעתקה לשליחה, פתחו את המערכת מ-https://leshon-harar.vercel.app/admin');
    }
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
          <input
            name="start_time"
            type="time"
            aria-label="שעת התחלה"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              if (typeMinutes) setEndTime(addMinutesToTime(e.target.value, typeMinutes));
            }}
          />
          <input name="end_time" type="time" aria-label="שעת סיום" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          <select name="lecturer_id" aria-label="מרצה" defaultValue="">
            <option value="">ללא מרצה</option>
            {lecturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select
            name="lecture_type_id"
            aria-label="סוג הרצאה"
            value={typeId}
            onChange={(e) => {
              const v = e.target.value;
              setTypeId(v);
              const m = types.find((t) => t.id === v)?.default_minutes;
              if (m && startTime) setEndTime(addMinutesToTime(startTime, m));
            }}
          >
            <option value="">ללא סוג</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input name="grade" placeholder="שכבה" />
          <input name="est_students" type="number" min={0} placeholder="מספר תלמידים" />
          <button type="submit" className="secondary">שמירה</button>
        </div>
      </form>

      {qrFor && qrImg && (
        <div className="card qr-card" style={{ marginBottom: 16, textAlign: 'center' }}>
          <p><strong>סריקה לסקר</strong> (להדפסה או להקרנה לפני סוף ההרצאה)</p>
          <img src={qrImg} alt="QR לסקר ההרצאה" width={260} height={260} />
          <p className="muted">{`${window.location.origin}/survey/${qrFor}`}</p>
          <button type="button" className="secondary" onClick={() => window.print()}>הדפסה</button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>תאריך</th><th>שעות</th><th>בית ספר</th><th>מרצה</th><th>סוג</th><th>שכבה</th><th>תלמידים</th><th>סטטוס</th><th>סקר</th></tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td>{l.lecture_date ?? 'לא נקבע'}</td>
                <td>{l.start_time ? `${l.start_time.slice(0, 5)}–${(l.end_time ?? '').slice(0, 5)}` : ''}</td>
                <td><Link to={`/admin/schools/${l.school_id}`}>{l.schools?.name ?? ''}</Link></td>
                <td>{l.lecturers?.name ?? ''}</td>
                <td>{l.lecture_types?.name ?? ''}</td>
                <td>{l.grade}</td>
                <td>{l.est_students ?? ''}</td>
                <td>
                  <select value={l.status} onChange={(e) => setStatus(l.id, e.target.value, l.school_id)} aria-label="סטטוס הרצאה">
                    {Object.entries(STATUS_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                </td>
                <td>
                  <div className="toolbar">
                    <button type="button" className="secondary" onClick={() => copySurvey(l.survey_token)}>
                      {copied === l.survey_token ? 'הקישור הועתק' : 'העתק קישור'}
                    </button>
                    <button type="button" className="secondary" onClick={() => setQrFor(qrFor === l.survey_token ? null : l.survey_token)}>
                      QR לסקר
                    </button>
                    <Link to={`/admin/lectures/${l.id}`}>תוצאות</Link>
                    <button
                      type="button"
                      className="secondary"
                      style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      onClick={() => removeLecture(l.id)}
                    >
                      מחיקה
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9}>אין הרצאות עדיין.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
