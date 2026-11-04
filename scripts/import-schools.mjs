// ייבוא בתי ספר לטבלת schools מקובץ JSON מוכן (נכתב מקובץ משרד החינוך, תשפ"ז).
// שימוש:
//   node scripts/import-schools.mjs <path-to-json>            ריצה יבשה (בלי כתיבה)
//   node scripts/import-schools.mjs <path-to-json> --write    כתיבה למסד
// דורש משתני סביבה מקומיים בלבד (לא בקוד ולא בגיט):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// הכתיבה היא upsert לפי symbol_code, ולא נוגעת בעמודת stage של בתי ספר קיימים.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const WRITE = process.argv.includes('--write');
if (!file) {
  console.error('חסר נתיב לקובץ ה-JSON');
  process.exit(1);
}

const rows = JSON.parse(readFileSync(file, 'utf-8'));
// שדות שהטבלה מקבלת בלבד (principal לא נשמר כאן)
const schools = rows.map(({ principal, ...s }) => s);

const symbols = new Set(schools.map((s) => s.symbol_code));
if (symbols.size !== schools.length) {
  console.error('יש כפילויות בסמל מוסד בקובץ. מפסיקים.');
  process.exit(1);
}

console.log(`בתי ספר לייבוא: ${schools.length} (ללא כפילויות)`);
console.log('דוגמה:', JSON.stringify(schools[0], null, 2));

if (!WRITE) {
  console.log('\nריצה יבשה: לא נכתב כלום. להרצה אמיתית: הוסף --write');
  process.exit(0);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('חסרים SUPABASE_URL או SUPABASE_SERVICE_ROLE_KEY בסביבה');
  process.exit(1);
}

const BATCH = 500;
let written = 0;
for (let i = 0; i < schools.length; i += BATCH) {
  const batch = schools.slice(i, i + BATCH);
  const res = await fetch(`${url}/rest/v1/schools?on_conflict=symbol_code`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(batch),
  });
  if (!res.ok) {
    console.error(`שגיאה בקבוצה ${i}: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  written += batch.length;
  console.log(`נכתבו ${written}/${schools.length}`);
}
console.log('הייבוא הושלם.');
