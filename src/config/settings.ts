// ערכים שעדיין פתוחים (סוגריים מרובעים בפרומפט). לעדכן כאן בלבד, בלי לגעת בקוד.
// PLACEHOLDER: מסומן כ־placeholder עד שדוד יאשר.

export const VOLUNTEER_AREAS = [
  // PLACEHOLDER: [סושיאל / עריכת וידאו / עיצוב / טכני / הפצה / עזרה באירועים / אחר]
  'סושיאל',
  'עריכת וידאו',
  'עיצוב',
  'טכני',
  'הפצה',
  'עזרה באירועים',
  'אחר',
] as const;

export const VOLUNTEER_SOURCES = [
  { value: 'stand', label: 'עמדה ברייכמן' },
  { value: 'instagram', label: 'אינסטגרם' },
  { value: 'facebook', label: 'פייסבוק' },
  { value: 'other', label: 'אחר' },
] as const;

export const VOLUNTEER_CONSENT_TEXT =
  // PLACEHOLDER: נוסח ההסכמה לפי המשימה
  "אני מסכים/ה שפרטיי יועברו ל'לשון הרע לא מדבר אליי' לצורך המשך קשר";

export const SURVEY_STUDENT_QUESTIONS = [
  // PLACEHOLDER: [לעדכן אחרי השיחה עם דוד]
  { id: 'think_about_speech', type: 'scale', text: 'עד כמה ההרצאה גרמה לך לחשוב על איך מדברים על אחרים?' },
  { id: 'will_behave_differently', type: 'scale', text: 'האם תתנהג/י אחרת בעקבותיה?' },
  { id: 'remember', type: 'open', text: 'מה נשאר לך מההרצאה?' },
] as const;

export const SURVEY_TEACHER_QUESTIONS = [
  // PLACEHOLDER: [לעדכן אחרי השיחה עם דוד]
  { id: 'relevance', type: 'scale', text: 'עד כמה ההרצאה הייתה רלוונטית לכיתה?' },
  { id: 'saw_change', type: 'open', text: 'האם ראית שינוי?' },
  { id: 'recommend', type: 'scale', text: 'האם תמליץ/י לבית ספר אחר?' },
] as const;

export const LANDING_TEXT = {
  // PLACEHOLDER: [טקסט על ההרצאה ועל דוד] — הטקסט הסופי יגיע מהצוות
  heroTitle: 'הרצאה בבית הספר — בחינם',
  heroBody: '[טקסט על ההרצאה ועל דוד — ממתין לתוכן סופי]',
} as const;
