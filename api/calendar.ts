// פונקציית Vercel: מחזירה את היומן של מרצה כקובץ .ics לפי טוקן.
// נקראת דרך /cal/<token>.ics (ראו vercel.json). משתמשת רק במפתח anon, ללא service_role.
import { buildIcs, type FeedPayload } from './_ics.js';

declare const process: { env: Record<string, string | undefined> };

// צורה מינימלית של בקשה/תגובה בסגנון Node (Vercel מעביר req.query מה-rewrite)
type Req = { query: Record<string, string | string[] | undefined> };
type Res = {
  status(code: number): Res;
  setHeader(name: string, value: string): void;
  send(body: string): void;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: Req, res: Res): Promise<void> {
  const raw = req.query.token;
  const token = Array.isArray(raw) ? raw[0] ?? '' : raw ?? '';
  if (!UUID_RE.test(token)) {
    res.status(404).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send('לא נמצא');
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    res.status(500).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send('השרת לא מוגדר');
    return;
  }

  let payload: FeedPayload | null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/get_lecturer_calendar`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token: token }),
    });
    if (!r.ok) {
      res.status(502).setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send('שגיאה בטעינת היומן');
      return;
    }
    payload = (await r.json()) as FeedPayload | null;
  } catch {
    res.status(502).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send('שגיאה בטעינת היומן');
    return;
  }

  // טוקן לא קיים (או מרצה לא פעיל): אותה תשובה כמו לטוקן שגוי
  if (!payload) {
    res.status(404).setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send('לא נמצא');
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="lectures.ics"');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=300');
  res.send(buildIcs(payload));
}
