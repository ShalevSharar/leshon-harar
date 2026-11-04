import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { REQUEST_STATUS_LABELS } from '../../lib/labels';

type Request = {
  id: string; created_at: string; school_name: string; city: string;
  contact_name: string; contact_role: string; phone: string; email: string;
  grades: string; preferred_dates: string; notes: string;
  match_status: string; school_id: string | null;
};

// בקשות להרצאה שנשלחו מדף הנחיתה. בקשות "לבדיקה" משויכות ידנית דרך כרטיס בית הספר.
export default function LectureRequests() {
  const [rows, setRows] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('lecture_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError('טעינת הבקשות נכשלה.');
        else setRows((data ?? []) as Request[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="card">
      <h1>בקשות להרצאה</h1>
      {error && <p className="err" role="alert">{error}</p>}
      {loading ? <p>טוען...</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>תאריך</th><th>בית ספר</th><th>עיר</th><th>איש קשר</th><th>טלפון</th><th>מייל</th><th>שכבות</th><th>תאריכים מועדפים</th><th>הערות</th><th>סטטוס</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleDateString('he-IL')}</td>
                  <td>{r.school_id ? <Link to={`/admin/schools/${r.school_id}`}>{r.school_name}</Link> : r.school_name}</td>
                  <td>{r.city}</td>
                  <td>{r.contact_name} {r.contact_role && `(${r.contact_role})`}</td>
                  <td>{r.phone}</td>
                  <td>{r.email}</td>
                  <td>{r.grades}</td>
                  <td>{r.preferred_dates}</td>
                  <td>{r.notes}</td>
                  <td className={r.match_status === 'review' ? 'important' : undefined}>{REQUEST_STATUS_LABELS[r.match_status] ?? r.match_status}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={10}>אין בקשות עדיין.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
