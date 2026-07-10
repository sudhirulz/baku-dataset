import React, { useState, useEffect, useRef } from 'react'
import { getAllEntries, updateEntry } from '../lib/db.js'
import { runOCR, runLinguisticAnalysis, transcribeAudio, analyseTranscriptText } from '../lib/api.js'
import { formatCoords, mapsUrl } from '../lib/exif.js'
import { SOURCE_TYPES } from '../lib/constants.js'

const STEPS_PHOTO = [
  { id: 'ocr', label: 'OCR — extract text from image' },
  { id: 'language', label: 'Detect languages & scripts' },
  { id: 'translate', label: 'Translate to English' },
  { id: 'transliterate', label: 'Transliterate to Latin' },
  { id: 'tag', label: 'Auto-tag domain, type, code-switching' },
]

const STEPS_AUDIO = [
  { id: 'transcribe', label: 'Transcribe audio' },
  { id: 'language', label: 'Detect languages & code-switching' },
  { id: 'translate', label: 'Translate to English' },
  { id: 'transliterate', label: 'Transliterate to Latin' },
  { id: 'tag', label: 'Auto-tag analysis' },
]

const STEPS_CAPTION = [
  { id: 'analyse', label: 'Analyse caption text & tag language switches' },
  { id: 'translate', label: 'Translate to English' },
  { id: 'transliterate', label: 'Transliterate to Latin' },
  { id: 'tag', label: 'Auto-tag domain, code-switching, analysis' },
]

function StepIndicator({ steps, stepDefs }) {
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r)', padding: '8px 12px', marginTop: 10 }}>
      {stepDefs.map(s => {
        const state = steps[s.id] || 'idle'
        return (
          <div key={s.id} className="step-row">
            <div className={`step-num step-${state}`}>
              {state === 'running' ? <div className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} />
                : state === 'done' ? '✓' : state === 'failed' ? '✕' : '○'}
            </div>
            <div style={{ flex: 1, fontSize: 12, color: state === 'idle' ? 'var(--text3)' : 'var(--text)' }}>{s.label}</div>
            {state === 'done' && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>Done</span>}
            {state === 'failed' && <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>Failed</span>}
          </div>
        )
      })}
    </div>
  )
}

function SourceBadge({ sourceType }) {
  const s = SOURCE_TYPES[sourceType] || SOURCE_TYPES.photo
  return <span className="src-badge" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.icon} {s.label}</span>
}

// Manual transcript input for when audio can't be processed
function ManualTranscriptInput({ entry, onSave }) {
  const [text, setText] = useState(entry.manualTranscript || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await updateEntry(entry.id, { manualTranscript: text, rawText: text }, 'researcher')
    setSaving(false)
    onSave()
  }

  return (
    <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber-border)', borderRadius: 'var(--r)', padding: 12, marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)', marginBottom: 6 }}>
        ⚠ Audio file cannot be processed directly
      </div>
      <div style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 10, lineHeight: 1.6 }}>
        The API cannot receive audio blobs from the browser. Options:<br />
        1. Convert to MP3 under 4MB and re-upload<br />
        2. Transcribe manually and paste below — AI will then analyse the text
      </div>
      <div className="field-label" style={{ marginBottom: 4 }}>Paste transcript manually</div>
      <textarea value={text} onChange={e => setText(e.target.value)}
        placeholder="Type or paste what was said in the recording. Include both Azerbaijani and any other languages used."
        style={{ minHeight: 80, marginBottom: 8 }} />
      <button className="btn btn-sm btn-primary" onClick={save} disabled={!text.trim() || saving}>
        {saving ? 'Saving…' : 'Save transcript — then click Process'}
      </button>
    </div>
  )
}

