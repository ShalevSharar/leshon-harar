// בניית קובץ iCalendar (RFC 5545) ללא תלות חיצונית.
// כל הזמנים של ההרצאות נשמרים בשעון ישראל ומומרים ל-UTC, כך שלא צריך VTIMEZONE.

const TZ = 'Asia/Jerusalem';

export type FeedLecture = {
  id: string;
  lecture_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  grade: string;
  est_students: number | null;
  notes: string;
  type_name: string | null;
  school_name: string | null;
  school_address: string | null;
  school_city: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  updated_at: string;
};

export type FeedPayload = {
  lecturer: { name: string };
  lectures: FeedLecture[];
};

// הפרש השעון (ms) של ישראל ביחס ל-UTC בנקודת זמן נתונה
function tzOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - utcMs;
}

// תאריך ושעה מקומיים בישראל -> Date (UTC), כולל מעבר שעון קיץ/חורף
function zonedToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.slice(0, 5).split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(naive);
  let t = naive - off1;
  const off2 = tzOffsetMs(t);
  if (off2 !== off1) t = naive - off2;
  return new Date(t);
}

function fmtUtc(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function fmtDateOnly(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function addOneDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}${String(next.getUTCMonth() + 1).padStart(2, '0')}${String(next.getUTCDate()).padStart(2, '0')}`;
}

// escape לפי RFC 5545: לוכסן, נקודה-פסיק, פסיק ושורה חדשה
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// קיפול שורות ל-75 בתים. לא חותכים באמצע תו UTF-8 (עברית).
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      out.push(cur);
      cur = ' ' + ch;
      curBytes = 1 + b;
      limit = 75;
    } else {
      cur += ch;
      curBytes += b;
    }
  }
  out.push(cur);
  return out.join('\r\n');
}

function statusOf(s: string): string {
  return s === 'cancelled' ? 'CANCELLED' : 'CONFIRMED';
}

function describe(r: FeedLecture): string {
  const lines: string[] = [];
  if (r.school_name) lines.push(`בית ספר: ${r.school_name}`);
  if (r.grade) lines.push(`שכבה: ${r.grade}`);
  if (r.est_students != null) lines.push(`מספר תלמידים משוער: ${r.est_students}`);
  if (r.type_name) lines.push(`סוג הרצאה: ${r.type_name}`);
  if (r.contact_name) lines.push(`איש קשר: ${r.contact_name}${r.contact_phone ? ` (${r.contact_phone})` : ''}`);
  if (r.notes) lines.push(`הערות: ${r.notes}`);
  return lines.join('\n');
}

function vevent(r: FeedLecture, dtstamp: string): string[] {
  const uid = `${r.id}@lashon-hara-crm`;
  const seq = Math.floor(new Date(r.updated_at).getTime() / 1000);
  const location = [r.school_address, r.school_city].filter(Boolean).join(', ');
  const out = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `LAST-MODIFIED:${fmtUtc(new Date(r.updated_at))}`,
    `SEQUENCE:${seq}`,
    `SUMMARY:${esc(`הרצאה: ${r.school_name ?? ''}`)}`,
  ];

  if (r.start_time) {
    const start = zonedToUtc(r.lecture_date, r.start_time);
    const end = r.end_time ? zonedToUtc(r.lecture_date, r.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
    out.push(`DTSTART:${fmtUtc(start)}`, `DTEND:${fmtUtc(end)}`);
  } else {
    // בלי שעה: אירוע של יום שלם
    out.push(`DTSTART;VALUE=DATE:${fmtDateOnly(r.lecture_date)}`, `DTEND;VALUE=DATE:${addOneDay(r.lecture_date)}`);
  }

  if (location) out.push(`LOCATION:${esc(location)}`);
  const desc = describe(r);
  if (desc) out.push(`DESCRIPTION:${esc(desc)}`);
  out.push(`STATUS:${statusOf(r.status)}`, 'END:VEVENT');
  return out;
}

export function buildIcs(payload: FeedPayload): string {
  const dtstamp = fmtUtc(new Date());
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//lashon-hara-crm//lectures//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(`הרצאות – ${payload.lecturer.name}`)}`,
    `X-WR-TIMEZONE:${TZ}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];
  const events = payload.lectures.flatMap((r) => vevent(r, dtstamp));
  const lines = [...header, ...events, 'END:VCALENDAR'];
  return lines.map(fold).join('\r\n') + '\r\n';
}
