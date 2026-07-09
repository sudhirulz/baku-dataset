const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'
let _key = null
export const setApiKey = k => { _key = k }
export const getApiKey = () => _key

async function call(messages, system, maxTokens = 2000) {
  if (!_key) throw new Error('NO_KEY')
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'x-api-key':_key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
    body: JSON.stringify({ model:MODEL, max_tokens:maxTokens, system, messages }),
  })
  if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`)
  return (await r.json()).content?.[0]?.text ?? ''
}

function toB64(blob) {
  return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result.split(',')[1]); r.onerror=rej; r.readAsDataURL(blob) })
}
function parseJSON(t) { try { return JSON.parse(t.replace(/```json|```/g,'').trim()) } catch { return null } }

const SYS = `You are a linguistic landscape researcher specialising in multilingual analysis in Baku, Azerbaijan. You have deep expertise in Azerbaijani (Turkic), Russian (Slavic), English (Germanic), and minority languages: Lezgi, Talysh, Khinaliq, Avar, Tsakhur, Udi, Georgian, Armenian, Persian, Turkish. You understand post-Soviet language contact, code-switching, morphological hybridisation, and etymology across these language families. Produce structured JSON for a linguistics research dataset.`

export async function runOCR(blob) {
  const b64 = await toB64(blob)
  const mime = blob.type?.startsWith('image/') ? blob.type : 'image/jpeg'
  const t = await call([{ role:'user', content:[
    { type:'image', source:{ type:'base64', media_type:mime, data:b64 } },
    { type:'text', text:`Extract ALL text visible. Return ONLY JSON:
{"ocrText":"<all text verbatim preserving scripts>","scripts":["detected scripts"],"hasText":true/false,"confidence":"high|medium|low","imageDescription":"<one sentence>","notes":"<unclear text>"}` }
  ]}], SYS, 1000)
  return parseJSON(t) || { ocrText:'', scripts:[], hasText:false, confidence:'low' }
}

export async function runLinguisticAnalysis(text, desc='', sourceType='photo') {
  if (!text?.trim()) return null
  const ctx = sourceType==='youtube' ? 'a pedagogical YouTube video teaching Azerbaijani' :
    sourceType==='native_speaker' ? 'a spontaneous recording from a native Baku speaker' : 'a sign in Azerbaijan'
  const t = await call([{ role:'user', content:`Analyse text from ${ctx}. Context: ${desc}\nText: ${text}\n\nReturn ONLY JSON:
{"detectedLanguages":["codes"],"languageNames":["names"],"scripts":["scripts"],"translation_en":"<English>","transliteration":"<Latin>","domain":"<domain>","entryType":"<type>","matrixLang":"<code>","hasCodeSwitching":true/false,"switchType":"<type>","switchTrigger":"<trigger>","audienceLanguages":["codes"],"linguisticNotes":"<scholarly notes>"}` }], SYS, 1500)
  return parseJSON(t)
}

export async function transcribeAudio(blob, contextNote='') {
  if (blob.size/1024 > 4000) return transcribeChunked(blob, contextNote)
  const b64 = await toB64(blob)
  const t = await call([{ role:'user', content:`Transcribe audio from Azerbaijan field research. ${contextNote} Mark switches: [AZ][RU][EN][LEZ][KHV][UNK]. Return ONLY JSON:
{"transcription":"<verbatim with tags>","detectedLanguages":["codes"],"languageNames":["names"],"translation_en":"<English>","transliteration":"<Latin>","matrixLang":"<code>","hasCodeSwitching":true/false,"switchType":"<type>","linguisticNotes":"<notes>"}` }], SYS, 2000)
  return parseJSON(t) || { transcription:t, detectedLanguages:[], languageNames:[] }
}

async function transcribeChunked(blob, contextNote) {
  const CHUNK = 3*1024*1024
  const chunks = []; let off=0
  while (off<blob.size) { chunks.push(blob.slice(off, off+CHUNK, blob.type)); off+=CHUNK }
  const parts = []
  for (let i=0;i<chunks.length;i++) {
    const b64 = await toB64(chunks[i])
    const t = await call([{ role:'user', content:`Transcribe chunk ${i+1}/${chunks.length} from Azerbaijan. ${contextNote} Mark switches [AZ][RU][EN][UNK]. Return ONLY the transcribed text.` }], SYS, 1500)
    parts.push(t.trim())
  }
  const full = parts.join(' ')
  const analysis = await runLinguisticAnalysis(full, contextNote, 'native_speaker')
  return { transcription:full, detectedLanguages:analysis?.detectedLanguages||[], languageNames:analysis?.languageNames||[], translation_en:analysis?.translation_en||'', transliteration:analysis?.transliteration||'', matrixLang:analysis?.matrixLang||'', hasCodeSwitching:analysis?.hasCodeSwitching||false, switchType:analysis?.switchType||'', linguisticNotes:analysis?.linguisticNotes||'' }
}

export async function analyseWords(text, sourceType='photo', zone='') {
  if (!text?.trim()) return []
  const ctx = sourceType==='youtube' ? 'pedagogical Azerbaijani YouTube video' :
    sourceType==='native_speaker' ? 'spontaneous native Baku speaker recording' : `sign in ${zone||'Azerbaijan'}`
  const t = await call([{ role:'user', content:`Deep word-level analysis of every word in this text from a ${ctx}.

Text: ${text}

Return a JSON array. Each element:
{"word":"<exact form>","position":<index>,"script":"<Latin|Cyrillic|Arabic|Armenian|Georgian|Mixed|Unknown>","language":"<code>","languageName":"<name>","root":"<root/stem>","rootLanguage":"<origin language>","rootLanguageFamily":"<family>","prefix":"<prefix or null>","suffix":"<suffix or null>","integrationClass":"<native|established_loanword|recent_borrowing|morphological_hybrid|code_switch|calque|proper_noun|unknown>","pos":"<noun|verb|adjective|adverb|pronoun|preposition|conjunction|particle|proper_noun>","lemma":"<base form>","meaning_en":"<dictionary meaning>","meaning_contextual":"<meaning in this specific text>","meaningShift":"<shift from source language or null>","etymology":"<origin story>","semanticField":"<field>","connotation":"<neutral|formal|informal|colloquial|prestige|archaic|technical|youth_slang>","register":"<formal|informal|neutral|street|bureaucratic>","notes":"<linguistically interesting observation>"}

Return ONLY the JSON array.` }], SYS, 4000)
  return parseJSON(t) || []
}
