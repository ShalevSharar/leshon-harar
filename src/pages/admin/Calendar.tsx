import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, NO_DB_MESSAGE } from '../../lib/supabase';
import SchoolPicker, { PickedSchool } from '../../components/SchoolPicker';
import {
  DEFAULT_END, DEFAULT_START, HEB_DAYS, HOUR_END, HOUR_START, ViewMode,
  addMinutesToTime, hhmm, minutesOf, monthGrid, parseLocalISO, rangeFor, sameDay, shift, toLocalISO, viewTitle, weekDays,
} from '../../lib/calendar';

type Named = { id: string; name: string; color: string; default_minutes?: number | null };

type Lecture = {
  id: string;
  lecture_date: string | null;
  start_time: string | null;
  end_time: string | null;
  grade: string;
  est_students: number | null;
  status: string;
  school_id: string;
  lecturer_id: string | null;
  lecture_type_id: string | null;
  schools: { name: string; city: string } | null;
  lecturers: { name: string; color: string } | null;
  lecture_types: { name: string; color: string } | null;
};

const STATUS_LABELS: Record<string, string> = { planned: 'מתוכננת', done: 'התקיימה', cancelled: 'בוטלה' };
const VIEW_LABELS: Record<ViewMode, string> = { day: 'יום', week: 'שבוע', month: 'חודש' };