function EntryRow({ entry, onDone }) {
  const [steps, setSteps] = useState({})
  const [result, setResult] = useState({})
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)
  const [currentEntry, setCurrentEntry] = useState(entry)

  useEffect(() => {
    if (entry.status === 'done' || entry.status === 'ocr_done') {
      setResult({
        ocrText: entry.ocrText, transcription: entry.transcription,
        translation_en: entry.translation?.en, transliteration: entry.transliteration,
        detectedLanguages: entry.detectedLanguages, languageNames: entry.languageNames,
        scripts: entry.scripts, domain: entry.domain, entryType: entry.entryType,
        matrixLang: entry.matrixLang, hasCodeSwitching: entry.hasCodeSwitching,
        switchType: entry.switchType, linguisticNotes: entry.linguisticNotes,
      })
      const doneSteps = {}
      const defs = entry.sourceType === 'photo' ? STEPS_PHOTO :
        entry.sourceType === 'youtube' ? STEPS_CAPTION : STEPS_AUDIO
      defs.forEach(s => { doneSteps[s.id] = 'done' })
      setSteps(doneSteps)
    }
    setCurrentEntry(entry)
  }, [entry.id, entry.status])

  function setStep(id, state) { setSteps(prev => ({ ...prev, [id]: state })) }

  async function run() {
    if (running) return
    setRunning(true); setResult({})
    setShowManualInput(false)

    // Determine step definitions
    const isPhoto = currentEntry.sourceType === 'photo'
    const isYT = currentEntry.sourceType === 'youtube'
    const isNS = currentEntry.sourceType === 'native_speaker'
    const stepDefs = isPhoto ? STEPS_PHOTO : isYT ? STEPS_CAPTION : STEPS_AUDIO
    stepDefs.forEach(s => setStep(s.id, 'idle'))

    try {
      await updateEntry(currentEntry.id, { status: 'processing' }, 'ai')

      if (isPhoto) {
        // ── Photo: OCR then analyse ──
        setStep('ocr', 'running')
        const ocr = await runOCR(currentEntry.blob)
        if (!ocr.hasText) {
          setStep('ocr', 'done')
          await updateEntry(currentEntry.id, { status: 'done', ocrText: '', hasText: false }, 'ai')
          setRunning(false); onDone(); return
        }
        setResult(r => ({ ...r, ocrText: ocr.ocrText, imageDescription: ocr.imageDescription }))
        await updateEntry(currentEntry.id, { ocrText: ocr.ocrText, imageDescription: ocr.imageDescription, ocrConfidence: ocr.confidence, status: 'ocr_done' }, 'ai')
        setStep('ocr', 'done')

        setStep('language', 'running'); setStep('translate', 'running')
        setStep('transliterate', 'running'); setStep('tag', 'running')
        const analysis = await runLinguisticAnalysis(ocr.ocrText, ocr.imageDescription, 'photo')
        if (analysis) {
          setResult(r => ({ ...r, ...analysis, translation_en: analysis.translation_en }))
          await updateEntry(currentEntry.id, {
            status: 'done',
            detectedLanguages: analysis.detectedLanguages || [],
            languageNames: analysis.languageNames || [],
            scripts: analysis.scripts || [],
            translation: { en: analysis.translation_en || '' },
            transliteration: analysis.transliteration || '',
            domain: analysis.domain || '', entryType: analysis.entryType || '',
            matrixLang: analysis.matrixLang || '',
            hasCodeSwitching: analysis.hasCodeSwitching || false,
            switchType: analysis.switchType || '',
            switchTrigger: analysis.switchTrigger || '',
            linguisticNotes: analysis.linguisticNotes || '',
          }, 'ai')
        }
        setStep('language', analysis ? 'done' : 'failed')
        setStep('translate', analysis?.translation_en ? 'done' : 'failed')
        setStep('transliterate', analysis?.transliteration ? 'done' : 'failed')
        setStep('tag', analysis?.domain ? 'done' : 'failed')

      } else if (isYT) {
        // ── YouTube: MP3 audio OR caption text ──
        const contextNote = `This is from "${currentEntry.yt_videoTitle || 'a Learn Azerbaijani Today video'}". Topic: ${currentEntry.yt_lessonTopic || ''}. Instructor: ${currentEntry.yt_speakerName || 'Samantha Parker'}. This is a pedagogical Azerbaijani lesson.`
        const captionText = currentEntry.rawText || currentEntry.captionText || ''
        const hasAudio = currentEntry.blob && currentEntry.type === 'audio'

        let tx = null

        if (hasAudio) {
          // Try MP3 audio transcription first
          setStep('analyse', 'running')
          const audioResult = await transcribeAudio(currentEntry.blob, contextNote)
          if (audioResult?.error === 'CANNOT_PROCESS_AUDIO' || audioResult?.error === 'FILE_TOO_LARGE') {
            // Fall back to caption text if available
            if (captionText.trim()) {
              tx = await analyseTranscriptText(captionText, 'youtube', contextNote)
            } else {
              setShowManualInput(true)
              await updateEntry(currentEntry.id, { status: 'failed', error: 'Audio cannot be processed — paste transcript manually' }, 'ai')
              setRunning(false); return
            }
          } else {
            tx = audioResult
          }
        } else if (captionText.trim()) {
          // Use pasted caption text
          setStep('analyse', 'running')
          tx = await analyseTranscriptText(captionText, 'youtube', contextNote)
        } else {
          await updateEntry(currentEntry.id, { status: 'failed', error: 'No audio or caption text — add in Upload tab' }, 'ai')
          setRunning(false); onDone(); return
        }

        if (tx && !tx.error) {
          const transcriptFinal = tx.transcription || captionText
          setResult(r => ({ ...r, transcription: transcriptFinal, detectedLanguages: tx.detectedLanguages, languageNames: tx.languageNames, translation_en: tx.translation_en, transliteration: tx.transliteration }))
          await updateEntry(currentEntry.id, {
            status: 'done',
            transcription: transcriptFinal,
            translation: { en: tx.translation_en || '' },
            transliteration: tx.transliteration || '',
            detectedLanguages: tx.detectedLanguages || [],
            languageNames: tx.languageNames || [],
            matrixLang: tx.matrixLang || '',
            hasCodeSwitching: tx.hasCodeSwitching || false,
            switchType: tx.switchType || '',
            switchTrigger: tx.switchTrigger || '',
            domain: 'Education', entryType: 'Pedagogical speech',
            linguisticNotes: tx.linguisticNotes || '',
          }, 'ai')
        }
        setStep('analyse', tx && !tx.error ? 'done' : 'failed')
        setStep('translate', tx?.translation_en ? 'done' : 'failed')
        setStep('transliterate', tx?.transliteration ? 'done' : 'failed')
        setStep('tag', tx?.switchType ? 'done' : 'failed')

      } else if (isNS) {
        // ── Native speaker: try audio, fallback to manual ──
        const textToUse = currentEntry.manualTranscript || currentEntry.rawText || ''

        if (textToUse.trim()) {
          // Has manual transcript — analyse it directly
          setStep('transcribe', 'done')
          setStep('language', 'running'); setStep('translate', 'running')
          setStep('transliterate', 'running'); setStep('tag', 'running')
          const contextNote = `Native Baku speaker. Speaker: ${currentEntry.ns_speakerName || 'unknown'}, age ${currentEntry.ns_speakerAge || 'unknown'}. Context: ${currentEntry.ns_recordingContext || ''}.`
          const tx = await analyseTranscriptText(textToUse, 'native_speaker', contextNote)
          if (tx) {
            setResult(r => ({ ...r, transcription: tx.transcription, translation_en: tx.translation_en, transliteration: tx.transliteration, detectedLanguages: tx.detectedLanguages, languageNames: tx.languageNames }))
            await updateEntry(currentEntry.id, {
              status: 'done',
              transcription: tx.transcription || textToUse,
              translation: { en: tx.translation_en || '' },
              transliteration: tx.transliteration || '',
              detectedLanguages: tx.detectedLanguages || [],
              languageNames: tx.languageNames || [],
              matrixLang: tx.matrixLang || '',
              hasCodeSwitching: tx.hasCodeSwitching || false,
              switchType: tx.switchType || '',
              linguisticNotes: tx.linguisticNotes || '',
            }, 'ai')
          }
          setStep('language', tx ? 'done' : 'failed')
          setStep('translate', tx?.translation_en ? 'done' : 'failed')
          setStep('transliterate', tx?.transliteration ? 'done' : 'failed')
          setStep('tag', tx?.switchType ? 'done' : 'failed')

        } else if (currentEntry.blob) {
          // Try audio transcription
          setStep('transcribe', 'running')
          const tx = await transcribeAudio(currentEntry.blob,
            `Native Baku speaker. ${currentEntry.ns_speakerName || ''}. Context: ${currentEntry.ns_recordingContext || ''}.`)

          if (tx?.error === 'CANNOT_PROCESS_AUDIO' || tx?.error === 'FILE_TOO_LARGE') {
            // Show manual input
            setStep('transcribe', 'failed')
            await updateEntry(currentEntry.id, { status: 'failed', error: tx.error }, 'ai')
            setShowManualInput(true)
            setRunning(false); return
          }

          if (tx?.transcription) {
            setResult(r => ({ ...r, transcription: tx.transcription, translation_en: tx.translation_en, transliteration: tx.transliteration, detectedLanguages: tx.detectedLanguages, languageNames: tx.languageNames }))
            await updateEntry(currentEntry.id, {
              status: 'done',
              transcription: tx.transcription,
              translation: { en: tx.translation_en || '' },
              transliteration: tx.transliteration || '',
              detectedLanguages: tx.detectedLanguages || [],
              languageNames: tx.languageNames || [],
              matrixLang: tx.matrixLang || '',
              hasCodeSwitching: tx.hasCodeSwitching || false,
              switchType: tx.switchType || '',
              linguisticNotes: tx.linguisticNotes || '',
            }, 'ai')
            setStep('transcribe', 'done')
            setStep('language', 'done'); setStep('translate', 'done')
            setStep('transliterate', 'done'); setStep('tag', 'done')
          }
        } else {
          setStep('transcribe', 'failed')
          await updateEntry(currentEntry.id, { status: 'failed', error: 'No audio blob or transcript' }, 'ai')
          setShowManualInput(true)
          setRunning(false); return
        }
      }

      onDone()
    } catch (e) {
      Object.keys(steps).forEach(s => { if (steps[s] === 'running') setStep(s, 'failed') })
      await updateEntry(currentEntry.id, { status: 'failed', error: e.message }, 'ai')
    }

    setRunning(false)
  }

  const isPhoto = currentEntry.sourceType === 'photo'
  const isYT = currentEntry.sourceType === 'youtube'
  const stepDefs = isPhoto ? STEPS_PHOTO : isYT ? STEPS_CAPTION : STEPS_AUDIO
  const exif = currentEntry.exif || {}
  const geo = currentEntry.geo || {}
  const mainText = result.ocrText || result.transcription || ''
  const captionWordCount = (currentEntry.rawText || '').split(/\s+/).filter(Boolean).length
  const hasAudioBlob = currentEntry.blob && (currentEntry.type === 'audio' || currentEntry.yt_inputMode === 'mp3_audio')

  return (
    <div className="card" style={{ marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 12, padding: '12px 16px', alignItems: 'flex-start' }}>
        {currentEntry.thumbUrl && <img src={currentEntry.thumbUrl} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--r)', flexShrink: 0, border: '1px solid var(--border)' }} />}
        {!currentEntry.thumbUrl && (
          <div style={{ width: 64, height: 64, background: 'var(--bg3)', borderRadius: 'var(--r)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
            {isYT ? '🎬' : currentEntry.sourceType === 'native_speaker' ? '🎙' : '📄'}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
              {currentEntry.yt_videoTitle || currentEntry.filename}
            </span>
            <span className={`status-badge s-${currentEntry.status}`}>{currentEntry.status?.replace('_', ' ')}</span>
            <SourceBadge sourceType={currentEntry.sourceType} />
            {currentEntry.hasCodeSwitching && <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600 }}>⇄ Code-switching</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, marginBottom: 8, color: 'var(--text2)' }}>
            {exif.datetime && <span>📅 {exif.datetime.replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3 ')}</span>}
            {exif.lat && <a href={mapsUrl(exif.lat, exif.lon)} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>📍 {formatCoords(exif.lat, exif.lon)}</a>}
            {geo.city && <span>🗺 {geo.city}</span>}
            {currentEntry.yt_videoUrl && <a href={currentEntry.yt_videoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>▶ Watch video</a>}
            {isYT && hasAudioBlob && <span style={{ color: 'var(--green)', fontWeight: 500 }}>✓ MP3 audio ready to transcribe</span>}
            {isYT && !hasAudioBlob && captionWordCount > 0 && <span style={{ color: 'var(--green)', fontWeight: 500 }}>✓ {captionWordCount} words of captions ready</span>}
            {isYT && !hasAudioBlob && captionWordCount === 0 && <span style={{ color: 'var(--red)', fontWeight: 500 }}>⚠ No audio or caption — go to Upload tab</span>}
            {currentEntry.ns_speakerName && <span>🎙 {currentEntry.ns_speakerName}</span>}
            {currentEntry.fileSize && <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 10 }}>{currentEntry.fileSize}</span>}
            <span style={{ color: 'var(--text3)' }}>by {currentEntry.collectedBy || '—'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={run} disabled={running || (isYT && !hasAudioBlob && captionWordCount === 0)}>
              {running ? <><div className="spinner" />Processing…</> : currentEntry.status === 'done' ? '↻ Re-process' : '▶ Process'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(e => !e)}>
              {expanded ? 'Hide results ↑' : 'Show results ↓'}
            </button>
          </div>
        </div>
      </div>

      {(running || Object.keys(steps).length > 0) && (
        <div style={{ padding: '0 16px 12px' }}><StepIndicator steps={steps} stepDefs={stepDefs} /></div>
      )}

      {showManualInput && (
        <div style={{ padding: '0 16px 12px' }}>
          <ManualTranscriptInput entry={currentEntry} onSave={() => {
            setShowManualInput(false)
            import('../lib/db.js').then(m => m.getEntry(currentEntry.id)).then(e => { if (e) setCurrentEntry(e) })
          }} />
        </div>
      )}

      {expanded && mainText && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em', margin: '12px 0 10px' }}>
            Results — all AI-generated, edit in Review tab
          </div>
          {result.imageDescription && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontStyle: 'italic' }}>{result.imageDescription}</div>}
          {mainText && <div style={{ marginBottom: 10 }}><div className="field-label" style={{ marginBottom: 4 }}>{isPhoto ? 'OCR text' : 'Transcription (with language tags)'}</div><div className="mono-block">{mainText}</div></div>}
          {result.translation_en && <div style={{ marginBottom: 8 }}><div className="field-label" style={{ marginBottom: 4 }}>Translation (English)</div><div style={{ fontSize: 13 }}>{result.translation_en}</div></div>}
          {result.transliteration && <div style={{ marginBottom: 8 }}><div className="field-label" style={{ marginBottom: 4 }}>Transliteration</div><div className="mono-block">{result.transliteration}</div></div>}
          {result.languageNames?.length > 0 && <div style={{ marginBottom: 8 }}><div className="field-label" style={{ marginBottom: 4 }}>Languages</div><div className="chips">{result.languageNames.map(l => <span key={l} className="chip on">{l}</span>)}</div></div>}
          {result.domain && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>Domain: <strong>{result.domain}</strong> · Switch: <strong>{result.switchType || 'None'}</strong></div>}
          {result.linguisticNotes && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', borderLeft: '3px solid var(--accent-border)', paddingLeft: 10 }}>{result.linguisticNotes}</div>}
        </div>
      )}
    </div>
  )
}

