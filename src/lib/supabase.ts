import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// אם חסרים משתני סביבה, האפליקציה עדיין עולה; השמירה תיכשל עם הודעה ברורה.
export const supabase = url && key ? createClient(url, key) : null;

// הודעה שמוצגת למשתמש כשאין חיבור לשרת, במקום שמירה שנכשלת בשקט
export const NO_DB_MESSAGE =
  'אין חיבור לשרת הנתונים. יש להגדיר VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY בקובץ .env.local ולהפעיל את השרת מחדש.';
