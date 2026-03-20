import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

export type Lang = 'en' | 'hi';

const LANG_KEY = 'worker_lang';

let _lang: Lang = 'en';
const _listeners = new Set<(lang: Lang) => void>();

export async function initLang() {
  const stored = await AsyncStorage.getItem(LANG_KEY);
  if (stored === 'hi' || stored === 'en') _lang = stored;
}

export function getLang(): Lang {
  return _lang;
}

export async function setLang(lang: Lang) {
  _lang = lang;
  await AsyncStorage.setItem(LANG_KEY, lang);
  _listeners.forEach(fn => fn(lang));
}

/** React hook that re-renders when language changes */
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLocal] = useState<Lang>(_lang);

  useEffect(() => {
    const handler = (l: Lang) => setLocal(l);
    _listeners.add(handler);
    // Sync in case it changed
    setLocal(_lang);
    return () => { _listeners.delete(handler); };
  }, []);

  return [lang, (l: Lang) => { setLang(l); }];
}

// ─── Hindi translations ───────────────────────────────────────

export const hi = {
  // Login
  workerPortal: 'वर्कर पोर्टल',
  signIn: 'साइन इन करें',
  signingIn: 'साइन इन हो रहा है…',
  email: 'ईमेल',
  password: 'पासवर्ड',
  errorTitle: 'त्रुटि',
  enterCredentials: 'कृपया ईमेल और पासवर्ड दर्ज करें।',
  accessDenied: 'पहुँच अस्वीकृत',
  workerOnly: 'यह ऐप केवल वर्कर के लिए है। कृपया होस्ट डैशबोर्ड का उपयोग करें।',
  loginFailed: 'लॉगिन विफल',
  invalidCredentials: 'ईमेल या पासवर्ड गलत है।',

  // Jobs list
  jobs: 'काम',
  myJobs: 'मेरे काम',
  available: 'उपलब्ध',
  noActiveJobs: 'कोई सक्रिय काम नहीं',
  noAvailableJobs: 'अभी कोई उपलब्ध काम नहीं',
  pullToRefresh: 'रिफ्रेश करने के लिए खींचें',
  claimJob: 'काम लें',
  hey: 'नमस्ते',

  // Job detail
  back: '← वापस',
  details: 'विवरण',
  scheduled: 'निर्धारित समय',
  guest: 'अतिथि',
  checkIn: 'चेक-इन',
  checkOut: 'चेक-आउट',
  notes: 'नोट्स',
  checklist: 'चेकलिस्ट',
  propertyBriefing: 'प्रॉपर्टी ब्रीफिंग',
  address: 'पता',
  wifiNetwork: 'वाई-फाई नेटवर्क',
  wifiPassword: 'वाई-फाई पासवर्ड',
  doorCode: 'दरवाज़ा कोड',
  acceptJob: 'काम स्वीकार करें',
  startJob: 'काम शुरू करें',
  markComplete: 'पूरा हुआ ✅',
  reportIssue: '⚠️ समस्या रिपोर्ट करें',
  incompleteChecklist: 'अधूरी चेकलिस्ट',
  incompleteItems: (n: number) => `${n} आइटम अधूरे हैं। फिर भी पूरा करें?`,
  cancel: 'रद्द करें',
  complete: 'पूरा करें',

  // Report issue
  reportIssueTitle: 'समस्या रिपोर्ट',
  severity: 'गंभीरता',
  description: 'विवरण',
  descriptionPlaceholder: 'समस्या का विवरण दें…',
  low: 'कम',
  lowDesc: 'मामूली / जरूरी नहीं',
  medium: 'मध्यम',
  mediumDesc: 'जल्द ध्यान चाहिए',
  high: 'उच्च',
  highDesc: 'तुरंत / सुरक्षा चिंता',
  photo: 'फोटो',
  takePhoto: '📷 फोटो लें',
  video: 'वीडियो',
  record: '🎥 रिकॉर्ड',
  library: '📁 लाइब्रेरी',
  videoRecorded: 'वीडियो रिकॉर्ड हुआ',
  uploadingMedia: 'मीडिया अपलोड हो रहा…',
  submitIssue: '⚠️ समस्या जमा करें',
  required: 'आवश्यक',
  describeIssue: 'कृपया समस्या का विवरण दें।',
  issueReported: 'समस्या दर्ज हो गई',
  hostNotified: 'होस्ट को सूचित किया गया।',
  ok: 'ठीक',
  permissionRequired: 'अनुमति आवश्यक',
  allowMediaAccess: 'कृपया सेटिंग्स में मीडिया लाइब्रेरी की अनुमति दें।',
  allowCameraAccess: 'कृपया सेटिंग्स में कैमरा की अनुमति दें।',

  // Complete job
  completeJob: 'काम पूरा करें',
  completionHint: 'सबमिट करने से पहले पूरे हुए काम की फोटो या वीडियो जोड़ें।',
  markCompleteBtn: '✅ पूरा हुआ',
  jobComplete: '✅ काम पूरा!',
  greatWork: 'बहुत बढ़िया! काम पूरा हो गया है।',
  backToJobs: 'काम पर वापस',

  // Profile
  profile: 'प्रोफ़ाइल',
  jobsDone: 'काम पूरे',
  rating: 'रेटिंग ⭐',
  availability: 'उपलब्धता',
  availableForJobs: '🟢 काम के लिए उपलब्ध',
  notAvailable: '🔴 अनुपलब्ध',
  availableDesc: 'आप नए काम प्राप्त कर सकते हैं',
  notAvailableDesc: 'आपको नए काम नहीं मिलेंगे',
  skills: 'कौशल',
  signOut: 'साइन आउट',
  signOutConfirm: 'साइन आउट करें?',
  history: 'इतिहास',
  noHistory: 'कोई पिछले काम नहीं',

  // Properties tab
  myProperties: 'मेरी प्रॉपर्टी',
  noPropertiesAssigned: 'कोई प्रॉपर्टी नहीं मिली',
  startNewJob: 'नया काम शुरू करें',
  jobTypeLabel: 'काम का प्रकार',
  optional: 'वैकल्पिक',
  notesPlaceholder: 'कोई नोट्स… (वैकल्पिक)',
  startJobNow: 'अभी काम शुरू करें',
  starting: 'शुरू हो रहा है…',

  // Tab bar
  tabJobs: 'काम',
  tabProperties: 'प्रॉपर्टी',
  tabProfile: 'प्रोफ़ाइल',

  // Language
  language: 'भाषा',
  hindi: 'हिन्दी',
  english: 'English',
};

