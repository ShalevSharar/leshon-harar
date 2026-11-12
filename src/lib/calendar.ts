// עזרי תאריכים ללוח השנה. כל החישובים בזמן מקומי (לא toISOString, שמזיז יום סביב חצות בישראל).

export type ViewMode = 'day' | 'week' | 'month';

export const HEB_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const HEB_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

// שעות הלוח: מ-7:00 עד 20:00 (שעה בכל שורה)
export const HOUR_START = 7;
export const HOUR_END = 20;
export const DEFAULT_START = '09:00';
export const DEFAULT_END = '10:00';

export function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseLocalISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// תחילת השבוע (ראשון)
export function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay());
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// רשת חודש: מתחילה ביום ראשון שלפני ה-1 לחודש, עד סוף שבוע של היום האחרון
export function monthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const start = startOfWeek(first);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const end = addDays(last, 6 - last.getDay());
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// טווח התאריכים שצריך לשלוף לתצוגה הנוכחית
export function rangeFor(view: ViewMode, anchor: Date): { from: string; to: string } {
  if (view === 'day') return { from: toLocalISO(anchor), to: toLocalISO(anchor) };
  if (view === 'week') {
    const days = weekDays(anchor);
    return { from: toLocalISO(days[0]), to: toLocalISO(days[6]) };
  }
  const days = monthGrid(anchor);
  return { from: toLocalISO(days[0]), to: toLocalISO(days[days.length - 1]) };
}

// ניווט קדימה/אחורה לפי התצוגה
export function shift(view: ViewMode, anchor: Date, dir: 1 | -1): Date {
  if (view === 'day') return addDays(anchor, dir);
  if (view === 'week') return addDays(anchor, 7 * dir);
  return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
}

export function viewTitle(view: ViewMode, anchor: Date): string {
  if (view === 'day') return `${HEB_DAYS[anchor.getDay()]}, ${anchor.getDate()} ב${HEB_MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
  if (view === 'week') {
    const days = weekDays(anchor);
    const a = days[0];
    const b = days[6];
    return `${a.getDate()} ב${HEB_MONTHS[a.getMonth()]} – ${b.getDate()} ב${HEB_MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  return `${HEB_MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
}

// "09:00:00" או "09:00" -> "09:00"
export function hhmm(t: string | null | undefined, fallback: string): string {
  if (!t) return fallback;
  return t.slice(0, 5);
}

export function minutesOf(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// שעת התחלה + משך בדקות -> שעת סיום בפורמט HH:MM. לא עוברים את חצות (נחתך ב-23:59).
export function addMinutesToTime(start: string, minutes: number): string {
  const total = Math.min(minutesOf(start) + minutes, 23 * 60 + 59);
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}
