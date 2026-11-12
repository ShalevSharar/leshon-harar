// חישובי דוחות הסקר. פונקציות טהורות בלי React, כדי שיהיה אפשר לבדוק אותן בנפרד.
// כל הסקרים כאן הם של תלמידים בלבד. תשובות לסולם הן מספרים 1-5.

export type SurveyQuestion = { id: string; text: string; type: 'scale' | 'open'; position: number };
export type SurveyResponse = { lecture_id: string; answers: Record<string, number | string>; created_at: string };
export type LectureInfo = {
  id: string;
  lecture_date: string | null;
  school: string;
  type: string;       // שם סוג ההרצאה, או NO_TYPE
  lecturer: string;   // שם המרצה, או NO_LECTURER
};

export const NO_TYPE = 'ללא סוג הרצאה';
export const NO_LECTURER = 'ללא מרצה';
export const MIN_LECTURER_RESPONSES = 5;   // מתחת לזה לא מציגים ציון מרצה
export const LOW_SAMPLE = 10;              // מתחת לזה מציגים הערת מדגם קטן

export type Period = 'all' | '90' | 'year';

export type Filters = { type: string; period: Period; now?: Date };

// סינון תשובות לפי סוג הרצאה ותקופה
export function filterResponses(
  responses: SurveyResponse[],
  lectures: LectureInfo[],
  f: Filters,
): SurveyResponse[] {
  const byId = new Map(lectures.map((l) => [l.id, l]));
  const now = f.now ?? new Date();
  let from: number | null = null;
  if (f.period === '90') from = now.getTime() - 90 * 24 * 3600 * 1000;
  if (f.period === 'year') from = new Date(now.getFullYear(), 0, 1).getTime();
  return responses.filter((r) => {
    const lec = byId.get(r.lecture_id);
    if (!lec) return false;
    if (f.type !== 'all' && lec.type !== f.type) return false;
    if (from !== null && new Date(r.created_at).getTime() < from) return false;
    return true;
  });
}

// כמה ענו 1,2,3,4,5 לשאלה
export function distribution(q: SurveyQuestion, rs: SurveyResponse[]): number[] {
  const out = [0, 0, 0, 0, 0];
  for (const r of rs) {
    const v = r.answers[q.id];
    if (typeof v === 'number' && v >= 1 && v <= 5) out[v - 1] += 1;
  }
  return out;
}

export function countOf(counts: number[]): number {
  return counts.reduce((a, b) => a + b, 0);
}

export function average(counts: number[]): number | null {
  const n = countOf(counts);
  if (!n) return null;
  return counts.reduce((sum, c, i) => sum + c * (i + 1), 0) / n;
}

// אחוז שענו 4 או 5 (top-box)
export function topBoxPct(counts: number[]): number | null {
  const n = countOf(counts);
  if (!n) return null;
  return Math.round(((counts[3] + counts[4]) / n) * 100);
}

export type RankedQuestion = {
  q: SurveyQuestion;
  counts: number[];
  n: number;
  avg: number | null;
  topBox: number | null;
};

// כל שאלות הסולם, ממוינות לפי top-box מהגבוה לנמוך
export function rankScaleQuestions(questions: SurveyQuestion[], rs: SurveyResponse[]): RankedQuestion[] {
  return questions
    .filter((q) => q.type === 'scale')
    .map((q) => {
      const counts = distribution(q, rs);
      return { q, counts, n: countOf(counts), avg: average(counts), topBox: topBoxPct(counts) };
    })
    .sort((a, b) => (b.topBox ?? -1) - (a.topBox ?? -1) || a.q.position - b.q.position);
}

// ציון ממוצע לתשובה אחת (ממוצע השאלות הסולם שלה)
export function responseScore(r: SurveyResponse, questions: SurveyQuestion[]): number | null {
  const vals = questions
    .filter((q) => q.type === 'scale')
    .map((q) => r.answers[q.id])
    .filter((v): v is number => typeof v === 'number');
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export type GroupStat = { key: string; n: number; avg: number | null; hidden: boolean };

// ממוצע לקבוצה (לפי סוג, מרצה או הרצאה). קבוצות עם פחות מ-minN תשובות מסומנות כמוסתרות.
export function groupStats(
  responses: SurveyResponse[],
  questions: SurveyQuestion[],
  keyOf: (r: SurveyResponse) => string,
  minN = 1,
): GroupStat[] {
  const groups = new Map<string, number[]>();
  for (const r of responses) {
    const s = responseScore(r, questions);
    if (s === null) continue;
    const k = keyOf(r);
    const list = groups.get(k) ?? [];
    list.push(s);
    groups.set(k, list);
  }
  return [...groups.entries()]
    .map(([key, scores]) => {
      const n = scores.length;
      const hidden = n < minN;
      return { key, n, avg: hidden ? null : scores.reduce((a, b) => a + b, 0) / n, hidden };
    })
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
}

// מילים נפוצות בתשובות פתוחות. רשימת מילות עצירה קצרה בעברית; בלי שורש מילים.
const STOP = new Set([
  'של', 'את', 'על', 'עם', 'זה', 'זו', 'זאת', 'היה', 'הייתה', 'היו', 'לא', 'כי', 'אני', 'אנחנו', 'הוא', 'היא',
  'הם', 'הן', 'גם', 'או', 'אם', 'כל', 'יותר', 'מאוד', 'שלי', 'שלו', 'לי', 'לו', 'בה', 'בו', 'כמו', 'אבל',
  'כך', 'מה', 'איך', 'מי', 'יש', 'אין', 'להם', 'לנו', 'שלא', 'שזה', 'הזה', 'הזאת', 'ועל', 'ואת', 'ומה',
]);

export function wordFrequency(texts: string[], top = 15): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of texts) {
    const words = t
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP.has(w));
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'he'))
    .slice(0, top);
}

// משפט סיכום שנגזר מהנתונים בלבד
export function headline(total: number, avg: number | null, topBox: number | null): string {
  if (!total || avg === null || topBox === null) return 'עדיין אין תשובות לסקר בתקופה ובסינון שנבחרו.';
  const base = `הציון הממוצע הוא ${avg.toFixed(1)} מתוך 5, ו-${topBox}% דירגו 4 או 5.`;
  return total < LOW_SAMPLE ? `${base} מעט תשובות (${total}), לכן הנתונים עדיין לא מייצגים מלא.` : base;
}
