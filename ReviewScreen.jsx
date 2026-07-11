import React, { useState, useEffect } from 'react'
import { getAllEntries, updateEntry, getHistory, updateFieldComment, addCustomField, removeCustomField } from '../lib/db.js'
import { formatCoords, mapsUrl } from '../lib/exif.js'
import { ZONES, DOMAINS, ENTRY_TYPES, SWITCH_TYPES, SWITCH_TRIGGERS, LANGUAGES, SCRIPTS, SOURCE_TYPES, DEFAULT_COLLECTOR } from '../lib/constants.js'

function SourceTag({ source }) {
  const m = { exif:{ label:'🛰 EXIF', bg:'var(--green-light)', color:'var(--green)', border:'1px solid var(--green-border)' }, ai:{ label:'🤖 AI', bg:'var(--accent-light)', color:'var(--accent)', border:'1px solid var(--accent-border)' }, researcher:{ label:'✏️ You', bg:'var(--purple-light)', color:'var(--purple)', border:'1px solid var(--purple-border)' }, geocode:{ label:'🗺 Geocoded', bg:'var(--amber-light)', color:'var(--amber)', border:'1px solid var(--amber-border)' } }
  const s = m[source]; if (!s) return null
  return <span className="src-badge" style={{ background:s.bg, color:s.color, border:s.border, fontSize:9, marginLeft:4 }}>{s.label}</span>
}

