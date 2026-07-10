import React, { useState, useRef, useCallback } from 'react'
import { addEntry } from '../lib/db.js'
import { extractEXIF, reverseGeocode, formatCoords, mapsUrl } from '../lib/exif.js'
import { ZONES, DEFAULT_COLLECTOR } from '../lib/constants.js'

const IMG = /\.(jpg|jpeg|png|webp|heic|heif)$/i
const AUD = /\.(mp3|m4a|wav|ogg|aac)$/i  // MP4 intentionally excluded — use MP3

function makeThumb(blob) {
  return new Promise(res => {
    if (!blob.type?.startsWith('image/')) return res(null)
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      const s = 400; const r = Math.min(s / img.width, s / img.height)
      c.width = img.width * r; c.height = img.height * r
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .75))
    }
    img.onerror = () => { URL.revokeObjectURL(url); res(null) }
    img.src = url
  })
}

function CollectorField({ value, onChange }) {
  return (
    <div className="field-group">
      <label className="field-label">Collected by</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="Your full name or initials" />
    </div>
  )
}

function CommentField({ value, onChange }) {
  return (
    <div className="field-group">
      <label className="field-label">Comments & extra info — free field</label>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        placeholder="Add any extra context, observations, or information here…"
        style={{ minHeight: 56 }} />
    </div>
  )
}

// ── PHOTO ────────────────────────────────────────────────
function PhotoUpload({ onUploaded }) {
  const [zone, setZone] = useState(ZONES[0])
  const [collectedBy, setCollectedBy] = useState(DEFAULT_COLLECTOR)
  const [comments, setComments] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, file: '' })
  const [uploaded, setUploaded] = useState([])
  const fileRef = useRef(null)

  async function processFiles(files) {
    const valid = Array.from(files).filter(f => IMG.test(f.name) || f.type?.startsWith('image/'))
    if (!valid.length) return
    setProcessing(true); setProgress({ current: 0, total: valid.length, file: '' })
    const added = []
    for (let i = 0; i < valid.length; i++) {
      const file = valid[i]; setProgress({ current: i + 1, total: valid.length, file: file.name })
      const [thumbUrl, exifData] = await Promise.all([makeThumb(file), extractEXIF(file)])
      let geo = null
      if (exifData?.lat && exifData?.lon) geo = await reverseGeocode(exifData.lat, exifData.lon)
      let autoZone = zone
      if (geo?.city) {
        const cl = geo.city.toLowerCase()
        const m = ZONES.find(z => z.toLowerCase().includes(cl) || cl.includes(z.toLowerCase().split(' ')[0]))
        if (m) autoZone = m
      }
      await addEntry({ sourceType: 'photo', type: 'image', filename: file.name, blob: file, thumbUrl, exif: exifData, exif_source: exifData ? 'exif' : null, geo, geo_source: geo ? 'geocode' : null, zone: autoZone, zone_source: 'researcher', collectedBy, comments: { general: comments } })
      added.push(file.name)
    }
    setUploaded(prev => [...prev, ...added]); setProcessing(false); onUploaded()
  }

  const onDrop = useCallback(async e => { e.preventDefault(); setIsDragging(false); await processFiles(e.dataTransfer.files) }, [zone, collectedBy, comments])
  const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div>
      <div className="g2" style={{ gap: 12, marginBottom: 14 }}>
        <CollectorField value={collectedBy} onChange={setCollectedBy} />
        <div className="field-group">
          <label className="field-label">Default zone</label>
          <select value={zone} onChange={e => setZone(e.target.value)}>{ZONES.map(z => <option key={z}>{z}</option>)}</select>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Auto-overridden by GPS if available</div>
        </div>
      </div>
      <CommentField value={comments} onChange={setComments} />
      <div onDrop={onDrop} onDragOver={e => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)}
        onClick={() => !processing && fileRef.current?.click()}
        style={{ border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 'var(--r3)', background: isDragging ? 'var(--accent-light)' : 'var(--bg2)', padding: '32px 24px', textAlign: 'center', cursor: processing ? 'default' : 'pointer', transition: 'all .15s', marginBottom: 12 }}>
        {processing ? (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Processing {progress.current} of {progress.total}…</div>
            <div style={{ maxWidth: 280, margin: '0 auto 6px' }}><div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div></div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{progress.file} — extracting EXIF + GPS</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop your photos here</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>JPG, PNG, WEBP, HEIC · Drag whole folder · GPS + timestamp auto-extracted</div>
            <div className="info-box" style={{ maxWidth: 440, margin: '0 auto', textAlign: 'left' }}>
              <strong>From Google Photos:</strong> photos.google.com → select Baku photos → ⋮ Download → unzip → drag folder here
            </div>
          </>
        )}
        <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => processFiles(e.target.files)} />
      </div>
      {uploaded.length > 0 && <div className="success-box">✓ {uploaded.length} photos uploaded. GPS and EXIF extracted automatically.</div>}
    </div>
  )
}

