import React, { useState, useEffect, useRef } from 'react'
import { getAllEntries, updateEntry } from '../lib/db.js'
import { runOCR, runLinguisticAnalysis, transcribeAudio } from '../lib/api.js'
import { formatCoords, mapsUrl } from '../lib/exif.js'
import { SOURCE_TYPES } from '../lib/constants.js'

const STEPS_PHOTO = [
  { id:'ocr', label:'OCR — extract text from image' },
  { id:'language', label:'Detect languages & scripts' },
  { id:'translate', label:'Translate to English' },
  { id:'transliterate', label:'Transliterate to Latin' },
  { id:'tag', label:'Auto-tag domain, type, code-switching' },
]

const STEPS_AUDIO = [
  { id:'transcribe', label:'Transcribe audio' },
  { id:'language', label:'Detect languages & code-switching' },
  { id:'translate', label:'Translate to English' },
  { id:'transliterate', label:'Transliterate to Latin' },
  { id:'tag', label:'Auto-tag domain, type, analysis' },
]

function SourceBadge({ sourceType }) {
  const s = SOURCE_TYPES[sourceType] || SOURCE_TYPES.photo
  return <span className="src-badge" style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{s.icon} {s.label}</span>
}

function StepIndicator({ steps, stepDefs }) {
  return (
    <div style={{ background:'var(--bg3)', borderRadius:'var(--r)', padding:'8px 12px', marginTop:10 }}>
      {stepDefs.map(s => {
        const state = steps[s.id] || 'idle'
        return (
          <div key={s.id} className="step-row">
            <div className={`step-num step-${state}`}>
              {state==='running' ? <div className="spinner" style={{ width:10, height:10, borderWidth:2 }} /> :
               state==='done' ? '✓' : state==='failed' ? '✕' : '○'}
            </div>
            <div style={{ flex:1, fontSize:12, color:state==='idle'?'var(--text3)':'var(--text)' }}>{s.label}</div>
            {state==='done' && <span style={{ fontSize:10, color:'var(--green)', fontWeight:600 }}>Done</span>}
            {state==='failed' && <span style={{ fontSize:10, color:'var(--red)', fontWeight:600 }}>Failed</span>}
          </div>
        )
      })}
    </div>
  )
}

