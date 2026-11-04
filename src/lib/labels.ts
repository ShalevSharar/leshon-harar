export const STAGE_LABELS: Record<string, string> = {
  not_contacted: 'לא פנינו',
  contacted: 'פנינו',
  interested: 'מעוניין',
  lecture_scheduled: 'נקבעה הרצאה',
  lecture_done: 'הרצאה התקיימה',
  feedback_received: 'משוב התקבל',
  not_relevant: 'לא רלוונטי',
  refused: 'סירב',
};

export const STAGES = Object.keys(STAGE_LABELS);

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין',
  matched: 'שויך לבית ספר',
  review: 'לבדיקה',
};
