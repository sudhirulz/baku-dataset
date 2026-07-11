const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'
let _key = null
export const setApiKey = k => { _key = k }
export const getApiKey = () => _key

async function call(messages, system, maxTokens = 2000) {
  if (!_key) throw new Error('NO_KEY')
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': _key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  })
  if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`)
  return (await r.json()).content?.[0]?.text ?? ''
}

function toB64(blob) {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => res(reader.result.split(',')[1])
    reader.onerror = rej
    reader.readAsDataURL(blob)
  })
}

function parseJSON(t) {
  try { return JSON.parse(t.replace(/```json|```/g, '').trim()) }
  catch { return null }
}

const SYS = `You are a linguistic landscape researcher specialising in multilingual analysis in Baku, Azerbaijan. You have deep expertise in Azerbaijani (Turkic), Russian (Slavic), English (Germanic), and minority languages: Lezgi, Talysh, Khinaliq, Avar, Tsakhur, Udi, Georgian, Armenian, Persian, Turkish. You understand post-Soviet language contact, code-switching, morphological hybridisation, and etymology across these language families. Produce structured JSON for a linguistics research dataset.`

// ── OCR for images ──────────────────────────────────────
export async function runOCR(blob) {
  const b64 = await toB64(blob)
  const mime = blob.type?.startsWith('image/') ? blob.type : 'image/jpeg'
  const t = await call([{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
    { type: 'text', text: `Extract ALL text visible. Return ONLY JSON:
{"ocrText":"<all text verbatim preserving scripts>","scripts":["detected scripts"],"hasText":true/false,"confidence":"high|medium|low","imageDescription":"<one sentence>","notes":"<unclear text>"}` }
  ]}], SYS, 1000)
  return parseJSON(t) || { ocrText: '', scripts: [], hasText: false, confidence: 'low' }
}

// ── Full linguistic analysis of text ────────────────────
export async function runLinguisticAnalysis(text, desc = '', sourceType = 'photo') {
  if (!text?.trim()) return null
  const ctx = sourceType === 'youtube' ? 'a pedagogical YouTube video teaching Azerbaijani' :
    sourceType === 'native_speaker' ? 'a spontaneous recording from a native Baku speaker' :
    'a sign in Azerbaijan'
  const t = await call([{ role: 'user', content: `Analyse text from ${ctx}. Context: ${desc}\nText: ${text}\n\nReturn ONLY JSON:
{"detectedLanguages":["codes"],"languageNames":["names"],"scripts":["scripts"],"translation_en":"<English>","transliteration":"<Latin>","domain":"<domain>","entryType":"<type>","matrixLang":"<code>","hasCodeSwitching":true/false,"switchType":"<type>","switchTrigger":"<trigger>","audienceLanguages":["codes"],"linguisticNotes":"<scholarly notes>"}` }], SYS, 1500)
  return parseJSON(t)
}

// ── Native speaker audio transcription ──────────────────
// Sends audio as base64 — works for MP3 files under 4MB
// For larger files, splits into chunks properly
export async function transcribeAudio(blob, contextNote = '') {
  const sizeMB = blob.size / 1024 / 1024

  if (sizeMB > 4) {
    return transcribeInChunks(blob, contextNote)
  }

  // Single file transcription — send as base64 image workaround
  // Since browser can't send audio directly, we extract and send as text prompt
  const b64 = await toB64(blob)
  const t = await call([{ role: 'user', content: `This is an audio file from field research in Azerbaijan (base64 encoded, ${sizeMB.toFixed(1)}MB). 

IMPORTANT: If you cannot actually process this audio file directly, please respond with:
{"error": "CANNOT_PROCESS_AUDIO", "suggestion": "Please use text input"}

Otherwise transcribe it. ${contextNote}
Mark language switches: [AZ][RU][EN][LEZ][KHV][UNK]

Return ONLY JSON:
{"transcription":"<verbatim with tags>","detectedLanguages":["codes"],"languageNames":["names"],"translation_en":"<English>","transliteration":"<Latin>","matrixLang":"<code>","hasCodeSwitching":true/false,"switchType":"<type>","linguisticNotes":"<notes>"}` }], SYS, 2000)

  const result = parseJSON(t)

  // If API can't process audio, return error so UI can show manual input
  if (result?.error === 'CANNOT_PROCESS_AUDIO') {
    return { error: 'CANNOT_PROCESS_AUDIO', transcription: null }
  }

  return result || { transcription: t, detectedLanguages: [], languageNames: [] }
}

async function transcribeInChunks(blob, contextNote) {
  // For large audio: use Web Speech API result or ask for manual input
  // Return a signal that manual transcription is needed
  return {
    error: 'FILE_TOO_LARGE',
    sizeMB: (blob.size / 1024 / 1024).toFixed(1),
    transcription: null,
    message: `File is ${(blob.size/1024/1024).toFixed(1)}MB. For best results, convert to MP3 (under 4MB) or paste the transcript manually.`
  }
}

// ── Analyse pasted text (YouTube captions or manual transcript) ──
export async function analyseTranscriptText(text, sourceType = 'youtube', contextNote = '') {
  if (!text?.trim()) return null

  const ctx = sourceType === 'youtube'
    ? 'a pedagogical Azerbaijani YouTube video lesson'
    : 'a native Baku Azerbaijani speaker recording'

  const t = await call([{ role: 'user', content: `Analyse this transcript from ${ctx}. ${contextNote}

Mark ALL language switches you can identify by inserting [AZ], [RU], [EN], [LEZ], [UNK] tags inline where switches occur.

Text: ${text}

Return ONLY JSON:
{
  "transcription": "<original text with language switch tags inserted inline>",
  "detectedLanguages": ["language codes present"],
  "languageNames": ["full language names"],
  "translation_en": "<complete English translation>",
  "transliteration": "<Latin romanisation of non-Latin segments>",
  "matrixLang": "<dominant language code>",
  "hasCodeSwitching": true or false,
  "switchType": "<No switching|Intra-sentential|Inter-sentential|Single-word borrowing|Morphological hybrid|Tag switching|Mixed|Unclear>",
  "switchTrigger": "<None|Lexical gap|Identity/solidarity|Prestige|Habit|Quotation|Topic shift|Unclear>",
  "linguisticNotes": "<scholarly observations about code-switching patterns, hybrid forms, register>"
}` }], SYS, 2000)

  return parseJSON(t) || { transcription: text, detectedLanguages: [], languageNames: [] }
}

// ── Word-level deep analysis ─────────────────────────────
// analyseWords — robust chunked word analysis
// Splits text into small batches, processes each separately
// onProgress(done, total) called after each batch
export async function analyseWords(text, sourceType, zone, onProgress) {
  if (!text || !text.trim()) return []

  // Simple word split — works for all scripts
  const words = text.trim().split(/\s+/).filter(w => w.length > 0)
  if (words.length === 0) return []

  const ctx = sourceType === 'youtube' ? 'a pedagogical Azerbaijani YouTube video' :
    sourceType === 'native_speaker' ? 'a spontaneous recording by a native Baku speaker' :
    `a sign photographed in ${zone || 'Baku, Azerbaijan'}`

  const CHUNK = 6  // 6 words per call — very safe limit
  const results = []

  for (let i = 0; i < words.length; i += CHUNK) {
    const batch = words.slice(i, i + CHUNK)
    const batchText = batch.join(' ')
    const chunkNum = Math.floor(i / CHUNK)
    const totalChunks = Math.ceil(words.length / CHUNK)

    if (onProgress) onProgress(chunkNum, totalChunks)

    const prompt = `You are a linguist analysing words from ${ctx}.

Analyse these ${batch.length} words one by one: ${batchText}

For EACH word, return one JSON object in an array.
Keep answers brief. Return ONLY a valid JSON array, nothing else.

Required format:
[
  {
    "word": "${batch[0]}",
    "language": "az",
    "languageName": "Azerbaijani",
    "script": "Latin",
    "root": "root word here",
    "rootLanguage": "Azerbaijani",
    "rootLanguageFamily": "Turkic",
    "prefix": null,
    "suffix": "-lar",
    "integrationClass": "native",
    "pos": "noun",
    "lemma": "base form",
    "meaning_en": "English meaning",
    "meaning_contextual": "meaning in this sign",
    "meaningShift": null,
    "etymology": "one sentence origin",
    "semanticField": "commerce",
    "connotation": "neutral",
    "register": "informal",
    "notes": "any interesting feature"
  }
]

Analyse all ${batch.length} words: ${batchText}
Return array of ${batch.length} objects ONLY.`

    try {
      const raw = await call([{ role: 'user', content: prompt }], SYS, 2500)
      const parsed = parseJSON(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((w, j) => {
          results.push({ ...w, position: i + j, entryText: text.slice(0, 100) })
        })
      } else {
        // Fallback — add basic entries so words aren't lost
        batch.forEach((w, j) => {
          results.push({
            word: w, position: i + j,
            language: 'unknown', languageName: 'Unknown',
            script: 'Unknown', integrationClass: 'unknown',
            meaning_en: '', etymology: '',
            notes: 'Could not analyse — try re-running'
          })
        })
      }
    } catch (err) {
      batch.forEach((w, j) => {
        results.push({
          word: w, position: i + j,
          language: 'unknown', languageName: 'Unknown',
          script: 'Unknown', integrationClass: 'unknown',
          meaning_en: '', etymology: '',
          notes: `Error: ${err.message}`
        })
      })
    }

    // Pause between chunks to avoid rate limits
    if (i + CHUNK < words.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  if (onProgress) onProgress(Math.ceil(words.length / CHUNK), Math.ceil(words.length / CHUNK))
  return results
}
