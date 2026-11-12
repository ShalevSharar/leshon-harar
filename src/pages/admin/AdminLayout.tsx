import { FormEvent, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase, NO_DB_MESSAGE } from '../../lib/supabase';
import { toLocalISO } from '../../lib/calendar';
import ThemeToggle from '../../components/ThemeToggle';
import { NewLecture, Named } from './Calendar';

// קבוצות התפריט לפי הסדר המבוקש. כל פריט מפנה למסך קיים.
const GROUPS: { title: string; items: { to: string; label: string; icon: string }[] }[] = [
  {
    title: 'עבודה יומית',
    items: [
      { to: '/admin/dashboard', label: 'דשבורד', icon: '◉' },
      { to: '/admin/schools', label: 'בתי ספר', icon: '▦' },
      { to: '/admin/requests', label: 'בקשות', icon: '✉' },
    ],
  },
  {
    title: 'הרצאות',
    items: [
      { to: '/admin/calendar', label: 'לוח שנה', icon: '▤' },
      { to: '/admin/lectures', label: 'הרצאות', icon: '✎' },
      { to: '/admin/lecture-settings', label: 'מרצים', icon: '☰' },
    ],
  },
  {
    title: 'אנשים ונתונים',
    items: [
      { to: '/admin/volunteers', label: 'מתנדבים', icon: '♥' },
      { to: '/admin/surveys', label: 'דוחות ונתונים', icon: '★' },
    ],
  },
  {
    title: 'הגדרות',
    items: [{ to: '/admin/users', label: 'משתמשים', icon: '☺' }],
  },
];
const MOBILE_ITEMS = ['/admin/dashboard', '/admin/schools', '/admin/calendar', '/admin/lectures', '/admin/volunteers'];

const COLLAPSED_KEY = 'admin-sidebar-collapsed';

// מעטפת הניהול: סרגל צד מתקפל במחשב, סרגל תחתון בטלפון, וסרגל עליון עם חיפוש, תזכורות והרצאה חדשה.
export default function AdminLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const [query, setQuery] = useState('');
  const [due, setDue] = useState(0);
  const [email, setEmail] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const [lecturers, setLecturers] = useState<Named[]>([]);
  const [types, setTypes] = useState<Named[]>([]);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* אין אחסון: נמשיך בלי לזכור */ }
  }, [collapsed]);

  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    db.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ''));
    db.from('schools')
      .select('id', { count: 'exact', head: true })
      .lte('next_followup_at', toLocalISO(new Date()))
      .then(({ count }) => setDue(count ?? 0));
  }, []);

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const term = query.trim();
    navigate(term ? `/admin/schools?q=${encodeURIComponent(term)}` : '/admin/schools');
    setQuery('');
  }

  // פתיחת טופס הרצאה מכל מקום: טוענים מרצים וסוגים, ואז פותחים את הטופס המשותף
  async function openQuickLecture() {
    if (!supabase) return alert(NO_DB_MESSAGE);
    const [lec, tp] = await Promise.all([
      supabase.from('lecturers').select('id,name,color').eq('active', true).order('name'),
      supabase.from('lecture_types').select('id,name,color,default_minutes').eq('active', true).order('name'),
    ]);
    setLecturers((lec.data ?? []) as Named[]);
    setTypes((tp.data ?? []) as Named[]);
    setQuickOpen(true);
  }

  async function signOut() {
    await supabase?.auth.signOut();
  }

  return (
    <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar" aria-label="ניווט">
        <div className="brand-row">
          {!collapsed && <div className="brand">לשון הרע לא מדבר אליי</div>}
          <button
            type="button"
            className="ghost collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'הרחבת התפריט' : 'כיווץ התפריט'}
            title={collapsed ? 'הרחבת התפריט' : 'כיווץ התפריט'}
          >
            {collapsed ? '«' : '»'}
          </button>
        </div>
        <nav className="sidenav">
          {GROUPS.map((g) => (
            <div key={g.title} className="navgroup">
              {!collapsed && <div className="navgroup-title">{g.title}</div>}
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} className="navlink" title={i.label}>
                  <span className="ico" aria-hidden="true">{i.icon}</span>
                  {!collapsed && i.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="logout">
          <ThemeToggle />
          {!collapsed && <button type="button" className="secondary" onClick={signOut}>יציאה</button>}
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <form onSubmit={onSearch} className="topsearch" role="search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש בית ספר, עיר או טלפון"
              aria-label="חיפוש"
            />
          </form>
          <button type="button" className="primary-create" onClick={openQuickLecture}>+ הרצאה חדשה</button>
          <Link to="/admin/dashboard" className="bell" aria-label={`לטיפול היום: ${due}`} title="מעקבים לטיפול היום">
            🔔 {due > 0 && <span className="badge-count">{due}</span>}
          </Link>
          <span className="userchip" title={email}>{email}</span>
        </header>

        <main className="main">
          <Outlet />
        </main>
      </div>

      <nav className="bottomnav" aria-label="ניווט מהיר">
        {GROUPS.flatMap((g) => g.items).filter((i) => MOBILE_ITEMS.includes(i.to)).map((i) => (
          <NavLink key={i.to} to={i.to} className="navlink">
            <span className="ico" aria-hidden="true">{i.icon}</span>{i.label}
          </NavLink>
        ))}
      </nav>

      {quickOpen && (
        <NewLecture
          date={toLocalISO(new Date())}
          lecturers={lecturers}
          types={types}
          onClose={() => setQuickOpen(false)}
          onSaved={() => setQuickOpen(false)}
        />
      )}
    </div>
  );
}
