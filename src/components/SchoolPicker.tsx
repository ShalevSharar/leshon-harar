import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type PickedSchool = { id: string; name: string; city: string };

// בחירת בית ספר בחיפוש חופשי (שם, עיר או סמל מוסד). לא רשימה נגללת, כי יש אלפי בתי ספר.
export default function SchoolPicker({
  value,
  onChange,
}: {
  value: PickedSchool | null;
  onChange: (s: PickedSchool | null) => void;
}) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<PickedSchool[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = term.trim();
    if (!supabase || t.length < 2 || value) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setBusy(true);
      const esc = t.replace(/[%,()]/g, ' ');
      const { data } = await supabase!
        .from('schools')
        .select('id,name,city')
        .or(`name.ilike.%${esc}%,city.ilike.%${esc}%,symbol_code.eq.${esc}`)
        .order('name')
        .limit(10);
      setResults((data ?? []) as PickedSchool[]);
      setBusy(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [term, value]);

  if (value) {
    return (
      <div className="toolbar">
        <span>{value.name} ({value.city})</span>
        <button type="button" className="secondary" onClick={() => { onChange(null); setTerm(''); }}>החלפה</button>
      </div>
    );
  }

  return (
    <div className="picker">
      <input
        type="search"
        placeholder="הקלידו שם בית ספר, עיר או סמל מוסד (לפחות 2 תווים)"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        aria-label="חיפוש בית ספר"
        style={{ width: 360 }}
      />
      {busy && <p className="muted">מחפש...</p>}
      {results.length > 0 && (
        <ul className="picker-list">
          {results.map((s) => (
            <li key={s.id}>
              <button type="button" className="secondary" onClick={() => onChange(s)}>
                {s.name} ({s.city})
              </button>
            </li>
          ))}
        </ul>
      )}
      {!busy && term.trim().length >= 2 && results.length === 0 && <p className="muted">לא נמצאו בתי ספר.</p>}
    </div>
  );
}