export default function ProcessScreen({ tick, onProcessed, hasKey }) {
  const [entries, setEntries] = useState([])
  const [filter, setFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [batchRunning, setBatchRunning] = useState(false)
  const batchRef = useRef(false)

  useEffect(() => { getAllEntries().then(setEntries) }, [tick])

  const counts = {
    total: entries.length,
    pending: entries.filter(e => e.status === 'uploaded').length,
    done: entries.filter(e => e.status === 'done').length,
    failed: entries.filter(e => e.status === 'failed').length,
  }

  const filtered = entries.filter(e =>
    (filter === 'all' || e.status === filter || (filter === 'pending' && e.status === 'uploaded')) &&
    (sourceFilter === 'all' || e.sourceType === sourceFilter)
  )

  async function batchProcess() {
    if (batchRef.current) return
    batchRef.current = true; setBatchRunning(true)
    const pending = entries.filter(e => e.status === 'uploaded')
    for (const entry of pending) {
      if (!batchRef.current) break
      try {
        await updateEntry(entry.id, { status: 'processing' }, 'ai')
        if (entry.sourceType === 'photo') {
          const ocr = await runOCR(entry.blob)
          if (ocr.hasText) {
            const analysis = await runLinguisticAnalysis(ocr.ocrText, ocr.imageDescription, 'photo')
            await updateEntry(entry.id, { status: 'done', ocrText: ocr.ocrText, imageDescription: ocr.imageDescription, detectedLanguages: analysis?.detectedLanguages || [], languageNames: analysis?.languageNames || [], scripts: analysis?.scripts || [], translation: { en: analysis?.translation_en || '' }, transliteration: analysis?.transliteration || '', domain: analysis?.domain || '', entryType: analysis?.entryType || '', matrixLang: analysis?.matrixLang || '', hasCodeSwitching: analysis?.hasCodeSwitching || false, switchType: analysis?.switchType || '', linguisticNotes: analysis?.linguisticNotes || '' }, 'ai')
          } else {
            await updateEntry(entry.id, { status: 'done', ocrText: '', hasText: false }, 'ai')
          }
        } else if (entry.sourceType === 'youtube') {
          const captionText = entry.rawText || entry.captionText || ''
          if (captionText.trim()) {
            const ctx = `Pedagogical Azerbaijani lesson: "${entry.yt_videoTitle || ''}". Topic: ${entry.yt_lessonTopic || ''}.`
            const tx = await analyseTranscriptText(captionText, 'youtube', ctx)
            if (tx) await updateEntry(entry.id, { status: 'done', transcription: tx.transcription || captionText, translation: { en: tx.translation_en || '' }, transliteration: tx.transliteration || '', detectedLanguages: tx.detectedLanguages || [], languageNames: tx.languageNames || [], matrixLang: tx.matrixLang || '', hasCodeSwitching: tx.hasCodeSwitching || false, switchType: tx.switchType || '', linguisticNotes: tx.linguisticNotes || '', domain: 'Education', entryType: 'Pedagogical speech' }, 'ai')
          } else {
            await updateEntry(entry.id, { status: 'failed', error: 'No caption text pasted' }, 'ai')
          }
        } else if (entry.sourceType === 'native_speaker') {
          const textToUse = entry.manualTranscript || entry.rawText || ''
          if (textToUse.trim()) {
            const ctx = `Native Baku speaker. Speaker: ${entry.ns_speakerName || 'unknown'}.`
            const tx = await analyseTranscriptText(textToUse, 'native_speaker', ctx)
            if (tx) await updateEntry(entry.id, { status: 'done', transcription: tx.transcription || textToUse, translation: { en: tx.translation_en || '' }, transliteration: tx.transliteration || '', detectedLanguages: tx.detectedLanguages || [], languageNames: tx.languageNames || [], matrixLang: tx.matrixLang || '', hasCodeSwitching: tx.hasCodeSwitching || false, switchType: tx.switchType || '', linguisticNotes: tx.linguisticNotes || '' }, 'ai')
          } else {
            await updateEntry(entry.id, { status: 'failed', error: 'No transcript — use manual input' }, 'ai')
          }
        }
      } catch (e) {
        await updateEntry(entry.id, { status: 'failed', error: e.message }, 'ai')
      }
      setEntries(await getAllEntries())
    }
    batchRef.current = false; setBatchRunning(false); onProcessed()
  }

  return (
    <div>
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="g4" style={{ flex: 1, gap: 10 }}>
            {[['Total', counts.total, 'var(--text)'], ['Pending', counts.pending, 'var(--amber)'], ['Done', counts.done, 'var(--green)'], ['Failed', counts.failed, 'var(--red)']].map(([l, n, c]) => (
              <div key={l} className="stat"><div className="stat-num" style={{ color: c }}>{n}</div><div className="stat-label">{l}</div></div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
            {!hasKey && <div className="warn-box" style={{ fontSize: 11 }}>Set API key in top bar</div>}
            <button className="btn btn-primary" style={{ justifyContent: 'center' }}
              onClick={batchProcess} disabled={!hasKey || batchRunning || counts.pending === 0}>
              {batchRunning ? <><div className="spinner" />Processing batch…</> : `Process all ${counts.pending} pending`}
            </button>
            {batchRunning && <button className="btn btn-ghost btn-sm" onClick={() => { batchRef.current = false }}>Stop</button>}
          </div>
        </div>
        {counts.total > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
              <span>Progress</span><span>{counts.done}/{counts.total} ({Math.round(counts.done / counts.total * 100)}%)</span>
            </div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${counts.total ? (counts.done / counts.total) * 100 : 0}%` }} /></div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {['all', 'pending', 'done', 'failed'].map(f => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>{f}</button>
        ))}
        <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        {['all', 'photo', 'native_speaker', 'youtube'].map(s => (
          <button key={s} className={`chip ${sourceFilter === s ? 'on' : ''}`} onClick={() => setSourceFilter(s)}>
            {s === 'all' ? 'All sources' : s === 'photo' ? '📷 Photos' : s === 'native_speaker' ? '🎙 Native speaker' : '🎬 YouTube'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>
          {entries.length === 0 ? 'No entries yet. Upload files first.' : 'No entries match this filter.'}
        </div>
      ) : filtered.map(e => (
        <EntryRow key={e.id} entry={e} onDone={() => { getAllEntries().then(setEntries); onProcessed() }} />
      ))}
    </div>
  )
}
