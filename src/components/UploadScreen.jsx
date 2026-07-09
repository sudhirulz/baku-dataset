import React, { useState, useRef, useCallback } from 'react'
import { addEntry } from '../lib/db.js'
import { extractEXIF, reverseGeocode, formatCoords, mapsUrl } from '../lib/exif.js'
import { ZONES, DEFAULT_COLLECTOR } from '../lib/constants.js'

const IMG = /\.(jpg|jpeg|png|webp|heic|heif)$/i
const AUD = /\.(mp3|mp4|m4a|wav|webm|ogg|aac)$/i

function makeThumb(blob) {
  return new Promise(res => {
    if (!blob.type?.startsWith('image/')) return res(null)
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas'); const s=400; const r=Math.min(s/img.width,s/img.height)
      c.width=img.width*r; c.height=img.height*r; c.getContext('2d').drawImage(img,0,0,c.width,c.height)
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg',.75))
    }
    img.onerror = () => { URL.revokeObjectURL(url); res(null) }
    img.src = url
  })
}

// Shared editable collector field
function CollectorField({ value, onChange }) {
  return (
    <div className="field-group">
      <label className="field-label">Collected by — editable</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="Your full name or initials" />
      <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>Default: {DEFAULT_COLLECTOR} — edit if needed</div>
    </div>
  )
}

// Comment field — available on every section
function CommentField({ label = 'Comments & extra info', value, onChange }) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        placeholder="Add any extra context, observations, or information here — this is a free field, add anything you want…"
        style={{ minHeight:60 }} />
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
  const [progress, setProgress] = useState({ current:0, total:0, file:'' })
  const [uploaded, setUploaded] = useState([])
  const fileRef = useRef(null)

  async function processFiles(files) {
    const valid = Array.from(files).filter(f => IMG.test(f.name)||f.type?.startsWith('image/'))
    if (!valid.length) return
    setProcessing(true); setProgress({ current:0, total:valid.length, file:'' })
    const added = []
    for (let i=0;i<valid.length;i++) {
      const file = valid[i]; setProgress({ current:i+1, total:valid.length, file:file.name })
      const [thumbUrl, exifData] = await Promise.all([makeThumb(file), extractEXIF(file)])
      let geo = null
      if (exifData?.lat&&exifData?.lon) geo = await reverseGeocode(exifData.lat, exifData.lon)
      let autoZone = zone
      if (geo?.city) { const cl=geo.city.toLowerCase(); const m=ZONES.find(z=>z.toLowerCase().includes(cl)||cl.includes(z.toLowerCase().split(' ')[0])); if(m) autoZone=m }
      await addEntry({ sourceType:'photo', type:'image', filename:file.name, blob:file, thumbUrl, exif:exifData, exif_source:exifData?'exif':null, geo, geo_source:geo?'geocode':null, zone:autoZone, zone_source:'researcher', collectedBy, comments:{ general:comments } })
      added.push(file.name)
    }
    setUploaded(prev => [...prev, ...added]); setProcessing(false); onUploaded()
  }

  const onDrop = useCallback(async e => { e.preventDefault(); setIsDragging(false); await processFiles(e.dataTransfer.files) }, [zone, collectedBy, comments])
  const pct = progress.total ? Math.round((progress.current/progress.total)*100) : 0

  return (
    <div>
      <div className="g2" style={{ gap:12, marginBottom:14 }}>
        <CollectorField value={collectedBy} onChange={setCollectedBy} />
        <div className="field-group">
          <label className="field-label">Default zone</label>
          <select value={zone} onChange={e => setZone(e.target.value)}>{ZONES.map(z=><option key={z}>{z}</option>)}</select>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>Auto-overridden by GPS if available</div>
        </div>
      </div>
      <CommentField label="Session comments & notes" value={comments} onChange={setComments} />
      <div onDrop={onDrop} onDragOver={e=>{e.preventDefault();setIsDragging(true)}} onDragLeave={()=>setIsDragging(false)}
        onClick={() => !processing && fileRef.current?.click()}
        style={{ border:`2px dashed ${isDragging?'var(--accent)':'var(--border2)'}`, borderRadius:'var(--r3)', background:isDragging?'var(--accent-light)':'var(--bg2)', padding:'32px 24px', textAlign:'center', cursor:processing?'default':'pointer', transition:'all .15s', marginBottom:12 }}>
        {processing ? (
          <div>
            <div style={{ fontWeight:600, marginBottom:8 }}>Processing {progress.current} of {progress.total}…</div>
            <div style={{ maxWidth:280, margin:'0 auto 6px' }}><div className="progress-track"><div className="progress-fill" style={{ width:`${pct}%` }} /></div></div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>{progress.file} — extracting EXIF + GPS</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize:36, marginBottom:8 }}>📷</div>
            <div style={{ fontWeight:600, marginBottom:4 }}>Drop your photos here</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10 }}>JPG, PNG, WEBP, HEIC · Drag whole folder · GPS + timestamp auto-extracted</div>
            <div className="info-box" style={{ maxWidth:440, margin:'0 auto', textAlign:'left' }}>
              <strong>From Google Photos:</strong> photos.google.com → select Baku photos → ⋮ Download → unzip → drag folder here
            </div>
          </>
        )}
        <input ref={fileRef} type="file" multiple accept="image/*" style={{ display:'none' }} onChange={e=>processFiles(e.target.files)} />
      </div>
      {uploaded.length > 0 && <div className="success-box">✓ {uploaded.length} photos uploaded. GPS and EXIF extracted automatically.</div>}
    </div>
  )
}

