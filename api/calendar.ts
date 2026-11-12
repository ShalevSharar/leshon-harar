// פונקציית Vercel: מחזירה את היומן של מרצה כקובץ .ics לפי טוקן.
// נקראת דרך /cal/<token>.ics (ראו vercel.json). משתמשת רק במפתח anon, ללא service_role.
import { buildIcs, type FeedPayload } from './_ics';

declare const process: { env: Record<string, string | undefined> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!UUID_RE.test(token)) return new Response('לא נמצא', { status: 404 });

  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return new Response('השרת לא מוגדר', { status: 500 });

  let payload: FeedPayload | null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_lecturer_calendar`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token: token }),
    });
    if (!res.ok) return new Response('שגיאה בטעינת היומן', { status: 502 });
    payload = (await res.json()) as FeedPayload | null;
  } catch {
    return new Response('שגיאה בטעינת היומן', { status: 502 });
  }

  // טוקן לא קיים (או מרצה לא פעיל): אותה תשובה כמו לטוקן שגוי
  if (!payload) return new Response('לא נמצא', { status: 404 });

  return new Response(buildIcs(payload), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="lectures.ics"',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
    },
  });
}