// ── NATIVE SPEAKER ───────────────────────────────────────
function NativeSpeakerUpload({ onUploaded }) {
  const [collectedBy, setCollectedBy] = useState(DEFAULT_COLLECTOR)
  const [m, setM] = useState({
    speakerName: '', speakerAge: '', speakerNeighbourhood: '', speakerEducation: '',
    speakerLangs: 'Azerbaijani (native), Russian (fluent)',
    generationContext: '', recordingContext: '', consentRecorded: 'yes',
    zone: ZONES[0], notes: '', comments: '',
  })
  const [files, setFiles] = useState([])
  const [rejectedFiles, setRejectedFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const set = (k, v) => setM(p => ({ ...p, [k]: v }))

  function handleFiles(fileList) {
    const all = Array.from(fileList)
    const valid = all.filter(f => AUD.test(f.name) || f.type?.startsWith('audio/'))
    const rejected = all.filter(f => !AUD.test(f.name) && !f.type?.startsWith('audio/'))
    setFiles(prev => [...prev, ...valid])
    if (rejected.length) setRejectedFiles(rejected.map(f => f.name))
  }

  async function save() {
    if (!files.length) return; setSaving(true)
    for (const file of files) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1)
      await addEntry({
        sourceType: 'native_speaker', type: 'audio',
        filename: file.name, blob: file,
        fileSize: `${sizeMB}MB`,
        collectedBy, zone: m.zone,
        ns_speakerName: m.speakerName, ns_speakerAge: m.speakerAge,
        ns_speakerNeighbourhood: m.speakerNeighbourhood, ns_speakerEducation: m.speakerEducation,
        ns_speakerLangs: m.speakerLangs, ns_generationContext: m.generationContext,
        ns_recordingContext: m.recordingContext, ns_consentRecorded: m.consentRecorded,
        notes: m.notes, comments: { general: m.comments },
        source_type_label: 'Native speaker recording',
        source_description: 'Spontaneous/elicited speech from native Baku Azerbaijani speaker',
        domain: 'Spontaneous speech', entryType: 'Spontaneous speech',
      })
    }
    setSaving(false); setFiles([]); setRejectedFiles([]); onUploaded()
  }

  const F = ({ label, k, ph, multi }) => (
    <div className="field-group">
      <label className="field-label">{label}</label>
      {multi ? <textarea value={m[k]} onChange={e => set(k, e.target.value)} placeholder={ph} style={{ minHeight: 56 }} />
        : <input type="text" value={m[k]} onChange={e => set(k, e.target.value)} placeholder={ph} />}
    </div>
  )

  return (
    <div>
      <div className="info-box" style={{ marginBottom: 14 }}>
        <strong>Audio format:</strong> Upload MP3, M4A, or WAV files only — not MP4 video.
        To convert: use VLC → Media → Convert/Save → Audio MP3, or use cloudconvert.com.
        Keep files under 4MB for best results (roughly 4 minutes of speech at normal quality).
      </div>
      <CollectorField value={collectedBy} onChange={setCollectedBy} />
      <div className="g2" style={{ gap: 12 }}>
        <F label="Speaker name / initials" k="speakerName" ph="e.g. Rashad A. (initials for privacy)" />
        <F label="Age / age group" k="speakerAge" ph="e.g. 22 or 18–25" />
        <F label="Neighbourhood in Baku" k="speakerNeighbourhood" ph="e.g. Yasamal, Sabail, Binagadi" />
        <F label="Education level" k="speakerEducation" ph="e.g. University student" />
        <F label="Languages spoken" k="speakerLangs" ph="e.g. Azerbaijani (native), Russian (fluent)" />
        <F label="Generation context" k="generationContext" ph="e.g. Post-independence, grew up with Latin script" />
        <F label="Recording context" k="recordingContext" ph="e.g. Casual WhatsApp voice note, in-person interview" />
        <div>
          <label className="field-label">Consent recorded on audio?</label>
          <div className="chips" style={{ marginTop: 4 }}>
            {['yes', 'no', 'written'].map(v => <button key={v} className={`chip ${m.consentRecorded === v ? 'on' : ''}`} onClick={() => set('consentRecorded', v)} style={{ textTransform: 'capitalize' }}>{v}</button>)}
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">Zone</label>
          <select value={m.zone} onChange={e => set('zone', e.target.value)}>{ZONES.map(z => <option key={z}>{z}</option>)}</select>
        </div>
      </div>
      <F label="Notes" k="notes" ph="What did you ask? What was the recording about?" multi />
      <CommentField value={m.comments} onChange={v => set('comments', v)} />

      <div style={{ border: '2px dashed var(--border2)', borderRadius: 'var(--r2)', padding: 20, textAlign: 'center', cursor: 'pointer', marginTop: 12, marginBottom: 12 }}
        onClick={() => fileRef.current?.click()}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>🎙</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Upload MP3 / M4A / WAV audio files</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Not MP4 — audio only · Multiple files OK · Under 4MB per file recommended</div>
        <input ref={fileRef} type="file" multiple accept=".mp3,.m4a,.wav,.ogg,.aac,audio/*" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      </div>

      {rejectedFiles.length > 0 && (
        <div className="warn-box" style={{ marginBottom: 10 }}>
          <strong>These files were skipped</strong> — please convert to MP3 first:<br />
          {rejectedFiles.map(f => <span key={f} style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 11, marginTop: 3 }}>✕ {f}</span>)}
        </div>
      )}

      {files.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
          <span>🎙</span>
          <span style={{ flex: 1, color: 'var(--text2)' }}>{f.name}</span>
          <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 11 }}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
          {f.size / 1024 / 1024 > 4 && <span style={{ color: 'var(--amber)', fontSize: 10 }}>⚠ large</span>}
          <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)' }} onClick={() => setFiles(p => p.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      {files.length > 0 && (
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
          disabled={saving} onClick={save}>
          {saving ? 'Saving…' : `Save ${files.length} native speaker recording${files.length !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  )
}

// ── YOUTUBE — caption paste approach ─────────────────────
function YouTubeUpload({ onUploaded }) {
  const [collectedBy, setCollectedBy] = useState(DEFAULT_COLLECTOR)
  const [inputMode, setInputMode] = useState('mp3') // 'mp3' | 'caption'
  const [entries, setEntries] = useState([{
    videoTitle: '', videoUrl: '', publishedDate: '', duration: '',
    lessonTopic: '', speakerName: 'Samantha Parker', speakerNativeLang: 'English',
    languageFocus: 'Azerbaijani', captionText: '', notes: '', comments: '',
    audioFile: null,
  }])
  const [saving, setSaving] = useState(false)
  const fileRefs = useRef([])

  const setEntry = (i, k, v) => setEntries(prev => prev.map((e, j) => j === i ? { ...e, [k]: v } : e))

  function handleAudio(i, fileList) {
    const file = Array.from(fileList).find(f =>
      /\.(mp3|m4a|wav|ogg|aac)$/i.test(f.name) || f.type?.startsWith('audio/')
    )
    if (!file) {
      alert('Please upload an MP3, M4A, or WAV file — not MP4. To convert: use cloudconvert.com or VLC.')
      return
    }
    setEntry(i, 'audioFile', file)
    if (!entries[i].videoTitle) setEntry(i, 'videoTitle', file.name.replace(/\.[^.]+$/, ''))
  }

  function addEntry_() {
    if (entries.length >= 5) return
    setEntries(prev => [...prev, {
      videoTitle: '', videoUrl: '', publishedDate: '', duration: '',
      lessonTopic: '', speakerName: 'Samantha Parker', speakerNativeLang: 'English',
      languageFocus: 'Azerbaijani', captionText: '', notes: '', comments: '', audioFile: null,
    }])
  }

  async function save() {
    const valid = entries.filter(e => e.audioFile || e.captionText?.trim())
    if (!valid.length) return
    setSaving(true)
    for (const e of valid) {
      const isAudio = !!e.audioFile
      await addEntry({
        sourceType: 'youtube',
        type: isAudio ? 'audio' : 'text',
        filename: e.audioFile?.name || e.videoTitle || 'YouTube video',
        blob: e.audioFile || null,
        rawText: e.captionText || null,
        collectedBy, zone: 'Other',
        yt_videoTitle: e.videoTitle,
        yt_videoUrl: e.videoUrl,
        yt_publishedDate: e.publishedDate,
        yt_duration: e.duration,
        yt_speakerName: e.speakerName,
        yt_speakerRole: 'instructor',
        yt_speakerNativeLang: e.speakerNativeLang,
        yt_languageFocus: e.languageFocus,
        yt_lessonTopic: e.lessonTopic,
        yt_permissionGrantedBy: 'Samantha Parker',
        yt_permissionDate: '2026-07-07',
        yt_permissionType: 'explicit_email',
        yt_channelName: 'Learn Azerbaijani Today',
        yt_channelUrl: 'https://youtube.com/@learnazerbaijanitoday',
        yt_licence: 'permission_granted_not_redistributed',
        yt_inputMode: isAudio ? 'mp3_audio' : 'caption_text',
        notes: e.notes, comments: { general: e.comments },
        source_type_label: 'YouTube — Learn Azerbaijani Today',
        source_description: isAudio
          ? 'Pedagogical Azerbaijani video — MP3 audio uploaded, permission granted'
          : 'Pedagogical Azerbaijani video — caption text analysed, permission granted',
        domain: 'Education', entryType: 'Pedagogical speech',
      })
    }
    setSaving(false)
    setEntries([{ videoTitle: '', videoUrl: '', publishedDate: '', duration: '', lessonTopic: '', speakerName: 'Samantha Parker', speakerNativeLang: 'English', languageFocus: 'Azerbaijani', captionText: '', notes: '', comments: '', audioFile: null }])
    onUploaded()
  }

  const readyCount = entries.filter(e => e.audioFile || e.captionText?.trim()).length

  return (
    <div>
      <div className="success-box" style={{ marginBottom: 12 }}>
        ✓ Permission granted — Samantha Parker, Learn Azerbaijani Today · 7 July 2026
      </div>

      {/* Input mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`chip ${inputMode === 'mp3' ? 'on' : ''}`} style={{ padding: '8px 18px', fontSize: 13 }}
          onClick={() => setInputMode('mp3')}>
          🎵 Upload MP3 audio
        </button>
        <button className={`chip ${inputMode === 'caption' ? 'on' : ''}`} style={{ padding: '8px 18px', fontSize: 13 }}
          onClick={() => setInputMode('caption')}>
          📄 Paste transcript
        </button>
        <div style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center', marginLeft: 4 }}>
          {inputMode === 'mp3' ? 'Best quality — AI transcribes the audio' : 'Faster — paste YouTube captions directly'}
        </div>
      </div>

      {/* MP3 how-to */}
      {inputMode === 'mp3' && (
        <div className="info-box" style={{ marginBottom: 14 }}>
          <strong>How to download as MP3:</strong><br />
          1. Go to the YouTube video → copy the URL<br />
          2. Go to <strong>yt1s.com</strong> or <strong>y2mate.com</strong> → paste URL → choose MP3 → Download<br />
          3. Upload the downloaded MP3 file below<br />
          <span style={{ color: 'var(--accent)', fontWeight: 500 }}>Keep under 10 minutes per file for best transcription results</span>
        </div>
      )}

      {/* Caption how-to */}
      {inputMode === 'caption' && (
        <div className="info-box" style={{ marginBottom: 14 }}>
          <strong>How to get YouTube captions:</strong><br />
          Open video → click <strong>⋯</strong> below video → <strong>Show transcript</strong> → copy all text → paste below.<br />
          Or use <strong>downsub.com</strong> — paste the video URL, download as .txt, paste contents.
        </div>
      )}

      <CollectorField value={collectedBy} onChange={setCollectedBy} />

      {entries.map((e, i) => (
        <div key={i} className="card card-pad" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              Video {i + 1}
              {e.audioFile && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--green)', fontWeight: 500 }}>✓ {e.audioFile.name} ({(e.audioFile.size/1024/1024).toFixed(1)} MB)</span>}
              {e.captionText && !e.audioFile && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--green)', fontWeight: 500 }}>✓ {e.captionText.split(/\s+/).filter(Boolean).length} words</span>}
            </div>
            {entries.length > 1 && (
              <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)' }}
                onClick={() => setEntries(prev => prev.filter((_, j) => j !== i))}>Remove</button>
            )}
          </div>

          {/* Video metadata */}
          <div className="g2" style={{ gap: 10, marginBottom: 12 }}>
            <div className="field-group">
              <label className="field-label">Video title</label>
              <input type="text" value={e.videoTitle} onChange={ev => setEntry(i, 'videoTitle', ev.target.value)} placeholder="e.g. Learn Azerbaijani — Places & Directions" />
            </div>
            <div className="field-group">
              <label className="field-label">YouTube URL</label>
              <input type="text" value={e.videoUrl} onChange={ev => setEntry(i, 'videoUrl', ev.target.value)} placeholder="https://youtube.com/watch?v=..." />
            </div>
            <div className="field-group">
              <label className="field-label">Published date</label>
              <input type="text" value={e.publishedDate} onChange={ev => setEntry(i, 'publishedDate', ev.target.value)} placeholder="e.g. 2024-03-15" />
            </div>
            <div className="field-group">
              <label className="field-label">Lesson topic</label>
              <input type="text" value={e.lessonTopic} onChange={ev => setEntry(i, 'lessonTopic', ev.target.value)} placeholder="e.g. Places and directions" />
            </div>
          </div>

          {/* MP3 upload */}
          {inputMode === 'mp3' && (
            <div>
              <input ref={el => fileRefs.current[i] = el} type="file"
                accept=".mp3,.m4a,.wav,.ogg,.aac,audio/*"
                style={{ display: 'none' }}
                onChange={ev => handleAudio(i, ev.target.files)} />
              {!e.audioFile ? (
                <div style={{ border: '2px dashed var(--border2)', borderRadius: 'var(--r2)', padding: 20, textAlign: 'center', cursor: 'pointer', marginBottom: 10 }}
                  onClick={() => fileRefs.current[i]?.click()}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>🎵</div>
                  <div style={{ fontWeight: 600, marginBottom: 3 }}>Upload MP3 audio file</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>MP3, M4A, WAV · Not MP4 · Click to browse</div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--green-light)', border: '1px solid var(--green-border)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>🎵</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{e.audioFile.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{(e.audioFile.size/1024/1024).toFixed(1)} MB · ready to process</div>
                  </div>
                  <button className="btn btn-ghost btn-xs" onClick={() => setEntry(i, 'audioFile', null)}>✕ Remove</button>
                </div>
              )}
              {/* Also allow caption as backup */}
              <div style={{ marginTop: 8 }}>
                <label className="field-label" style={{ color: 'var(--text3)' }}>Or paste transcript as backup (optional)</label>
                <textarea value={e.captionText} onChange={ev => setEntry(i, 'captionText', ev.target.value)}
                  placeholder="If you have the transcript handy, paste it here too — will be used if audio processing fails"
                  style={{ minHeight: 60, fontSize: 12 }} />
              </div>
            </div>
          )}

          {/* Caption paste */}
          {inputMode === 'caption' && (
            <div className="field-group">
              <label className="field-label">Caption / transcript text <span style={{ color: 'var(--red)' }}>*</span></label>
              <textarea value={e.captionText} onChange={ev => setEntry(i, 'captionText', ev.target.value)}
                placeholder="Paste YouTube transcript here. Timestamps are fine — AI ignores them.

Example:
0:00 Salam, bu dərs haqqında Places and Directions...
0:15 Today we will learn how to ask for directions in Azerbaijani.
0:28 Birinci, 'harada' means 'where'..."
                style={{ minHeight: 160, fontSize: 12 }} />
              {e.captionText && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {e.captionText.split(/\s+/).filter(Boolean).length} words · ready to process
                </div>
              )}
            </div>
          )}

          <div className="field-group">
            <label className="field-label">Notes — why this video? Any timestamps of linguistic interest?</label>
            <textarea value={e.notes} onChange={ev => setEntry(i, 'notes', ev.target.value)}
              placeholder="e.g. At 03:42 instructor uses likeləmək (morphological hybrid). At 05:10 switches to Russian for technical term."
              style={{ minHeight: 56 }} />
          </div>
          <CommentField value={e.comments} onChange={v => setEntry(i, 'comments', v)} />
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10 }}>
        {entries.length < 5 && (
          <button className="btn btn-ghost" onClick={addEntry_}>+ Add another video</button>
        )}
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
          disabled={saving || readyCount === 0} onClick={save}>
          {saving ? 'Saving…' : `Save ${readyCount} video${readyCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}


// ── MAIN ─────────────────────────────────────────────────
export default function UploadScreen({ onUploaded }) {
  const [tab, setTab] = useState('photo')
  const tabs = [
    { id: 'photo', icon: '📷', label: 'My photos', desc: 'Linguistic landscape photos from your field trip' },
    { id: 'native', icon: '🎙', label: 'Native speaker', desc: 'MP3 recordings from your Baku friend' },
    { id: 'youtube', icon: '🎬', label: 'YouTube', desc: 'Paste captions — permission granted ✓' },
  ]
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, minWidth: 160, padding: '12px 16px', border: `1px solid ${tab === t.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--r2)', background: tab === t.id ? 'var(--accent-light)' : 'var(--bg2)', cursor: 'pointer', textAlign: 'left', transition: 'all .12s' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: tab === t.id ? 'var(--accent)' : 'var(--text)', marginBottom: 2 }}>{t.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>{t.desc}</div>
          </button>
        ))}
      </div>
      {tab === 'photo' && <PhotoUpload onUploaded={onUploaded} />}
      {tab === 'native' && <NativeSpeakerUpload onUploaded={onUploaded} />}
      {tab === 'youtube' && <YouTubeUpload onUploaded={onUploaded} />}
    </div>
  )
}
