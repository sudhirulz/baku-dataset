export const DEFAULT_COLLECTOR = 'Sudarshan Manikantan'

export const ZONES = [
  'Baku city centre', 'Baku Old City (İçərişəhər)', 'Baku suburbs',
  'Absheron Peninsula', 'Sumgayit', 'Shamakhi', 'Gabala',
  'Guba', 'Khinaliq village', 'Sheki', 'Lankaran',
  'En route (specify in notes)', 'Other',
]

export const DOMAINS = [
  'Commercial/shop', 'Food/menu', 'Transport',
  'Government/official', 'Religious', 'Education',
  'Healthcare', 'Street/public', 'Market/bazaar',
  'Technology/digital', 'Tourism', 'Domestic/home', 'Other',
]

export const ENTRY_TYPES = [
  'Shop sign', 'Menu', 'Grocery label', 'Street sign',
  'Announcement', 'Advertisement', 'Graffiti', 'Packaging',
  'Pedagogical speech', 'Spontaneous speech', 'Interview', 'Other',
]

export const SWITCH_TYPES = [
  'No switching', 'Intra-sentential', 'Inter-sentential',
  'Single-word borrowing', 'Morphological hybrid',
  'Tag switching', 'Mixed', 'Unclear',
]

export const SWITCH_TRIGGERS = [
  'None', 'Lexical gap', 'Identity/solidarity',
  'Prestige', 'Habit', 'Quotation', 'Topic shift', 'Unclear',
]

export const INTEGRATION_CLASSES = [
  'native', 'established_loanword', 'recent_borrowing',
  'morphological_hybrid', 'code_switch', 'calque', 'proper_noun', 'unknown',
]

export const LANGUAGES = [
  { code: 'az', name: 'Azerbaijani', family: 'Turkic' },
  { code: 'ru', name: 'Russian', family: 'Slavic' },
  { code: 'en', name: 'English', family: 'Germanic' },
  { code: 'lez', name: 'Lezgi', family: 'Northeast Caucasian' },
  { code: 'tly', name: 'Talysh', family: 'Iranian' },
  { code: 'khv', name: 'Khinaliq', family: 'Northeast Caucasian' },
  { code: 'ava', name: 'Avar', family: 'Northeast Caucasian' },
  { code: 'tkr', name: 'Tsakhur', family: 'Northeast Caucasian' },
  { code: 'udi', name: 'Udi', family: 'Northeast Caucasian' },
  { code: 'ka', name: 'Georgian', family: 'Kartvelian' },
  { code: 'hy', name: 'Armenian', family: 'Indo-European' },
  { code: 'fa', name: 'Persian', family: 'Iranian' },
  { code: 'tr', name: 'Turkish', family: 'Turkic' },
  { code: 'ar', name: 'Arabic', family: 'Semitic' },
  { code: 'other', name: 'Other/Unknown', family: '' },
]

export const SCRIPTS = [
  'Latin', 'Cyrillic', 'Arabic', 'Armenian',
  'Georgian (Mkhedruli)', 'Devanagari', 'Hebrew', 'Mixed', 'Unknown',
]

export const SOURCE_TYPES = {
  photo: { label: 'My photos', icon: '📷', color: 'var(--green)', bg: 'var(--green-light)', border: 'var(--green-border)' },
  native_speaker: { label: 'Native speaker', icon: '🎙', color: 'var(--purple)', bg: 'var(--purple-light)', border: 'var(--purple-border)' },
  youtube: { label: 'YouTube', icon: '🎬', color: 'var(--red)', bg: 'var(--red-light)', border: 'var(--red-border)' },
}