function EntryRow({ entry, onDone }) {
  const [steps, setSteps] = useState({})
  const [result, setResult] = useState({})
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (entry.status === 'done' || entry.status === 'ocr_done') {
      setResult({ ocrText:entry.ocrText, transcription:entry.transcription, translation_en:entry.translation?.en, transliteration:entry.transliteration, detectedLanguages:entry.detectedLanguages, languageNames:entry.languageNames, scripts:entry.scripts, domain:entry.domain, entryType:entry.entryType, matrixLang:entry.matrixLang, hasCodeSwitching:entry.hasCodeSwitching, switchType:entry.switchType, linguisticNotes:entry.linguisticNotes })
      const done = {}; const steps = entry.sourceType==='photo' ? STEPS_PHOTO : STEPS_AUDIO
      steps.forEach(s => { done[s.id]='done' }); setSteps(done)
    }
  }, [entry.id])

  function setStep(id, state) { setSteps(prev => ({ ...prev, [id]:state })) }

  async function run() {
    if (running) return
    setRunning(true); setResult({})
    const stepDefs = entry.sourceType==='photo' ? STEPS_PHOTO : STEPS_AUDIO
    stepDefs.forEach(s => setStep(s.id, 'idle'))

    try {
      await updateEntry(entry.id, { status:'processing' }, 'ai')

      if (entry.sourceType === 'photo') {
        // OCR
        setStep('ocr','running')
        const ocr = await runOCR(entry.blob)
        if (!ocr.hasText) {
          setStep('ocr','done')
          await updateEntry(entry.id, { status:'done', ocrText:'', hasText:false }, 'ai')
          setRunning(false); onDone(); return
        }
        setResult(r => ({ ...r, ocrText:ocr.ocrText, imageDescription:ocr.imageDescription }))
        await updateEntry(entry.id, { ocrText:ocr.ocrText, imageDescription:ocr.imageDescription, ocrConfidence:ocr.confidence, status:'ocr_done' }, 'ai')
        setStep('ocr','done')

        // Full analysis
        setStep('language','running'); setStep('translate','running'); setStep('transliterate','running'); setStep('tag','running')
        const analysis = await runLinguisticAnalysis(ocr.ocrText, ocr.imageDescription, 'photo')
        if (analysis) {
          setResult(r => ({ ...r, ...analysis, translation_en:analysis.translation_en }))
          await updateEntry(entry.id, {
            status:'done', detectedLanguages:analysis.detectedLanguages||[], languageNames:analysis.languageNames||[],
            scripts:analysis.scripts||[], translation:{ en:analysis.translation_en||'' },
            transliteration:analysis.transliteration||'', domain:analysis.domain||'',
            entryType:analysis.entryType||'', matrixLang:analysis.matrixLang||'',
            hasCodeSwitching:analysis.hasCodeSwitching||false, switchType:analysis.switchType||'',
            switchTrigger:analysis.switchTrigger||'', audienceLanguages:analysis.audienceLanguages||[],
            linguisticNotes:analysis.linguisticNotes||'',
          }, 'ai')
        }
        setStep('language',analysis?'done':'failed'); setStep('translate',analysis?.translation_en?'done':'failed')
        setStep('transliterate',analysis?.transliteration?'done':'failed'); setStep('tag',analysis?.domain?'done':'failed')

      } else {
        // Audio/video transcription
        setStep('transcribe','running')
        const contextNote = entry.sourceType==='youtube'
          ? `This is a pedagogical Azerbaijani lesson from ${entry.yt_channelName||'YouTube'}. Topic: ${entry.yt_lessonTopic||''}. Instructor: ${entry.yt_speakerName||''}.`
          : entry.sourceType==='native_speaker'
          ? `This is a spontaneous recording from a native Baku Azerbaijani speaker. Speaker: ${entry.ns_speakerName||'unknown'}, age ${entry.ns_speakerAge||'unknown'}, from ${entry.ns_speakerNeighbourhood||'Baku'}. Context: ${entry.ns_recordingContext||''}.`
          : ''
        const tx = await transcribeAudio(entry.blob, contextNote)
        if (tx.transcription) {
          setResult(r => ({ ...r, transcription:tx.transcription, detectedLanguages:tx.detectedLanguages, languageNames:tx.languageNames }))
          await updateEntry(entry.id, { transcription:tx.transcription, detectedLanguages:tx.detectedLanguages||[], languageNames:tx.languageNames||[], matrixLang:tx.matrixLang||'', hasCodeSwitching:tx.hasCodeSwitching||false, switchType:tx.switchType||'', linguisticNotes:tx.linguisticNotes||'', translation:{ en:tx.translation_en||'' }, transliteration:tx.transliteration||'', status:'done' }, 'ai')
          setResult(r => ({ ...r, translation_en:tx.translation_en, transliteration:tx.transliteration }))
        }
        setStep('transcribe','done'); setStep('language',tx.detectedLanguages?.length?'done':'failed')
        setStep('translate',tx.translation_en?'done':'failed'); setStep('transliterate',tx.transliteration?'done':'failed')
        setStep('tag',tx.switchType?'done':'failed')
      }
      onDone()
    } catch(e) {
      Object.keys(steps).forEach(s => { if(steps[s]==='running') setStep(s,'failed') })
      await updateEntry(entry.id, { status:'failed', error:e.message }, 'ai')
    }
    setRunning(false)
  }

  const isPhoto = entry.sourceType === 'photo'
  const stepDefs = isPhoto ? STEPS_PHOTO : STEPS_AUDIO
  const exif = entry.exif || {}
  const geo = entry.geo || {}
  const mainText = result.ocrText || result.transcription || ''

  return (
    <div className="card" style={{ marginBottom:10, overflow:'hidden' }}>
      <div style={{ display:'flex', gap:12, padding:'12px 16px', alignItems:'flex-start' }}>
        {entry.thumbUrl && <img src={entry.thumbUrl} alt="" style={{ width:64, height:64, objectFit:'cover', borderRadius:'var(--r)', flexShrink:0, border:'1px solid var(--border)' }} />}
        {!entry.thumbUrl && <div style={{ width:64, height:64, background:'var(--bg3)', borderRadius:'var(--r)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>
          {entry.sourceType==='youtube'?'🎬':entry.sourceType==='native_speaker'?'🎙':'📄'}
        </div>}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
            <span style={{ fontWeight:600, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:220 }}>{entry.filename}</span>
            <span className={`status-badge s-${entry.status}`}>{entry.status?.replace('_',' ')}</span>
            <SourceBadge sourceType={entry.sourceType} />
            {entry.hasCodeSwitching && <span style={{ fontSize:10, color:'var(--amber)', fontWeight:600 }}>⇄ Code-switching</span>}
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', fontSize:11, marginBottom:8, color:'var(--text2)' }}>
            {exif.datetime && <span>📅 {exif.datetime.replace(/^(\d{4}):(\d{2}):(\d{2}) /,'$1-$2-$3 ')}</span>}
            {exif.lat && <a href={mapsUrl(exif.lat,exif.lon)} target="_blank" rel="noreferrer" style={{ color:'var(--accent)' }}>📍 {formatCoords(exif.lat,exif.lon)}</a>}
            {geo.city && <span>🗺 {geo.city}</span>}
            {entry.yt_videoTitle && <span>🎬 {entry.yt_videoTitle.slice(0,40)}</span>}
            {entry.ns_speakerName && <span>🎙 {entry.ns_speakerName}</span>}
            <span style={{ color:'var(--text3)' }}>by {entry.collectedBy||'—'}</span>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={run} disabled={running}>
              {running ? <><div className="spinner" />Processing…</> : entry.status==='done'?'↻ Re-process':'▶ Process'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setExpanded(e=>!e)}>
              {expanded?'Hide results ↑':'Show results ↓'}
            </button>
          </div>
        </div>
      </div>

      {(running || Object.keys(steps).length > 0) && (
        <div style={{ padding:'0 16px 12px' }}><StepIndicator steps={steps} stepDefs={stepDefs} /></div>
      )}

      {expanded && mainText && (
        <div style={{ padding:'0 16px 16px', borderTop:'1px solid var(--border)' }}>
          <div style={{ fontWeight:600, fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.07em', margin:'12px 0 10px' }}>Results — all AI-generated, edit in Review tab</div>
          {result.imageDescription && <div style={{ fontSize:12, color:'var(--text2)', marginBottom:8, fontStyle:'italic' }}>{result.imageDescription}</div>}
          {mainText && <div style={{ marginBottom:10 }}><div className="field-label" style={{ marginBottom:4 }}>{isPhoto?'OCR text':'Transcription'}</div><div className="mono-block">{mainText}</div></div>}
          {result.translation_en && <div style={{ marginBottom:8 }}><div className="field-label" style={{ marginBottom:4 }}>Translation (English)</div><div style={{ fontSize:13 }}>{result.translation_en}</div></div>}
          {result.transliteration && <div style={{ marginBottom:8 }}><div className="field-label" style={{ marginBottom:4 }}>Transliteration</div><div className="mono-block">{result.transliteration}</div></div>}
          {result.languageNames?.length > 0 && <div style={{ marginBottom:8 }}><div className="field-label" style={{ marginBottom:4 }}>Languages</div><div className="chips">{result.languageNames.map(l=><span key={l} className="chip on">{l}</span>)}</div></div>}
          {result.domain && <div style={{ fontSize:12, color:'var(--text2)', marginTop:6 }}>Domain: <strong>{result.domain}</strong> · Switch: <strong>{result.switchType||'None'}</strong></div>}
          {result.linguisticNotes && <div style={{ marginTop:8, fontSize:12, color:'var(--text2)', fontStyle:'italic', borderLeft:'3px solid var(--accent-border)', paddingLeft:10 }}>{result.linguisticNotes}</div>}
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
    total:entries.length,
    pending:entries.filter(e=>e.status==='uploaded').length,
    done:entries.filter(e=>e.status==='done').length,
    failed:entries.filter(e=>e.status==='failed').length,
  }

  const filtered = entries.filter(e =>
    (filter==='all'||e.status===filter||(filter==='pending'&&e.status==='uploaded')) &&
    (sourceFilter==='all'||e.sourceType===sourceFilter)
  )

  async function batchProcess() {
    if (batchRef.current) return
    batchRef.current=true; setBatchRunning(true)
    const pending = entries.filter(e=>e.status==='uploaded')
    for (const entry of pending) {
      if (!batchRef.current) break
      try {
        await updateEntry(entry.id, { status:'processing' }, 'ai')
        if (entry.sourceType==='photo') {
          const ocr = await runOCR(entry.blob)
          if (ocr.hasText) {
            const analysis = await runLinguisticAnalysis(ocr.ocrText, ocr.imageDescription, 'photo')
            await updateEntry(entry.id, { status:'done', ocrText:ocr.ocrText, imageDescription:ocr.imageDescription, detectedLanguages:analysis?.detectedLanguages||[], languageNames:analysis?.languageNames||[], scripts:analysis?.scripts||[], translation:{ en:analysis?.translation_en||'' }, transliteration:analysis?.transliteration||'', domain:analysis?.domain||'', entryType:analysis?.entryType||'', matrixLang:analysis?.matrixLang||'', hasCodeSwitching:analysis?.hasCodeSwitching||false, switchType:analysis?.switchType||'', linguisticNotes:analysis?.linguisticNotes||'' }, 'ai')
          } else {
            await updateEntry(entry.id, { status:'done', ocrText:'', hasText:false }, 'ai')
          }
        } else {
          const ctx = entry.sourceType==='youtube' ? `Pedagogical Azerbaijani lesson. Topic: ${entry.yt_lessonTopic||''}. Instructor: ${entry.yt_speakerName||''}.` : `Native Baku speaker. Speaker: ${entry.ns_speakerName||'unknown'}. Context: ${entry.ns_recordingContext||''}.`
          const tx = await transcribeAudio(entry.blob, ctx)
          await updateEntry(entry.id, { status:'done', transcription:tx.transcription||'', detectedLanguages:tx.detectedLanguages||[], languageNames:tx.languageNames||[], translation:{ en:tx.translation_en||'' }, transliteration:tx.transliteration||'', matrixLang:tx.matrixLang||'', hasCodeSwitching:tx.hasCodeSwitching||false, switchType:tx.switchType||'', linguisticNotes:tx.linguisticNotes||'' }, 'ai')
        }
      } catch(e) {
        await updateEntry(entry.id, { status:'failed', error:e.message }, 'ai')
      }
      setEntries(await getAllEntries())
    }
    batchRef.current=false; setBatchRunning(false); onProcessed()
  }

  return (
    <div>
      <div className="card card-pad" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', gap:12, alignItems:'flex-start', flexWrap:'wrap' }}>
          <div className="g4" style={{ flex:1, gap:10 }}>
            {[['Total',counts.total,'var(--text)'],['Pending',counts.pending,'var(--amber)'],['Done',counts.done,'var(--green)'],['Failed',counts.failed,'var(--red)']].map(([l,n,c])=>(
              <div key={l} className="stat"><div className="stat-num" style={{ color:c }}>{n}</div><div className="stat-label">{l}</div></div>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, minWidth:200 }}>
            {!hasKey && <div className="warn-box" style={{ fontSize:11 }}>Set API key in top bar to process</div>}
            <button className="btn btn-primary" style={{ justifyContent:'center' }} onClick={batchProcess} disabled={!hasKey||batchRunning||counts.pending===0}>
              {batchRunning ? <><div className="spinner" />Processing batch…</> : `Process all ${counts.pending} pending`}
            </button>
            {batchRunning && <button className="btn btn-ghost btn-sm" onClick={()=>{batchRef.current=false}}>Stop batch</button>}
          </div>
        </div>
        {counts.total > 0 && (
          <div style={{ marginTop:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)', marginBottom:4 }}>
              <span>Overall progress</span><span>{counts.done}/{counts.total} ({Math.round(counts.done/counts.total*100)}%)</span>
            </div>
            <div className="progress-track"><div className="progress-fill" style={{ width:`${counts.total?(counts.done/counts.total)*100:0}%` }} /></div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        {['all','pending','done','failed'].map(f=>(
          <button key={f} className={`chip ${filter===f?'on':''}`} onClick={()=>setFilter(f)} style={{ textTransform:'capitalize' }}>{f}</button>
        ))}
        <div style={{ width:1, background:'var(--border)', margin:'0 4px' }} />
        {['all','photo','native_speaker','youtube'].map(s=>(
          <button key={s} className={`chip ${sourceFilter===s?'on':''}`} onClick={()=>setSourceFilter(s)} style={{ textTransform:'capitalize' }}>
            {s==='all'?'All sources':s==='photo'?'📷 Photos':s==='native_speaker'?'🎙 Native speaker':'🎬 YouTube'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text3)', fontSize:13 }}>
          {entries.length===0?'No entries yet. Upload files first.':'No entries match this filter.'}
        </div>
      ) : filtered.map(e => <EntryRow key={e.id} entry={e} onDone={()=>{ getAllEntries().then(setEntries); onProcessed() }} />)}
    </div>
  )
}
