import Dexie from 'dexie'

export const db = new Dexie('BakuDatasetDB')

db.version(2).stores({
  entries: '++id, sourceType, status, createdAt, zone, collectedBy',
  words: '++id, entryId, word, language, integrationClass',
  editHistory: '++id, entryId, field, changedAt',
  settings: 'key',
})

export const getSetting = async k => { const r = await db.settings.get(k); return r?.value ?? null }
export const setSetting = async (k, v) => db.settings.put({ key: k, value: v })

export async function addEntry(data) {
  return db.entries.add({
    ...data,
    status: data.status || 'uploaded',
    createdAt: new Date().toISOString(),
    comments: {},
    customFields: {},
  })
}

export async function updateEntry(id, updates, source = 'ai') {
  const existing = await db.entries.get(id)
  if (!existing) return
  const sourceUpdates = {}
  const historyEntries = []
  for (const [key, val] of Object.entries(updates)) {
    if (key.endsWith('_source') || key === 'status' || key === 'comments' || key === 'customFields') continue
    sourceUpdates[`${key}_source`] = source
    if (existing[key] !== undefined && JSON.stringify(existing[key]) !== JSON.stringify(val)) {
      historyEntries.push({ entryId: id, field: key, oldValue: existing[key], newValue: val, source, changedAt: new Date().toISOString() })
    }
  }
  if (historyEntries.length > 0) await db.editHistory.bulkAdd(historyEntries)
  await db.entries.update(id, { ...updates, ...sourceUpdates })
}

export async function updateFieldComment(id, field, comment) {
  const existing = await db.entries.get(id)
  const comments = { ...(existing?.comments || {}), [field]: comment }
  await db.entries.update(id, { comments })
}

export async function addCustomField(id, key, value, comment = '') {
  const existing = await db.entries.get(id)
  const customFields = { ...(existing?.customFields || {}), [key]: { value, comment, addedAt: new Date().toISOString() } }
  await db.entries.update(id, { customFields })
}

export async function removeCustomField(id, key) {
  const existing = await db.entries.get(id)
  const customFields = { ...(existing?.customFields || {}) }
  delete customFields[key]
  await db.entries.update(id, { customFields })
}

export const getEntry = id => db.entries.get(id)
export const getAllEntries = () => db.entries.orderBy('createdAt').toArray()
export const deleteEntry = id => db.entries.delete(id)
export const clearAll = () => db.entries.clear()
export const getHistory = entryId => db.editHistory.where('entryId').equals(entryId).toArray()

// Word operations
export async function saveWords(entryId, words) {
  await db.words.where('entryId').equals(entryId).delete()
  if (words.length > 0) await db.words.bulkAdd(words.map(w => ({ ...w, entryId, comments: {}, customFields: {} })))
}
export async function updateWord(id, updates) { await db.words.update(id, updates) }
export const getWords = entryId => db.words.where('entryId').equals(entryId).toArray()
export const getAllWords = () => db.words.toArray()

// Exports
export async function exportEntriesJSONL() {
  const entries = await getAllEntries()
  return entries.filter(e => e.status === 'done' || e.status === 'ocr_done').map(e => {
    const { blob, thumbUrl, ...rest } = e
    return JSON.stringify(rest)
  }).join('\n')
}

export async function exportWordsJSONL() {
  const words = await getAllWords()
  return words.map(w => JSON.stringify(w)).join('\n')
}

export async function exportEntriesCSV() {
  const entries = await getAllEntries()
  const cols = ['id','sourceType','collectedBy','filename','status','createdAt','zone',
    'exif_datetime','exif_lat','exif_lon','exif_make','exif_model',
    'geo_country','geo_city','geo_district','geo_street',
    'ocrText','transcription','translation_en','transliteration',
    'detectedLanguages','scripts','domain','entryType','matrixLang',
    'hasCodeSwitching','switchType','switchTrigger','linguisticNotes','notes',
    'yt_videoTitle','yt_videoUrl','yt_publishedDate','yt_speakerName',
    'yt_permissionGrantedBy','yt_permissionDate','yt_licence',
    'ns_speakerName','ns_speakerAge','ns_speakerNeighbourhood',
    'ns_speakerLangs','ns_recordingContext','ns_consentRecorded']
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = entries.map(e => cols.map(c => {
    if (c === 'exif_lat') return esc(e.exif?.lat ?? '')
    if (c === 'exif_lon') return esc(e.exif?.lon ?? '')
    if (c === 'exif_datetime') return esc(e.exif?.datetime ?? '')
    if (c === 'exif_make') return esc(e.exif?.make ?? '')
    if (c === 'exif_model') return esc(e.exif?.model ?? '')
    if (c === 'geo_country') return esc(e.geo?.country ?? '')
    if (c === 'geo_city') return esc(e.geo?.city ?? '')
    if (c === 'geo_district') return esc(e.geo?.district ?? '')
    if (c === 'geo_street') return esc(e.geo?.street ?? '')
    if (c === 'translation_en') return esc(e.translation?.en ?? '')
    const v = e[c]; return Array.isArray(v) ? esc(v.join('|')) : esc(v)
  }).join(','))
  return [cols.join(','), ...rows].join('\n')
}

export async function exportWordsCSV() {
  const words = await getAllWords()
  const cols = ['id','entryId','word','script','language','languageName',
    'root','rootLanguage','rootLanguageFamily','prefix','suffix',
    'integrationClass','pos','lemma','meaning_en','meaning_contextual',
    'meaningShift','etymology','semanticField','connotation','register','notes']
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = words.map(w => cols.map(c => {
    const v = w[c]; return Array.isArray(v) ? esc(v.join('|')) : esc(v)
  }).join(','))
  return [cols.join(','), ...rows].join('\n')
}
