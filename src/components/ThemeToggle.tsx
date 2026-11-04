import { useState } from 'react';
import { getTheme, setTheme, Theme } from '../lib/theme';

// כפתור בחירה בין בהיר לכהה
export default function ThemeToggle() {
  const [theme, setLocal] = useState<Theme>(getTheme());

  function choose(t: Theme) {
    setTheme(t);
    setLocal(t);
  }

  return (
    <div className="theme-toggle" role="group" aria-label="ערכת נושא">
      <button type="button" className={theme === 'light' ? 'chip on' : 'chip'} onClick={() => choose('light')}>בהיר</button>
      <button type="button" className={theme === 'dark' ? 'chip on' : 'chip'} onClick={() => choose('dark')}>כהה</button>
    </div>
  );
}