// לוח שנה להרצאות: תצוגות יום/שבוע/חודש, סינון לפי מרצה וסוג, יצירה מהירה ופרטי הרצאה.
export default function Calendar() {
  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [rows, setRows] = useState<Lecture[]>([]);
  const [lecturers, setLecturers] = useState<Named[]>([]);
  const [types, setTypes] = useState<Named[]>([]);
  const [lecturerFilter, setLecturerFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<Lecture | null>(null);
  const [slot, setSlot] = useState<{ date: string; start?: string } | null>(null);
  const [editing, setEditing] = useState<Lecture | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return setError(NO_DB_MESSAGE);
    const { from, to } = rangeFor(view, anchor);
    const [l, lec, tp] = await Promise.all([
      supabase
        .from('lectures')
        .select('*, schools(name,city), lecturers(name,color), lecture_types(name,color)')
        .gte('lecture_date', from)
        .lte('lecture_date', to)
        .order('start_time', { ascending: true, nullsFirst: false }),
      supabase.from('lecturers').select('id,name,color').eq('active', true).order('name'),
      supabase.from('lecture_types').select('id,name,color,default_minutes').eq('active', true).order('name'),
    ]);
    if (l.error) return setError('טעינת הלוח נכשלה.');
    setError('');
    setRows((l.data ?? []) as unknown as Lecture[]);
    setLecturers((lec.data ?? []) as Named[]);
    setTypes((tp.data ?? []) as Named[]);
  }, [view, anchor]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => rows.filter((r) =>
      (!lecturerFilter || r.lecturer_id === lecturerFilter) &&
      (!typeFilter || r.lecture_type_id === typeFilter)),
    [rows, lecturerFilter, typeFilter],
  );

  // הרצאות לפי תאריך, ממוינות לפי שעה (הרצאות בלי שעה בסוף היום)
  const byDate = useMemo(() => {
    const map = new Map<string, Lecture[]>();
    for (const r of visible) {
      if (!r.lecture_date) continue;
      const list = map.get(r.lecture_date) ?? [];
      list.push(r);
      map.set(r.lecture_date, list);
    }
    return map;
  }, [visible]);

  const today = new Date();
  const days = view === 'month' ? monthGrid(anchor) : weekDays(anchor);

  return (
    <div className="card">
      <h1>לוח הרצאות</h1>
      {error && <p className="err" role="alert">{error}</p>}

      <div className="cal-bar">
        <div className="cal-nav">
          {/* ב-RTL החץ הימני (›) הוא לאחור והשמאלי (‹) הוא קדימה */}
          <button type="button" className="secondary" onClick={() => setAnchor(shift(view, anchor, -1))} aria-label="הקודם">›</button>
          <button type="button" className="secondary" onClick={() => setAnchor(new Date())}>היום</button>
          <button type="button" className="secondary" onClick={() => setAnchor(shift(view, anchor, 1))} aria-label="הבא">‹</button>
          <input
            type="date"
            aria-label="קפיצה לתאריך"
            value={toLocalISO(anchor)}
            onChange={(e) => e.target.value && setAnchor(parseLocalISO(e.target.value))}
          />
        </div>
        <h2 className="cal-title">{viewTitle(view, anchor)}</h2>
        <div className="cal-views" role="group" aria-label="תצוגה">
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
            <button key={v} type="button" className={`chip ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar">
        <select value={lecturerFilter} onChange={(e) => setLecturerFilter(e.target.value)} aria-label="סינון לפי מרצה">
          <option value="">כל המרצים</option>
          {lecturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="סינון לפי סוג הרצאה">
          <option value="">כל הסוגים</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="button" onClick={() => setSlot({ date: toLocalISO(anchor) })}>הרצאה חדשה</button>
      </div>

      {view === 'month' && (
        <div className="cal-month" role="grid" aria-label="חודש">
          {HEB_DAYS.map((d) => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
          {days.map((d) => {
            const key = toLocalISO(d);
            const items = byDate.get(key) ?? [];
            const outside = d.getMonth() !== anchor.getMonth();
            return (
              <div
                key={key}
                role="gridcell"
                className={`cal-cell ${outside ? 'out' : ''} ${sameDay(d, today) ? 'today' : ''}`}
                onClick={() => setSlot({ date: key })}
              >
                <div className="cal-daynum">{d.getDate()}</div>
                {items.slice(0, 3).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="cal-event"
                    style={{ background: r.lecture_types?.color ?? 'var(--accent)' }}
                    onClick={(e) => { e.stopPropagation(); setSelected(r); }}
                  >
                    {hhmm(r.start_time, DEFAULT_START)} {r.schools?.name ?? ''}
                  </button>
                ))}
                {items.length > 3 && <span className="muted">+{items.length - 3} נוספות</span>}
              </div>
            );
          })}
        </div>
      )}

      {view === 'week' && (
        <div className="cal-week">
          {days.map((d) => {
            const key = toLocalISO(d);
            const items = byDate.get(key) ?? [];
            return (
              <div key={key} className={`cal-col ${sameDay(d, today) ? 'today' : ''}`}>
                <button type="button" className="cal-colhead ghost" onClick={() => { setAnchor(d); setView('day'); }}>
                  {HEB_DAYS[d.getDay()]} {d.getDate()}
                </button>
                <button type="button" className="cal-add secondary" onClick={() => setSlot({ date: key })}>+ הרצאה</button>
                {items.length === 0 && <p className="muted">אין הרצאות</p>}
                {items.map((r) => (
                  <LectureBlock key={r.id} r={r} onOpen={() => setSelected(r)} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {view === 'day' && (
        <DayList
          items={byDate.get(toLocalISO(anchor)) ?? []}
          onOpen={setSelected}
          onAdd={(start) => setSlot({ date: toLocalISO(anchor), start })}
        />
      )}

      {!visible.length && <p className="muted">אין הרצאות בטווח הזה.</p>}

      {selected && (
        <LectureDetail
          lecture={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); load(); }}
          onEdit={() => { setEditing(selected); setSelected(null); }}
        />
      )}

      {editing && (
        <NewLecture
          date={editing.lecture_date ?? toLocalISO(anchor)}
          lecture={editing}
          lecturers={lecturers}
          types={types}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {slot && (
        <NewLecture
          date={slot.date}
          start={slot.start}
          lecturers={lecturers}
          types={types}
          onClose={() => setSlot(null)}
          onSaved={() => { setSlot(null); load(); }}
        />
      )}
    </div>
  );
}

// בלוק הרצאה בתצוגת שבוע
function LectureBlock({ r, onOpen }: { r: Lecture; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="cal-block"
      style={{ borderInlineStartColor: r.lecturers?.color ?? 'var(--accent)' }}
      onClick={onOpen}
    >
      <strong>{hhmm(r.start_time, DEFAULT_START)}–{hhmm(r.end_time, DEFAULT_END)}</strong>
      <span>{r.schools?.name ?? ''}</span>
      <span className="muted">{r.lecturers?.name ?? 'ללא מרצה'} · {r.lecture_types?.name ?? 'ללא סוג'}</span>
    </button>
  );
}

// תצוגת יום: שורה לכל שעה בטווח, עם ההרצאות של אותה שעה
function DayList({ items, onOpen, onAdd }: {
  items: Lecture[];
  onOpen: (r: Lecture) => void;
  onAdd: (start: string) => void;
}) {
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  const timed = items.filter((r) => r.start_time);
  const untimed = items.filter((r) => !r.start_time);
  return (
    <div className="cal-day">
      {hours.map((h) => {
        const label = `${String(h).padStart(2, '0')}:00`;
        const here = timed.filter((r) => Math.floor(minutesOf(hhmm(r.start_time, DEFAULT_START)) / 60) === h);
        return (
          <div key={h} className="cal-hour">
            <span className="cal-hourlabel">{label}</span>
            <div className="cal-hourbody">
              {here.map((r) => <LectureBlock key={r.id} r={r} onOpen={() => onOpen(r)} />)}
              {!here.length && (
                <button type="button" className="ghost cal-hoursuggest" onClick={() => onAdd(label)}>+</button>
              )}
            </div>
          </div>
        );
      })}
      {untimed.length > 0 && (
        <div className="cal-hour">
          <span className="cal-hourlabel">ללא שעה</span>
          <div className="cal-hourbody">
            {untimed.map((r) => <LectureBlock key={r.id} r={r} onOpen={() => onOpen(r)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// פרטי הרצאה, שינוי סטטוס ומעבר לכרטיס בית הספר
function LectureDetail({ lecture: r, onClose, onChanged, onEdit }: {
  lecture: Lecture;
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
}) {
  const [error, setError] = useState('');

  async function removeLecture() {
    if (!supabase) return setError(NO_DB_MESSAGE);
    if (!window.confirm('למחוק את ההרצאה לצמיתות? לא ניתן לשחזר אותה.')) return;
    const { error: err } = await supabase.from('lectures').delete().eq('id', r.id);
    if (err) return setError('המחיקה נכשלה.');
    onChanged();
  }

  async function setStatus(status: string) {
    if (!supabase) return setError(NO_DB_MESSAGE);
    const { error: err } = await supabase.from('lectures').update({ status }).eq('id', r.id);
    if (err) return setError('עדכון הסטטוס נכשל.');
    if (status === 'done') await supabase.from('schools').update({ stage: 'lecture_done' }).eq('id', r.school_id);
    onChanged();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card quick" role="dialog" aria-label="פרטי הרצאה" onClick={(e) => e.stopPropagation()}>
        <h2>{r.schools?.name ?? 'הרצאה'}</h2>
        <p>
          <strong>תאריך:</strong> {r.lecture_date ? parseLocalISO(r.lecture_date).toLocaleDateString('he-IL') : 'לא נקבע'}
          {' · '}
          <strong>שעות:</strong> {hhmm(r.start_time, DEFAULT_START)}–{hhmm(r.end_time, DEFAULT_END)}
        </p>
        <p><strong>מרצה:</strong> {r.lecturers?.name ?? 'לא שויך'}</p>
        <p><strong>סוג:</strong> {r.lecture_types?.name ?? 'לא שויך'}</p>
        <p><strong>שכבה:</strong> {r.grade || '—'} · <strong>תלמידים:</strong> {r.est_students ?? '—'}</p>
        <label>
          סטטוס
          <select value={r.status} onChange={(e) => setStatus(e.target.value)} aria-label="סטטוס הרצאה">
            {Object.entries(STATUS_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="toolbar">
          <Link to={`/admin/schools/${r.school_id}`}>כרטיס בית ספר</Link>
          <Link to={`/admin/lectures/${r.id}`}>תוצאות סקר</Link>
        </div>
        <div className="toolbar">
          <button type="button" className="secondary" onClick={onClose}>סגירה</button>
          <button type="button" className="secondary" onClick={onEdit}>עריכה</button>
          <button type="button" className="secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={removeLecture}>
            מחיקת הרצאה
          </button>
        </div>
      </div>
    </div>
  );
}

// יצירה ועריכה של הרצאה מהלוח. בעריכה (lecture) הטופס מתמלא מההרצאה ומעדכן את אותה שורה.
// ביצירה מעודכן שלב בית הספר; בעריכה לא, כי השלב כבר נקבע.
function NewLecture({ date, start, lecture, lecturers, types, onClose, onSaved }: {
  date: string;
  start?: string;
  lecture?: Lecture | null;
  lecturers: Named[];
  types: Named[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(lecture);
  const [school, setSchool] = useState<PickedSchool | null>(
    lecture ? { id: lecture.school_id, name: lecture.schools?.name ?? '', city: lecture.schools?.city ?? '' } : null,
  );
  const [error, setError] = useState('');
  const [typeId, setTypeId] = useState(lecture?.lecture_type_id ?? '');
  const minutes = types.find((t) => t.id === typeId)?.default_minutes ?? null;
  const [startTime, setStartTime] = useState(
    lecture ? hhmm(lecture.start_time, DEFAULT_START) : start ?? DEFAULT_START,
  );
  const [endTime, setEndTime] = useState(
    lecture
      ? hhmm(lecture.end_time, DEFAULT_END)
      : start ? `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:00` : DEFAULT_END,
  );

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return setError(NO_DB_MESSAGE);
    if (!school) return setError('יש לבחור בית ספר.');
    if (endTime <= startTime) return setError('שעת הסיום חייבת להיות אחרי שעת ההתחלה.');
    const f = new FormData(e.currentTarget);
    const est = String(f.get('est_students') ?? '').trim();
    const row = {
      school_id: school.id,
      lecture_date: String(f.get('lecture_date') ?? '') || null,
      start_time: startTime,
      end_time: endTime,
      lecturer_id: String(f.get('lecturer_id') ?? '') || null,
      lecture_type_id: String(f.get('lecture_type_id') ?? '') || null,
      grade: String(f.get('grade') ?? '').trim(),
      est_students: est ? Number(est) : null,
    };
    if (lecture) {
      const { error: err } = await supabase.from('lectures').update(row).eq('id', lecture.id);
      if (err) return setError('עדכון ההרצאה נכשל.');
      return onSaved();
    }
    const { error: err } = await supabase.from('lectures').insert(row);
    if (err) return setError('שמירת ההרצאה נכשלה.');
    await supabase.from('schools').update({ stage: 'lecture_scheduled' }).eq('id', school.id);
    onSaved();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="card quick" role="dialog" aria-label={editing ? 'עריכת הרצאה' : 'הרצאה חדשה'} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{editing ? 'עריכת הרצאה' : 'הרצאה חדשה'}</h2>
        <SchoolPicker value={school} onChange={setSchool} />
        <label>
          תאריך
          <input name="lecture_date" type="date" defaultValue={lecture?.lecture_date ?? date} required />
        </label>
        <div className="checks">
          <label>
            התחלה
            <input
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                if (minutes) setEndTime(addMinutesToTime(e.target.value, minutes));
              }}
              required
            />
          </label>
          <label>
            סיום
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </label>
        </div>
        <label>
          מרצה
          <select name="lecturer_id" defaultValue={lecture?.lecturer_id ?? ''}>
            <option value="">ללא מרצה</option>
            {lecturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label>
          סוג הרצאה
          <select
            name="lecture_type_id"
            value={typeId}
            onChange={(e) => {
              const v = e.target.value;
              setTypeId(v);
              const m = types.find((t) => t.id === v)?.default_minutes;
              if (m) setEndTime(addMinutesToTime(startTime, m));
            }}
          >
            <option value="">ללא סוג</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {minutes && <span className="muted">שעת הסיום מחושבת לפי משך משוער של {minutes} דקות, וניתן לשנותה.</span>}
        </label>
        <label>
          שכבה
          <input name="grade" defaultValue={lecture?.grade ?? ''} />
        </label>
        <label>
          מספר תלמידים
          <input name="est_students" type="number" min={0} defaultValue={lecture?.est_students ?? ''} />
        </label>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit">שמירה</button>
        <button type="button" className="secondary" onClick={onClose}>ביטול</button>
      </form>
    </div>
  );
}
