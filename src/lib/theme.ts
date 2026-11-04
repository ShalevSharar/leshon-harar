// ערכת נושא: בהיר (ברירת מחדל) או כהה. הבחירה נשמרת במכשיר.
export type Theme = 'light' | 'dark';

const KEY = 'theme';

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // אם אין גישה לאחסון, הבחירה תחול רק עד רענון
  }
  applyTheme(theme);
}

// מחיל את הנושא השמור לפני הציור הראשון, כדי למנוע הבהוב
export function initTheme() {
  applyTheme(getTheme());
}