// ── NATIVE SPEAKER ───────────────────────────────────────
function NativeSpeakerUpload({ onUploaded }) {
  const [collectedBy, setCollectedBy] = useState(DEFAULT_COLLECTOR)
  const [m, setM] = useState({
    speakerName:'', speakerAge:'', speakerNeighbourhood:'', speakerEducation:'',
    speakerLangs:'Azerbaijani (native), Russian (fluent)', generationContext:'',
    recordingContext:'', consentRecorded:'yes', zone:ZONES[0],
    notes:'', comments:'',
  })
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const set = (k,v) => setM(p=>({...p,[k]:v}))

  async function save() {
    if (!files.length) return; setSaving(true)
    for (const file of files) {
      await addEntry({
        sourceType:'native_speaker', type:'audio', filename:file.name, blob:file,
        collectedBy, zone:m.zone,
        ns_speakerName:m.speakerName, ns_speakerAge:m.speakerAge,
        ns_speakerNeighbourhood:m.speakerNeighbourhood, ns_speakerEducation:m.speakerEducation,
        ns_speakerLangs:m.speakerLangs, ns_generationContext:m.generationContext,
        ns_recordingContext:m.recordingContext, ns_consentRecorded:m.consentRecorded,
        notes:m.notes, comments:{ general:m.comments },
        source_type_label:'Native speaker recording',
        source_description:'Spontaneous/elicited speech from native Baku Azerbaijani speaker',
        domain:'Spontaneous speech', entryType:'Spontaneous speech',
      })
    }
    setSaving(false); setFiles([]); onUploaded()
  }

  const F = ({ label, k, ph, multi }) => (
    <div className="field-group">
      <label className="field-label">{label}</label>
      {multi ? <textarea value={m[k]} onChange={e=>set(k,e.target.value)} placeholder={ph} style={{ minHeight:56 }} />
             : <input type="text" value={m[k]} onChange={e=>set(k,e.target.value)} placeholder={ph} />}
    </div>
  )

  return (
    <div>
      <div className="info-box" style={{ marginBottom:14 }}>For recordings from your Baku friend. Fill in speaker details — all fields editable, add comments anywhere.</div>
      <CollectorField value={collectedBy} onChange={setCollectedBy} />
      <div className="g2" style={{ gap:12 }}>
        <F label="Speaker name / initials" k="speakerName" ph="e.g. Rashad A. (use initials for privacy)" />
        <F label="Age / age group" k="speakerAge" ph="e.g. 22 or 18–25" />
        <F label="Neighbourhood in Baku" k="speakerNeighbourhood" ph="e.g. Yasamal, Sabail, Binagadi" />
        <F label="Education level" k="speakerEducation" ph="e.g. University student, Bachelor's" />
        <F label="Languages spoken" k="speakerLangs" ph="e.g. Azerbaijani (native), Russian (fluent), English (intermediate)" />
        <F label="Generation context" k="generationContext" ph="e.g. Post-independence generation, grew up with Latin script Azerbaijani" />
        <F label="Recording context" k="recordingContext" ph="e.g. Casual WhatsApp voice note, In-person interview at home" />
        <div>
          <label className="field-label">Consent recorded on audio?</label>
          <div className="chips" style={{ marginTop:4 }}>
            {['yes','no','written'].map(v=><button key={v} className={`chip ${m.consentRecorded===v?'on':''}`} onClick={()=>set('consentRecorded',v)} style={{ textTransform:'capitalize' }}>{v}</button>)}
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">Zone</label>
          <select value={m.zone} onChange={e=>set('zone',e.target.value)}>{ZONES.map(z=><option key={z}>{z}</option>)}</select>
        </div>
      </div>
      <F label="Notes" k="notes" ph="What did you ask? What was the recording about? Any notable moments?" multi />
      <CommentField value={m.comments} onChange={v=>set('comments',v)} />

      <div style={{ border:'2px dashed var(--border2)', borderRadius:'var(--r2)', padding:20, textAlign:'center', cursor:'pointer', marginTop:12, marginBottom:12 }}
        onClick={()=>fileRef.current?.click()}>
        <div style={{ fontSize:28, marginBottom:6 }}>🎙</div>
        <div style={{ fontWeight:600, marginBottom:4 }}>Upload audio / video files</div>
        <div style={{ fontSize:12, color:'var(--text3)' }}>MP3, MP4, M4A, WAV · Multiple files OK</div>
        <input ref={fileRef} type="file" multiple accept="audio/*,video/*" style={{ display:'none' }} onChange={e=>setFiles(prev=>[...prev,...Array.from(e.target.files)])} />
      </div>
      {files.map((f,i)=>(
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
          <span>🎙</span><span style={{ flex:1, color:'var(--text2)' }}>{f.name}</span>
          <span style={{ color:'var(--text3)' }}>{(f.size/1024/1024).toFixed(1)} MB</span>
          <button className="btn btn-ghost btn-xs" style={{ color:'var(--red)' }} onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))}>✕</button>
        </div>
      ))}
      {files.length > 0 && <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:10 }} disabled={saving} onClick={save}>
        {saving?'Saving…':`Save ${files.length} native speaker recording${files.length!==1?'s':''}`}
      </button>}
    </div>
  )
}