function EditField({ label, value, source, originalAI, onChange, mono, multiline, comment, onCommentChange, placeholder='' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value||'')
  const [showComment, setShowComment] = useState(!!comment)
  const [commentDraft, setCommentDraft] = useState(comment||'')

  return (
    <div style={{ marginBottom:12, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'10px 12px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, flexWrap:'wrap' }}>
        <span className="field-label" style={{ marginBottom:0 }}>{label}</span>
        <SourceTag source={source} />
        {source==='researcher'&&originalAI&&originalAI!==value&&<span style={{ fontSize:9, color:'var(--text3)' }}>AI: <em>{String(originalAI).slice(0,30)}…</em></span>}
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          <button className="btn btn-ghost btn-xs" style={{ color:'var(--amber)' }} onClick={()=>setShowComment(s=>!s)}>💬</button>
          <button className="btn btn-ghost btn-xs" onClick={()=>{ setEditing(e=>!e); setDraft(value||'') }}>{editing?'Cancel':'✏️'}</button>
        </div>
      </div>
      {editing ? (
        <div>
          {multiline ? <textarea value={draft} onChange={e=>setDraft(e.target.value)} autoFocus style={{ minHeight:72 }} placeholder={placeholder} />
                     : <input type="text" value={draft} onChange={e=>setDraft(e.target.value)} autoFocus placeholder={placeholder} onKeyDown={e=>{ if(e.key==='Enter'){ onChange(draft); setEditing(false) }}} />}
          <div style={{ display:'flex', gap:6, marginTop:6 }}>
            <button className="btn btn-sm btn-primary" onClick={()=>{ onChange(draft); setEditing(false) }}>Save</button>
            {originalAI&&<button className="btn btn-sm btn-ghost" onClick={()=>{ onChange(originalAI); setEditing(false) }}>Restore AI</button>}
          </div>
        </div>
      ) : (
        <div className={mono?'mono-block':''} style={!mono?{ fontSize:13, color:value?'var(--text)':'var(--text3)', fontStyle:value?'normal':'italic', lineHeight:1.6 }:{}}>
          {value||(placeholder||'Not set')}
        </div>
      )}
      {showComment && (
        <div style={{ marginTop:6 }}>
          <textarea value={commentDraft} onChange={e=>setCommentDraft(e.target.value)}
            onBlur={()=>onCommentChange&&onCommentChange(commentDraft)}
            placeholder="Your comment or extra info about this field — free text, add anything…"
            style={{ minHeight:44, background:'var(--amber-light)', borderColor:'var(--amber-border)', fontSize:11, color:'var(--amber)' }} />
        </div>
      )}
      {comment&&!showComment&&<div className="comment-box">💬 {comment}</div>}
    </div>
  )
}

function ChipEdit({ label, options, selected, onChange, source, isMulti=true, comment, onCommentChange }) {
  const [showComment, setShowComment] = useState(!!comment)
  const [commentDraft, setCommentDraft] = useState(comment||'')
  const toggle = v => isMulti ? onChange(selected.includes(v)?selected.filter(x=>x!==v):[...selected,v]) : onChange(selected===v?'':v)
  const isOn = v => isMulti ? selected.includes(v) : selected===v

  return (
    <div style={{ marginBottom:12, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'10px 12px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:8 }}>
        <span className="field-label" style={{ marginBottom:0 }}>{label}</span>
        <SourceTag source={source} />
        <button className="btn btn-ghost btn-xs" style={{ marginLeft:'auto', color:'var(--amber)' }} onClick={()=>setShowComment(s=>!s)}>💬</button>
      </div>
      <div className="chips">
        {options.map(opt=>{ const val=typeof opt==='object'?opt.name:opt; return <button key={val} className={`chip ${isOn(val)?'on':''}`} onClick={()=>toggle(val)}>{val}</button> })}
      </div>
      {showComment && (
        <textarea value={commentDraft} onChange={e=>setCommentDraft(e.target.value)}
          onBlur={()=>onCommentChange&&onCommentChange(commentDraft)}
          placeholder="Your comment about this tag…"
          style={{ marginTop:8, minHeight:44, background:'var(--amber-light)', borderColor:'var(--amber-border)', fontSize:11, color:'var(--amber)' }} />
      )}
      {comment&&!showComment&&<div className="comment-box">💬 {comment}</div>}
    </div>
  )
}

function CustomFields({ entryId, customFields={}, onUpdate }) {
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')
  const [newComment, setNewComment] = useState('')
  const [adding, setAdding] = useState(false)

  async function add() {
    if (!newKey.trim()) return
    await addCustomField(entryId, newKey.trim(), newVal, newComment)
    onUpdate(); setNewKey(''); setNewVal(''); setNewComment(''); setAdding(false)
  }

  async function remove(key) {
    await removeCustomField(entryId, key); onUpdate()
  }

  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div className="field-label" style={{ marginBottom:0 }}>Custom fields — add anything</div>
        <button className="btn btn-ghost btn-xs" onClick={()=>setAdding(a=>!a)}>+ Add field</button>
      </div>
      {Object.entries(customFields).map(([k,v])=>(
        <div key={k} style={{ background:'var(--teal-light)', border:'1px solid var(--teal-border)', borderRadius:'var(--r)', padding:'8px 12px', marginBottom:6 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--teal)', textTransform:'uppercase', letterSpacing:'.06em' }}>{k}</span>
            <button className="btn btn-ghost btn-xs" style={{ color:'var(--red)' }} onClick={()=>remove(k)}>✕</button>
          </div>
          <div style={{ fontSize:13, color:'var(--text)' }}>{v.value}</div>
          {v.comment && <div style={{ fontSize:11, color:'var(--teal)', marginTop:4, fontStyle:'italic' }}>💬 {v.comment}</div>}
          <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>{new Date(v.addedAt).toLocaleDateString()}</div>
        </div>
      ))}
      {adding && (
        <div style={{ background:'var(--teal-light)', border:'1px solid var(--teal-border)', borderRadius:'var(--r)', padding:'12px' }}>
          <div className="field-group"><label className="field-label">Field name</label><input type="text" value={newKey} onChange={e=>setNewKey(e.target.value)} placeholder="e.g. audience_type, historical_note, follow_up_needed" /></div>
          <div className="field-group"><label className="field-label">Value</label><textarea value={newVal} onChange={e=>setNewVal(e.target.value)} placeholder="Enter value…" style={{ minHeight:56 }} /></div>
          <div className="field-group"><label className="field-label">Comment (optional)</label><input type="text" value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Any extra context…" /></div>
          <div style={{ display:'flex', gap:6 }}>
            <button className="btn btn-sm btn-primary" onClick={add}>Add</button>
            <button className="btn btn-sm btn-ghost" onClick={()=>setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function EntryEditor({ entry: initialEntry, onSave, onClose }) {
  const [entry, setEntryState] = useState(initialEntry)
  const [comments, setCommentsState] = useState(initialEntry.comments||{})
  const [collectedBy, setCollectedBy] = useState(initialEntry.collectedBy||DEFAULT_COLLECTOR)
  const [ocrText, setOcr] = useState(initialEntry.ocrText||'')
  const [transcription, setTx] = useState(initialEntry.transcription||'')
  const [translation, setTr] = useState(initialEntry.translation?.en||'')
  const [translit, setTl] = useState(initialEntry.transliteration||'')
  const [notes, setNotes] = useState(initialEntry.notes||'')
  const [linguisticNotes, setLingNotes] = useState(initialEntry.linguisticNotes||'')
  const [domain, setDomain] = useState(initialEntry.domain||'')
  const [entryType, setEntryType] = useState(initialEntry.entryType||'')
  const [switchType, setSwitchType] = useState(initialEntry.switchType||'')
  const [switchTrigger, setSwitchTrigger] = useState(initialEntry.switchTrigger||'')
  const [zone, setZone] = useState(initialEntry.zone||'')
  const [langs, setLangs] = useState(initialEntry.languageNames||initialEntry.detectedLanguages||[])
  const [scripts, setScripts] = useState(initialEntry.scripts||[])
  const [history, setHistory] = useState([])
  const [saving, setSaving] = useState(false)
  const [customFields, setCustomFields] = useState(initialEntry.customFields||{})

  useEffect(() => { getHistory(initialEntry.id).then(setHistory) }, [initialEntry.id])

  function setComment(field, value) {
    const updated = { ...comments, [field]:value }
    setCommentsState(updated)
    updateFieldComment(initialEntry.id, field, value)
  }

  async function save() {
    setSaving(true)
    await updateEntry(initialEntry.id, {
      collectedBy, ocrText, transcription, translation:{ en:translation },
      transliteration:translit, notes, linguisticNotes,
      domain, entryType, switchType, switchTrigger, zone,
      languageNames:langs, detectedLanguages:langs, scripts,
      comments, status:'done',
    }, 'researcher')
    setSaving(false); onSave()
  }

  async function refreshCustomFields() {
    const { getEntry } = await import('../lib/db.js')
    const fresh = await getEntry(initialEntry.id)
    if (fresh) setCustomFields(fresh.customFields||{})
  }

  const exif = initialEntry.exif||{}; const geo = initialEntry.geo||{}
  const isPhoto = initialEntry.sourceType==='photo'
  const isAudio = initialEntry.sourceType==='native_speaker'||initialEntry.sourceType==='youtube'
  const srcInfo = SOURCE_TYPES[initialEntry.sourceType]||SOURCE_TYPES.photo

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:300, padding:20, overflowY:'auto' }} onClick={onClose}>
      <div style={{ background:'var(--bg)', borderRadius:'var(--r3)', width:'100%', maxWidth:940, overflow:'hidden' }} onClick={e=>e.stopPropagation()}>

        <div style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)', padding:'12px 20px', display:'flex', alignItems:'center', gap:10, position:'sticky', top:0, zIndex:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>{initialEntry.filename}</div>
              <span className="src-badge" style={{ background:srcInfo.bg, color:srcInfo.color, border:`1px solid ${srcInfo.border}`, fontSize:10 }}>{srcInfo.icon} {srcInfo.label}</span>
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{initialEntry.zone} · {collectedBy}</div>
          </div>
          <button className="btn btn-green" onClick={save} disabled={saving}>{saving?'Saving…':'Save all changes'}</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:0 }}>

          {/* Left — provenance */}
          <div style={{ padding:16, borderRight:'1px solid var(--border)', background:'var(--bg3)', maxHeight:'85vh', overflowY:'auto' }}>
            {initialEntry.thumbUrl && <img src={initialEntry.thumbUrl} alt="" style={{ width:'100%', borderRadius:'var(--r)', border:'1px solid var(--border)', marginBottom:12 }} />}
            {!initialEntry.thumbUrl && initialEntry.sourceType && (
              <div style={{ height:80, background:'var(--bg4)', borderRadius:'var(--r)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, marginBottom:12 }}>
                {initialEntry.sourceType==='youtube'?'🎬':initialEntry.sourceType==='native_speaker'?'🎙':'📄'}
              </div>
            )}

            <div style={{ fontWeight:700, fontSize:11, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>Provenance</div>

            {/* Photo provenance */}
            {[
              { label:'File', value:initialEntry.filename, source:'exif' },
              { label:'Captured', value:exif.datetime?.replace(/^(\d{4}):(\d{2}):(\d{2}) /,'$1-$2-$3 '), source:'exif' },
              { label:'Camera', value:[exif.make,exif.model].filter(Boolean).join(' ')||null, source:'exif' },
              { label:'GPS', value:exif.lat?formatCoords(exif.lat,exif.lon):null, href:exif.lat?mapsUrl(exif.lat,exif.lon):null, source:'exif' },
              { label:'Altitude', value:exif.altitude?`${exif.altitude}m`:null, source:'exif' },
              { label:'Country', value:geo.country, source:'geocode' },
              { label:'City', value:geo.city, source:'geocode' },
              { label:'District', value:geo.district, source:'geocode' },
              { label:'Street', value:geo.street, source:'geocode' },
            ].filter(r=>r.value).map(row=>(
              <div key={row.label} style={{ display:'flex', gap:6, marginBottom:5, fontSize:11, alignItems:'flex-start' }}>
                <span style={{ color:'var(--text3)', width:60, flexShrink:0 }}>{row.label}</span>
                {row.href ? <a href={row.href} target="_blank" rel="noreferrer" style={{ color:'var(--accent)', fontFamily:'var(--mono)', fontSize:10, flex:1 }}>{row.value}</a>
                : <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text)', flex:1, wordBreak:'break-word' }}>{row.value}</span>}
                <SourceTag source={row.source} />
              </div>
            ))}

            {/* YouTube provenance */}
            {initialEntry.sourceType==='youtube' && [
              { label:'Video', value:initialEntry.yt_videoTitle },
              { label:'URL', value:initialEntry.yt_videoUrl, href:initialEntry.yt_videoUrl },
              { label:'Published', value:initialEntry.yt_publishedDate },
              { label:'Speaker', value:initialEntry.yt_speakerName },
              { label:'Role', value:initialEntry.yt_speakerRole },
              { label:'Channel', value:initialEntry.yt_channelName },
              { label:'Permission', value:`${initialEntry.yt_permissionGrantedBy}, ${initialEntry.yt_permissionDate}` },
              { label:'Licence', value:initialEntry.yt_licence },
            ].filter(r=>r.value).map(row=>(
              <div key={row.label} style={{ display:'flex', gap:6, marginBottom:5, fontSize:11 }}>
                <span style={{ color:'var(--text3)', width:60, flexShrink:0 }}>{row.label}</span>
                {row.href ? <a href={row.href} target="_blank" rel="noreferrer" style={{ color:'var(--accent)', fontSize:10, flex:1 }}>{row.value}</a>
                : <span style={{ fontSize:10, color:'var(--text)', flex:1, wordBreak:'break-word' }}>{row.value}</span>}
              </div>
            ))}

            {/* Native speaker provenance */}
            {initialEntry.sourceType==='native_speaker' && [
              { label:'Speaker', value:initialEntry.ns_speakerName },
              { label:'Age', value:initialEntry.ns_speakerAge },
              { label:'Area', value:initialEntry.ns_speakerNeighbourhood },
              { label:'Education', value:initialEntry.ns_speakerEducation },
              { label:'Languages', value:initialEntry.ns_speakerLangs },
              { label:'Generation', value:initialEntry.ns_generationContext },
              { label:'Context', value:initialEntry.ns_recordingContext },
              { label:'Consent', value:initialEntry.ns_consentRecorded },
            ].filter(r=>r.value).map(row=>(
              <div key={row.label} style={{ display:'flex', gap:6, marginBottom:5, fontSize:11 }}>
                <span style={{ color:'var(--text3)', width:60, flexShrink:0 }}>{row.label}</span>
                <span style={{ fontSize:10, color:'var(--text)', flex:1, wordBreak:'break-word' }}>{row.value}</span>
              </div>
            ))}

            {/* Edit history */}
            {history.length > 0 && (
              <div style={{ marginTop:14 }}>
                <div style={{ fontWeight:700, fontSize:11, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>Edit history ({history.length})</div>
                {history.slice(-6).reverse().map((h,i)=>(
                  <div key={i} style={{ fontSize:10, color:'var(--text2)', padding:'4px 0', borderBottom:'1px solid var(--border)' }}>
                    <strong>{h.field}</strong>
                    <div style={{ color:'var(--text3)', marginTop:1 }}>{new Date(h.changedAt).toLocaleString('en-GB',{ hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' })} · {h.source}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right — editable fields */}
          <div style={{ padding:16, maxHeight:'85vh', overflowY:'auto' }}>
            <div style={{ background:'var(--amber-light)', border:'1px solid var(--amber-border)', borderRadius:'var(--r)', padding:'10px 12px', marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--amber)', marginBottom:6 }}>⚠ Researcher identity</div>
              <EditField label="Collected by" value={collectedBy} source="researcher" originalAI={null} onChange={setCollectedBy} placeholder={DEFAULT_COLLECTOR} comment={comments.collectedBy} onCommentChange={v=>setComment('collectedBy',v)} />
            </div>

            <div style={{ fontWeight:700, fontSize:11, letterSpacing:'.08em', textTransform:'uppercase', color:'var(--text3)', marginBottom:12 }}>
              AI results — every field editable · 💬 click to add comment on any field
            </div>

            {isPhoto && <EditField label="OCR text" value={ocrText} source={initialEntry.ocrText_source||'ai'} originalAI={initialEntry.ocrText} onChange={setOcr} mono multiline comment={comments.ocrText} onCommentChange={v=>setComment('ocrText',v)} />}
            {isAudio && <EditField label="Transcription" value={transcription} source={initialEntry.transcription_source||'ai'} originalAI={initialEntry.transcription} onChange={setTx} mono multiline comment={comments.transcription} onCommentChange={v=>setComment('transcription',v)} />}
            <EditField label="English translation" value={translation} source={initialEntry.translation_source||'ai'} originalAI={initialEntry.translation?.en} onChange={setTr} multiline comment={comments.translation_en} onCommentChange={v=>setComment('translation_en',v)} />
            <EditField label="Transliteration (Latin)" value={translit} source={initialEntry.transliteration_source||'ai'} originalAI={initialEntry.transliteration} onChange={setTl} mono multiline comment={comments.transliteration} onCommentChange={v=>setComment('transliteration',v)} />

            <ChipEdit label="Languages detected" options={LANGUAGES} selected={langs} onChange={setLangs} source={initialEntry.detectedLanguages_source||'ai'} comment={comments.languages} onCommentChange={v=>setComment('languages',v)} />
            <ChipEdit label="Scripts" options={SCRIPTS} selected={scripts} onChange={setScripts} source={initialEntry.scripts_source||'ai'} comment={comments.scripts} onCommentChange={v=>setComment('scripts',v)} />
            <ChipEdit label="Domain" options={DOMAINS} selected={domain} onChange={setDomain} source={initialEntry.domain_source||'ai'} isMulti={false} comment={comments.domain} onCommentChange={v=>setComment('domain',v)} />
            <ChipEdit label="Entry type" options={ENTRY_TYPES} selected={entryType} onChange={setEntryType} source={initialEntry.entryType_source||'ai'} isMulti={false} comment={comments.entryType} onCommentChange={v=>setComment('entryType',v)} />
            <ChipEdit label="Code-switching type" options={SWITCH_TYPES} selected={switchType} onChange={setSwitchType} source={initialEntry.switchType_source||'ai'} isMulti={false} comment={comments.switchType} onCommentChange={v=>setComment('switchType',v)} />
            <ChipEdit label="Switch trigger" options={SWITCH_TRIGGERS} selected={switchTrigger} onChange={setSwitchTrigger} source={initialEntry.switchTrigger_source||'ai'} isMulti={false} comment={comments.switchTrigger} onCommentChange={v=>setComment('switchTrigger',v)} />
            <ChipEdit label="Zone" options={ZONES} selected={zone} onChange={setZone} source={initialEntry.zone_source||'researcher'} isMulti={false} comment={comments.zone} onCommentChange={v=>setComment('zone',v)} />

            <EditField label="Linguistic notes (AI)" value={linguisticNotes} source={initialEntry.linguisticNotes_source||'ai'} originalAI={initialEntry.linguisticNotes} onChange={setLingNotes} multiline comment={comments.linguisticNotes} onCommentChange={v=>setComment('linguisticNotes',v)} />
            <EditField label="Researcher notes — your observations" value={notes} source={initialEntry.notes_source||'researcher'} originalAI={null} onChange={setNotes} multiline placeholder="Why did you photograph this? What struck you? Any context the AI wouldn't know…" comment={comments.notes} onCommentChange={v=>setComment('notes',v)} />

            <div className="divider" />
            <CustomFields entryId={initialEntry.id} customFields={customFields} onUpdate={refreshCustomFields} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ReviewScreen({ tick, onEdited }) {
  const [entries, setEntries] = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [filterLang, setFilterLang] = useState('all')
  const [filterSwitch, setFilterSwitch] = useState('all')

  useEffect(() => { getAllEntries().then(setEntries) }, [tick])

  const allLangs = [...new Set(entries.flatMap(e=>e.languageNames||e.detectedLanguages||[]))]
  const unclaimed = entries.filter(e=>!e.collectedBy||e.collectedBy==='Unknown').length

  const filtered = entries.filter(e => {
    const text = [e.ocrText,e.transcription,e.translation?.en,e.notes,e.filename,e.zone,e.collectedBy].join(' ').toLowerCase()
    return (!search||text.includes(search.toLowerCase()))
      && (filterStatus==='all'||e.status===filterStatus)
      && (filterSource==='all'||e.sourceType===filterSource)
      && (filterLang==='all'||(e.languageNames||e.detectedLanguages||[]).includes(filterLang))
      && (filterSwitch==='all'||(filterSwitch==='yes'?e.hasCodeSwitching:!e.hasCodeSwitching))
  })

  async function handleSave() { setEntries(await getAllEntries()); setSelected(null); onEdited() }

  async function setAllCollectors() {
    if (!confirm(`Set "Sudarshan Manikantan" as collector on all ${unclaimed} entries that are missing a name?`)) return
    const { updateEntry } = await import('../lib/db.js')
    const missing = entries.filter(e => !e.collectedBy || e.collectedBy === 'Unknown' || e.collectedBy === '')
    for (const e of missing) {
      await updateEntry(e.id, { collectedBy: 'Sudarshan Manikantan' }, 'researcher')
    }
    setEntries(await getAllEntries())
    onEdited()
  }

  return (
    <div>
      {unclaimed > 0 && (
        <div className="warn-box" style={{ marginBottom:14, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div style={{ flex:1 }}><strong>{unclaimed} entries</strong> have no collector name set.</div>
          <button className="btn btn-sm" style={{ background:'var(--amber)', color:'#fff', border:'none', fontWeight:600, flexShrink:0 }}
            onClick={setAllCollectors}>
            Set all to "Sudarshan Manikantan"
          </button>
        </div>
      )}

      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search text, filename, translation…" style={{ width:250 }} />
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ width:'auto' }}>
          <option value="all">All statuses</option>
          {['uploaded','processing','ocr_done','done','failed'].map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={filterSource} onChange={e=>setFilterSource(e.target.value)} style={{ width:'auto' }}>
          <option value="all">All sources</option>
          <option value="photo">📷 Photos</option>
          <option value="native_speaker">🎙 Native speaker</option>
          <option value="youtube">🎬 YouTube</option>
        </select>
        <select value={filterLang} onChange={e=>setFilterLang(e.target.value)} style={{ width:'auto' }}>
          <option value="all">All languages</option>
          {allLangs.map(l=><option key={l}>{l}</option>)}
        </select>
        <select value={filterSwitch} onChange={e=>setFilterSwitch(e.target.value)} style={{ width:'auto' }}>
          <option value="all">All entries</option>
          <option value="yes">Code-switching only</option>
          <option value="no">No switching</option>
        </select>
        <span style={{ fontSize:12, color:'var(--text3)', marginLeft:'auto' }}>{filtered.length} of {entries.length}</span>
      </div>

      {filtered.length===0 ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text3)', fontSize:13 }}>
          {entries.length===0?'No entries yet. Upload and process files first.':'No entries match this filter.'}
        </div>
      ) : (
        <div className="card scroll-x">
          <table className="tbl">
            <thead><tr>
              <th style={{ width:60 }}></th><th>File</th><th>Source</th><th>Collector</th><th>Date & GPS</th><th>Text</th><th>Languages</th><th>Domain</th><th>Switch</th><th>Status</th>
            </tr></thead>
            <tbody>
              {filtered.map(e => {
                const exif=e.exif||{}; const geo=e.geo||{}
                const src=SOURCE_TYPES[e.sourceType]||SOURCE_TYPES.photo
                const missingCollector=!e.collectedBy||e.collectedBy==='Unknown'
                return (
                  <tr key={e.id} className="clickable" onClick={()=>setSelected(e)}>
                    <td>{e.thumbUrl?<img src={e.thumbUrl} alt="" style={{ width:44,height:44,objectFit:'cover',borderRadius:4,border:'1px solid var(--border)' }} />:<div style={{ width:44,height:44,background:'var(--bg3)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>{src.icon}</div>}</td>
                    <td><div style={{ fontWeight:500,fontSize:12,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{e.filename}</div><div style={{ fontSize:11,color:'var(--text3)' }}>{e.zone?.split(' ').slice(0,2).join(' ')}</div></td>
                    <td><span className="src-badge" style={{ background:src.bg,color:src.color,border:`1px solid ${src.border}`,fontSize:10 }}>{src.icon} {src.label}</span></td>
                    <td>{missingCollector?<span style={{ fontSize:11,color:'var(--red)',fontWeight:600 }}>⚠ Not set</span>:<span style={{ fontSize:11,color:'var(--green)',fontWeight:500 }}>✓ {e.collectedBy}</span>}</td>
                    <td>
                      {exif.datetime&&<div style={{ fontSize:10,fontFamily:'var(--mono)',color:'var(--text2)' }}>{exif.datetime.replace(/^(\d{4}):(\d{2}):(\d{2}) /,'$1-$2-$3 ')}</div>}
                      {exif.lat&&<a href={mapsUrl(exif.lat,exif.lon)} target="_blank" rel="noreferrer" onClick={ev=>ev.stopPropagation()} style={{ fontSize:10,color:'var(--accent)' }}>📍 {formatCoords(exif.lat,exif.lon)}</a>}
                      {geo.city&&<div style={{ fontSize:10,color:'var(--text3)' }}>{geo.city}</div>}
                    </td>
                    <td><div style={{ fontFamily:'var(--mono)',fontSize:11,maxWidth:170,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--text2)' }}>{e.ocrText||e.transcription||'—'}</div>{e.translation?.en&&<div style={{ fontSize:10,color:'var(--text3)',marginTop:2,maxWidth:170,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{e.translation.en}</div>}</td>
                    <td><div style={{ fontSize:11,color:'var(--accent)',fontWeight:500 }}>{(e.languageNames||e.detectedLanguages||[]).slice(0,3).join(' · ')||'—'}</div>{e.hasCodeSwitching&&<div style={{ fontSize:10,color:'var(--amber)',fontWeight:600 }}>⇄ switching</div>}</td>
                    <td style={{ fontSize:11,color:'var(--text2)' }}>{e.domain||'—'}</td>
                    <td style={{ fontSize:10,color:'var(--text2)',maxWidth:110 }}>{e.switchType||'—'}</td>
                    <td><span className={`status-badge s-${e.status}`}>{e.status?.replace('_',' ')}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {selected&&<EntryEditor entry={selected} onSave={handleSave} onClose={()=>setSelected(null)} />}
    </div>
  )
}
