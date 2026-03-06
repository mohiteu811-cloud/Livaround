// Hindi translations for the worker portal
export const hi = {
  // Login
  workerPortal: 'वर्कर पोर्टल',
  signIn: 'साइन इन करें',
  signingIn: 'साइन इन हो रहा है…',
  email: 'ईमेल',
  password: 'पासवर्ड',
  hostLink: 'होस्ट हैं?',
  hostDashboard: 'होस्ट डैशबोर्ड खोलें →',
  workerOnly: 'यह पोर्टल केवल वर्कर के लिए है। होस्ट डैशबोर्ड का उपयोग करें।',

  // Jobs
  jobs: 'काम',
  myJobs: 'मेरे काम',
  available: 'उपलब्ध',
  refresh: '↻ रिफ्रेश',
  refreshing: 'रिफ्रेश हो रहा है…',
  noActiveJobs: 'कोई सक्रिय काम नहीं',
  noAvailableJobs: 'कोई उपलब्ध काम नहीं',
  tapRefresh: 'रिफ्रेश टैप करें',

  // Job detail
  back: '← वापस',
  scheduled: 'निर्धारित समय',
  guest: 'अतिथि',
  checkIn: 'चेक-इन',
  checkOut: 'चेक-आउट',
  notes: 'नोट्स',
  checklist: 'चेकलिस्ट',
  acceptJob: 'काम स्वीकार करें',
  startJob: 'काम शुरू करें',
  markComplete: 'पूरा हुआ ✅',
  reportIssue: '⚠️ समस्या रिपोर्ट करें',
  loading: 'लोड हो रहा है…',
  details: 'विवरण',
  incompleteItems: (n: number) => `${n} आइटम अधूरे हैं। फिर भी पूरा करें?`,

  // Issue report
  reportIssueTitle: 'समस्या रिपोर्ट',
  severity: 'गंभीरता',
  description: 'विवरण',
  descriptionPlaceholder: 'समस्या का विवरण दें… (बोलें या टाइप करें)',
  submitIssue: '⚠️ समस्या जमा करें',
  submitting: 'जमा हो रहा है…',
  descriptionRequired: 'कृपया समस्या का विवरण दें (कम से कम 5 अक्षर)।',
  issueSubmitted: 'समस्या दर्ज हो गई। होस्ट को सूचित किया गया।',
  photo: 'फोटो',
  takePhoto: '📷 फोटो लें',
  voice: 'आवाज़ से बोलें',
  listening: '🎤 सुन रहा है…',
  tapToSpeak: '🎤 बोलें',
  low: 'कम',
  lowDesc: 'मामूली / जरूरी नहीं',
  medium: 'मध्यम',
  mediumDesc: 'जल्द ध्यान चाहिए',
  high: 'उच्च',
  highDesc: 'तुरंत / सुरक्षा चिंता',

  // Profile
  profile: 'प्रोफ़ाइल',
  jobsDone: 'काम पूरे',
  rating: 'रेटिंग ⭐',
  available2: '🟢 उपलब्ध',
  notAvailable: '🔴 अनुपलब्ध',
  availableDesc: 'आप नए काम प्राप्त कर सकते हैं',
  notAvailableDesc: 'आपको नए काम नहीं मिलेंगे',
  skills: 'कौशल',
  signOut: 'साइन आउट',
  signOutConfirm: 'साइन आउट करें?',
  hey: 'नमस्ते',
};

export const en = {
  workerPortal: 'Worker Portal',
  signIn: 'Sign In',
  signingIn: 'Signing in…',
  email: 'Email',
  password: 'Password',
  hostLink: 'Host?',
  hostDashboard: 'Use the host dashboard →',
  workerOnly: 'This portal is for workers only. Please use the host dashboard.',

  jobs: 'Jobs',
  myJobs: 'My Jobs',
  available: 'Available',
  refresh: '↻ Refresh',
  refreshing: 'Refreshing…',
  noActiveJobs: 'No active jobs',
  noAvailableJobs: 'No available jobs',
  tapRefresh: 'Tap Refresh to check for updates',

  back: '← Back',
  scheduled: 'Scheduled',
  guest: 'Guest',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  notes: 'Notes',
  checklist: 'Checklist',
  acceptJob: 'Accept Job',
  startJob: 'Start Job',
  markComplete: 'Mark Complete ✅',
  reportIssue: '⚠️ Report an Issue',
  loading: 'Loading…',
  details: 'Details',
  incompleteItems: (n: number) => `${n} checklist item(s) not done. Complete anyway?`,

  reportIssueTitle: 'Report Issue',
  severity: 'Severity',
  description: 'Description',
  descriptionPlaceholder: 'Describe the issue… (speak or type)',
  submitIssue: '⚠️ Submit Issue Report',
  submitting: 'Submitting…',
  descriptionRequired: 'Please describe the issue (min 5 chars).',
  issueSubmitted: 'Issue reported. The host has been notified.',
  photo: 'Photo',
  takePhoto: '📷 Take Photo',
  voice: 'Voice',
  listening: '🎤 Listening…',
  tapToSpeak: '🎤 Speak',
  low: 'Low',
  lowDesc: 'Minor / non-urgent',
  medium: 'Medium',
  mediumDesc: 'Needs attention soon',
  high: 'High',
  highDesc: 'Urgent / safety concern',

  profile: 'Profile',
  jobsDone: 'Jobs Done',
  rating: 'Rating ⭐',
  available2: '🟢 Available',
  notAvailable: '🔴 Not available',
  availableDesc: 'You can receive new job assignments',
  notAvailableDesc: "You won't receive new assignments",
  skills: 'Skills',
  signOut: 'Sign Out',
  signOutConfirm: 'Sign out?',
  hey: 'Hey',
};

export type Lang = 'en' | 'hi';

export function getLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  return (localStorage.getItem('worker_lang') as Lang) ?? 'en';
}

export function setLang(lang: Lang) {
  localStorage.setItem('worker_lang', lang);
}

export function t(lang: Lang) {
  return lang === 'hi' ? hi : en;
}