// ── YOUTUBE ──────────────────────────────────────────────
function YouTubeUpload({ onUploaded }) {
  const [collectedBy, setCollectedBy] = useState(DEFAULT_COLLECTOR)
  const [m, setM] = useState({
    videoTitle:'', videoUrl:'', publishedDate:'', duration:'',
    speakerName:'Samantha Parker', speakerRole:'instructor',
    speakerNativeLang:'English', languageFocus:'Azerbaijani', lessonTopic:'',
    permissionGrantedBy:'Samantha Parker', permissionDate:'2026-07-07',
    permissionType:'explicit_email',
    channelName:'Learn Azerbaijani Today',
    channelUrl:'https://youtube.com/@learnazerbaijanitoday',
    licence:'permission_granted_not_redistributed',
    notes:'', comments:'',
  })
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const set = (k,v) => setM(p=>({...p,[k]:v}))

  async function save() {
    if (!files.length) return; setSaving(true)
    for (const file of files) {
      await addEntry({
        sourceType:'youtube', type:'audio', filename:file.name, blob:file,
        collectedBy, zone:'Other',
        yt_videoTitle:m.videoTitle||file.name, yt_videoUrl:m.videoUrl,
        yt_publishedDate:m.publishedDate, yt_duration:m.duration,
        yt_speakerName:m.speakerName, yt_speakerRole:m.speakerRole,
        yt_speakerNativeLang:m.speakerNativeLang, yt_languageFocus:m.languageFocus,
        yt_lessonTopic:m.lessonTopic, yt_permissionGrantedBy:m.permissionGrantedBy,
        yt_permissionDate:m.permissionDate, yt_permissionType:m.permissionType,
        yt_channelName:m.channelName, yt_channelUrl:m.channelUrl, yt_licence:m.licence,
        notes:m.notes, comments:{ general:m.comments },
        source_type_label:'YouTube — Learn Azerbaijani Today',
        source_description:'Pedagogical Azerbaijani instruction video, explicit permission granted',
        domain:'Education', entryType:'Pedagogical speech',
      })
    }
    setSaving(false); setFiles([]); onUploaded()
  }

  const F = ({ label, k, ph }) => (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <input type="text" value={m[k]} onChange={e=>set(k,e.target.value)} placeholder={ph} />
    </div>
  )

  return (
    <div>
      <div className="success-box" style={{ marginBottom:12 }}>✓ Permission granted — Samantha Parker, Learn Azerbaijani Today · 7 July 2026</div>
      <div className="info-box" style={{ marginBottom:14 }}>Download the video as MP3 from YouTube, then upload here. All fields editable — add comments anywhere.</div>
      <CollectorField value={collectedBy} onChange={setCollectedBy} />

      <div style={{ fontWeight:600, fontSize:12, color:'var(--text2)', marginBottom:8 }}>Video details — look up on YouTube page</div>
      <div className="g2" style={{ gap:12 }}>
        <F label="Video title" k="videoTitle" ph="e.g. Learn Azerbaijani — Lesson 12: Shopping" />
        <F label="YouTube URL" k="videoUrl" ph="https://youtube.com/watch?v=..." />
        <F label="Published date" k="publishedDate" ph="e.g. 2024-03-15" />
        <F label="Duration" k="duration" ph="e.g. 08:24" />
        <F label="Lesson topic" k="lessonTopic" ph="e.g. Shopping vocabulary, greetings" />
        <F label="Language focus" k="languageFocus" ph="Azerbaijani" />
      </div>
      <div className="divider" />

      <div style={{ fontWeight:600, fontSize:12, color:'var(--text2)', marginBottom:8 }}>Speaker</div>
      <div className="g2" style={{ gap:12 }}>
        <F label="Speaker name" k="speakerName" ph="e.g. Samantha Parker" />
        <F label="Speaker native language" k="speakerNativeLang" ph="e.g. English" />
        <div className="field-group">
          <label className="field-label">Speaker role</label>
          <div className="chips" style={{ marginTop:4 }}>
            {['instructor','guest','student','native_speaker'].map(v=>(
              <button key={v} className={`chip ${m.speakerRole===v?'on':''}`} onClick={()=>set('speakerRole',v)} style={{ textTransform:'capitalize' }}>{v.replace('_',' ')}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="divider" />

      <div style={{ fontWeight:600, fontSize:12, color:'var(--text2)', marginBottom:8 }}>Permission & licence — pre-filled, editable</div>
      <div className="g2" style={{ gap:12 }}>
        <F label="Channel name" k="channelName" ph="Learn Azerbaijani Today" />
        <F label="Channel URL" k="channelUrl" ph="https://youtube.com/@learnazerbaijanitoday" />
        <F label="Permission granted by" k="permissionGrantedBy" ph="Samantha Parker" />
        <F label="Permission date" k="permissionDate" ph="2026-07-07" />
        <F label="Licence" k="licence" ph="permission_granted_not_redistributed" />
      </div>

      <div className="field-group">
        <label className="field-label">Notes — why did you choose this video? Timestamps of interest?</label>
        <textarea value={m.notes} onChange={e=>set('notes',e.target.value)} placeholder="e.g. Chose this for its coverage of market vocabulary. At 03:42 instructor uses likeləmək — a morphological hybrid. At 05:10 switches to Russian for technical term." style={{ minHeight:70 }} />
      </div>
      <CommentField value={m.comments} onChange={v=>set('comments',v)} />

      <div style={{ border:'2px dashed var(--border2)', borderRadius:'var(--r2)', padding:20, textAlign:'center', cursor:'pointer', marginTop:4, marginBottom:12 }}
        onClick={()=>fileRef.current?.click()}>
        <div style={{ fontSize:28, marginBottom:6 }}>🎬</div>
        <div style={{ fontWeight:600, marginBottom:4 }}>Upload downloaded video / audio</div>
        <div style={{ fontSize:12, color:'var(--text3)' }}>MP3, MP4, M4A · Up to 5 videos recommended</div>
        <input ref={fileRef} type="file" multiple accept="audio/*,video/*" style={{ display:'none' }} onChange={e=>setFiles(prev=>[...prev,...Array.from(e.target.files)])} />
      </div>
      {files.map((f,i)=>(
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
          <span>🎬</span><span style={{ flex:1, color:'var(--text2)' }}>{f.name}</span>
          <span style={{ color:'var(--text3)' }}>{(f.size/1024/1024).toFixed(1)} MB</span>
          <button className="btn btn-ghost btn-xs" style={{ color:'var(--red)' }} onClick={()=>setFiles(p=>p.filter((_,j)=>j!==i))}>✕</button>
        </div>
      ))}
      {files.length > 0 && <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:10 }} disabled={saving} onClick={save}>
        {saving?'Saving…':`Save ${files.length} YouTube video${files.length!==1?'s':''}`}
      </button>}
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────
export default function UploadScreen({ onUploaded }) {
  const [tab, setTab] = useState('photo')
  const tabs = [
    { id:'photo', icon:'📷', label:'My photos', desc:'Linguistic landscape photos from your field trip' },
    { id:'native', icon:'🎙', label:'Native speaker', desc:'Recordings from your Baku friend' },
    { id:'youtube', icon:'🎬', label:'YouTube', desc:'Learn Azerbaijani Today — permission granted ✓' },
  ]
  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ flex:1, minWidth:160, padding:'12px 16px', border:`1px solid ${tab===t.id?'var(--accent)':'var(--border)'}`, borderRadius:'var(--r2)', background:tab===t.id?'var(--accent-light)':'var(--bg2)', cursor:'pointer', textAlign:'left', transition:'all .12s' }}>
            <div style={{ fontSize:22, marginBottom:4 }}>{t.icon}</div>
            <div style={{ fontWeight:600, fontSize:13, color:tab===t.id?'var(--accent)':'var(--text)', marginBottom:2 }}>{t.label}</div>
            <div style={{ fontSize:11, color:'var(--text3)', lineHeight:1.4 }}>{t.desc}</div>
          </button>
        ))}
      </div>
      {tab==='photo' && <PhotoUpload onUploaded={onUploaded} />}
      {tab==='native' && <NativeSpeakerUpload onUploaded={onUploaded} />}
      {tab==='youtube' && <YouTubeUpload onUploaded={onUploaded} />}
    </div>
  )
}