// ─── English translations ─────────────────────────────────────

export const en: typeof hi = {
  workerPortal: 'Worker Portal',
  signIn: 'Sign In',
  signingIn: 'Signing in…',
  email: 'Email',
  password: 'Password',
  errorTitle: 'Error',
  enterCredentials: 'Please enter your email and password.',
  accessDenied: 'Access Denied',
  workerOnly: 'This app is for workers only. Please use the host dashboard.',
  loginFailed: 'Login Failed',
  invalidCredentials: 'Invalid email or password.',

  jobs: 'Jobs',
  myJobs: 'My Jobs',
  available: 'Available',
  noActiveJobs: 'No active jobs',
  noAvailableJobs: 'No available jobs right now',
  pullToRefresh: 'Pull to refresh',
  claimJob: 'Claim Job',
  hey: 'Hey',

  back: '← Back',
  details: 'Details',
  scheduled: 'Scheduled',
  guest: 'Guest',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  notes: 'Notes',
  checklist: 'Checklist',
  propertyBriefing: 'Property Briefing',
  address: 'Address',
  wifiNetwork: 'Wi-Fi Network',
  wifiPassword: 'Wi-Fi Password',
  doorCode: 'Door Code',
  acceptJob: 'Accept Job',
  startJob: 'Start Job',
  markComplete: 'Mark Complete ✅',
  reportIssue: '⚠️ Report an Issue',
  incompleteChecklist: 'Incomplete Checklist',
  incompleteItems: (n: number) => `${n} item(s) not checked off. Complete anyway?`,
  cancel: 'Cancel',
  complete: 'Complete',

  reportIssueTitle: 'Report Issue',
  severity: 'Severity',
  description: 'Description',
  descriptionPlaceholder: 'Describe the issue in detail...',
  low: 'Low',
  lowDesc: 'Minor, non-urgent',
  medium: 'Medium',
  mediumDesc: 'Needs attention soon',
  high: 'High',
  highDesc: 'Urgent / safety issue',
  photo: 'Photo',
  takePhoto: '📷 Take Photo',
  video: 'Video',
  record: '🎥 Record',
  library: '📁 Library',
  videoRecorded: 'Video recorded',
  uploadingMedia: 'Uploading media…',
  submitIssue: '⚠️  Submit Issue Report',
  required: 'Required',
  describeIssue: 'Please describe the issue.',
  issueReported: 'Issue Reported',
  hostNotified: 'The host has been notified.',
  ok: 'OK',
  permissionRequired: 'Permission required',
  allowMediaAccess: 'Please allow access to media library in Settings.',
  allowCameraAccess: 'Please allow camera access in Settings.',

  completeJob: 'Complete Job',
  completionHint: 'Add photos or videos of the completed work before submitting.',
  markCompleteBtn: '✅  Mark Complete',
  jobComplete: '✅ Job Complete!',
  greatWork: 'Great work! The job has been marked as completed.',
  backToJobs: 'Back to Jobs',

  profile: 'Profile',
  jobsDone: 'Jobs Done',
  rating: 'Rating ⭐',
  availability: 'Availability',
  availableForJobs: '🟢 Available for jobs',
  notAvailable: '🔴 Not available',
  availableDesc: 'You can receive new job assignments',
  notAvailableDesc: "You won't receive new assignments",
  skills: 'Skills',
  signOut: 'Sign Out',
  signOutConfirm: 'Sign out?',
  history: 'History',
  noHistory: 'No past jobs yet',

  // Properties tab
  myProperties: 'My Properties',
  noPropertiesAssigned: 'No properties assigned yet',
  startNewJob: 'Start New Job',
  jobTypeLabel: 'Job Type',
  optional: 'optional',
  notesPlaceholder: 'Any notes… (optional)',
  startJobNow: 'Start Job Now',
  starting: 'Starting…',

  tabJobs: 'Jobs',
  tabProperties: 'Properties',
  tabProfile: 'Profile',

  language: 'Language',
  hindi: 'हिन्दी',
  english: 'English',
};

export function t(lang: Lang) {
  return lang === 'hi' ? hi : en;
}
