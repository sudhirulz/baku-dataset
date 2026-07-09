import React, { useState, useEffect } from 'react'
import { getAllEntries, getWords, saveWords, updateWord } from '../lib/db.js'
import { analyseWords } from '../lib/api.js'
import { INTEGRATION_CLASSES } from '../lib/constants.js'

const IC_COLORS = {
  native: { bg:'var(--green-light)', color:'var(--green)', border:'var(--green-border)' },
  established_loanword: { bg:'var(--teal-light)', color:'var(--teal)', border:'var(--teal-border)' },
  recent_borrowing: { bg:'var(--accent-light)', color:'var(--accent)', border:'var(--accent-border)' },
  morphological_hybrid: { bg:'var(--amber-light)', color:'var(--amber)', border:'var(--amber-border)' },
  code_switch: { bg:'var(--red-light)', color:'var(--red)', border:'var(--red-border)' },
  calque: { bg:'var(--purple-light)', color:'var(--purple)', border:'var(--purple-border)' },
  proper_noun: { bg:'var(--bg3)', color:'var(--text2)', border:'var(--border)' },
  unknown: { bg:'var(--bg3)', color:'var(--text3)', border:'var(--border)' },
}

function ICBadge({ cls }) {
  const c = IC_COLORS[cls] || IC_COLORS.unknown
  return <span className="src-badge" style={{ background:c.bg, color:c.color, border:`1px solid ${c.border}` }}>{cls?.replace(/_/g,' ')}</span>
}

// Editable word field with inline comment
function WordField({ label, value, onChange, mono, multiline, comment, onCommentChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const [showComment, setShowComment] = useState(!!comment)
  const [commentDraft, setCommentDraft] = useState(comment || '')

  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3 }}>
        <span className="field-label" style={{ marginBottom:0 }}>{label}</span>
        <button className="btn btn-ghost btn-xs" onClick={()=>{ setEditing(e=>!e); setDraft(value||'') }}>{editing?'Cancel':'✏️'}</button>
        <button className="btn btn-ghost btn-xs" style={{ color:'var(--amber)' }} onClick={()=>setShowComment(s=>!s)}>
          {showComment?'Hide comment':'+ Comment'}
        </button>
      </div>
      {editing ? (
        <div>
          {multiline
            ? <textarea value={draft} onChange={e=>setDraft(e.target.value)} style={{ minHeight:56 }} autoFocus />
            : <input type="text" value={draft} onChange={e=>setDraft(e.target.value)} autoFocus onKeyDown={e=>{ if(e.key==='Enter'){ onChange(draft); setEditing(false) }}} />
          }
          <button className="btn btn-sm btn-primary" style={{ marginTop:5 }} onClick={()=>{ onChange(draft); setEditing(false) }}>Save</button>
        </div>
      ) : (
        <div className={mono?'mono-block':''} style={!mono?{ fontSize:13, color:value?'var(--text)':'var(--text3)', fontStyle:value?'normal':'italic' }:{}}>
          {value || 'Not set'}
        </div>
      )}
      {showComment && (
        <div style={{ marginTop:5 }}>
          <textarea value={commentDraft} onChange={e=>setCommentDraft(e.target.value)}
            onBlur={()=>onCommentChange(commentDraft)}
            placeholder="Add your comment or extra info about this field…"
            style={{ minHeight:44, background:'var(--amber-light)', borderColor:'var(--amber-border)', fontSize:11, color:'var(--amber)' }} />
        </div>
      )}
      {comment && !showComment && <div className="comment-box">💬 {comment}</div>}
    </div>
  )
}

function WordEditor({ word, onSave, onClose }) {
  const [w, setW] = useState({ ...word })
  const [comments, setComments] = useState(word.comments || {})
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setW(p=>({...p,[k]:v}))
  const setComment = (k,v) => setComments(p=>({...p,[k]:v}))

  async function save() {
    setSaving(true)
    await updateWord(word.id, { ...w, comments })
    setSaving(false); onSave({ ...w, comments })
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:300, padding:20, overflowY:'auto' }}
      onClick={onClose}>
      <div style={{ background:'var(--bg)', borderRadius:'var(--r3)', width:'100%', maxWidth:700, overflow:'hidden' }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ background:'var(--bg2)', borderBottom:'1px solid var(--border)', padding:'12px 20px', display:'flex', alignItems:'center', gap:10, position:'sticky', top:0 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:16, fontWeight:600 }}>{word.word}</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}><ICBadge cls={word.integrationClass} /></div>
          </div>
          <button className="btn btn-green" onClick={save} disabled={saving}>{saving?'Saving…':'Save'}</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding:20, display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <WordField label="Word form" value={w.word} onChange={v=>set('word',v)} mono comment={comments.word} onCommentChange={v=>setComment('word',v)} />
            <WordField label="Script" value={w.script} onChange={v=>set('script',v)} comment={comments.script} onCommentChange={v=>setComment('script',v)} />
            <WordField label="Language" value={w.languageName} onChange={v=>set('languageName',v)} comment={comments.languageName} onCommentChange={v=>setComment('languageName',v)} />
            <WordField label="Root / stem" value={w.root} onChange={v=>set('root',v)} mono comment={comments.root} onCommentChange={v=>setComment('root',v)} />
            <WordField label="Root language" value={w.rootLanguage} onChange={v=>set('rootLanguage',v)} comment={comments.rootLanguage} onCommentChange={v=>setComment('rootLanguage',v)} />
            <WordField label="Language family" value={w.rootLanguageFamily} onChange={v=>set('rootLanguageFamily',v)} comment={comments.rootLanguageFamily} onCommentChange={v=>setComment('rootLanguageFamily',v)} />
            <WordField label="Prefix" value={w.prefix} onChange={v=>set('prefix',v)} mono comment={comments.prefix} onCommentChange={v=>setComment('prefix',v)} />
            <WordField label="Suffix" value={w.suffix} onChange={v=>set('suffix',v)} mono comment={comments.suffix} onCommentChange={v=>setComment('suffix',v)} />
            <div style={{ marginBottom:8 }}>
              <div className="field-label" style={{ marginBottom:5 }}>Integration class</div>
              <div className="chips">
                {INTEGRATION_CLASSES.map(c=>(
                  <button key={c} className={`chip ${w.integrationClass===c?'on':''}`} onClick={()=>set('integrationClass',c)} style={{ fontSize:10 }}>{c.replace(/_/g,' ')}</button>
                ))}
              </div>
            </div>
            <WordField label="Part of speech" value={w.pos} onChange={v=>set('pos',v)} comment={comments.pos} onCommentChange={v=>setComment('pos',v)} />
            <WordField label="Lemma (base form)" value={w.lemma} onChange={v=>set('lemma',v)} mono comment={comments.lemma} onCommentChange={v=>setComment('lemma',v)} />
          </div>
          <div>
            <WordField label="Dictionary meaning (English)" value={w.meaning_en} onChange={v=>set('meaning_en',v)} multiline comment={comments.meaning_en} onCommentChange={v=>setComment('meaning_en',v)} />
            <WordField label="Contextual meaning (in this sign/text)" value={w.meaning_contextual} onChange={v=>set('meaning_contextual',v)} multiline comment={comments.meaning_contextual} onCommentChange={v=>setComment('meaning_contextual',v)} />
            <WordField label="Meaning shift from source language" value={w.meaningShift} onChange={v=>set('meaningShift',v)} multiline comment={comments.meaningShift} onCommentChange={v=>setComment('meaningShift',v)} />
            <WordField label="Etymology" value={w.etymology} onChange={v=>set('etymology',v)} multiline comment={comments.etymology} onCommentChange={v=>setComment('etymology',v)} />
            <WordField label="Semantic field" value={w.semanticField} onChange={v=>set('semanticField',v)} comment={comments.semanticField} onCommentChange={v=>setComment('semanticField',v)} />
            <WordField label="Connotation" value={w.connotation} onChange={v=>set('connotation',v)} comment={comments.connotation} onCommentChange={v=>setComment('connotation',v)} />
            <WordField label="Register" value={w.register} onChange={v=>set('register',v)} comment={comments.register} onCommentChange={v=>setComment('register',v)} />
            <WordField label="Notes & observations" value={w.notes} onChange={v=>set('notes',v)} multiline comment={comments.notes} onCommentChange={v=>setComment('notes',v)} />
            <div style={{ marginTop:8 }}>
              <div className="field-label" style={{ marginBottom:4 }}>Your comments — free field</div>
              <textarea value={w.researcherComment||''} onChange={e=>set('researcherComment',e.target.value)}
                placeholder="Add any extra observations, questions, or context about this word — anything goes…"
                style={{ minHeight:70, background:'var(--amber-light)', borderColor:'var(--amber-border)', fontSize:12, color:'var(--amber)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WordScreen({ tick, onDone, hasKey }) {
  const [entries, setEntries] = useState([])
  const [allWords, setAllWords] = useState([])
  const [selected, setSelected] = useState(null)
  const [analysing, setAnalysing] = useState(null)
  const [search, setSearch] = useState('')
  const [filterIC, setFilterIC] = useState('all')
  const [filterLang, setFilterLang] = useState('all')
  const [view, setView] = useState('byEntry') // byEntry | lexicon

  useEffect(() => {
    getAllEntries().then(e => setEntries(e.filter(e=>e.status==='done'||e.status==='ocr_done')))
    loadAllWords()
  }, [tick])

  async function loadAllWords() {
    const { getAllWords } = await import('../lib/db.js')
    setAllWords(await getAllWords())
  }

  async function runWordAnalysis(entry) {
    if (!hasKey) return
    setAnalysing(entry.id)
    const text = entry.ocrText || entry.transcription || ''
    if (!text.trim()) { setAnalysing(null); return }
    const words = await analyseWords(text, entry.sourceType, entry.zone)
    await saveWords(entry.id, words)
    await loadAllWords()
    setAnalysing(null); onDone()
  }

  async function runAllWordAnalysis() {
    for (const entry of entries) {
      const existing = allWords.filter(w=>w.entryId===entry.id)
      if (existing.length === 0) await runWordAnalysis(entry)
    }
  }

  const entriesWithWords = entries.map(e => ({ ...e, wordCount: allWords.filter(w=>w.entryId===e.id).length }))
  const allLangs = [...new Set(allWords.map(w=>w.languageName).filter(Boolean))]
  const filteredWords = allWords.filter(w => {
    const text = [w.word,w.meaning_en,w.etymology,w.root,w.languageName].join(' ').toLowerCase()
    return (!search||text.includes(search.toLowerCase()))
      && (filterIC==='all'||w.integrationClass===filterIC)
      && (filterLang==='all'||w.languageName===filterLang)
  })

  // Lexicon — deduplicated
  const lexicon = {}
  allWords.forEach(w => {
    const key = w.lemma||w.word
    if (!lexicon[key]) lexicon[key] = { ...w, frequency:1 }
    else lexicon[key].frequency++
  })
  const lexiconEntries = Object.values(lexicon).sort((a,b)=>b.frequency-a.frequency)

  return (
    <div>
      {/* Header */}
      <div className="card card-pad" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <div className="g4" style={{ flex:1, gap:10 }}>
            <div className="stat"><div className="stat-num">{entries.length}</div><div className="stat-label">Entries ready</div></div>
            <div className="stat"><div className="stat-num" style={{ color:'var(--accent)' }}>{allWords.length}</div><div className="stat-label">Words analysed</div></div>
            <div className="stat"><div className="stat-num" style={{ color:'var(--amber)' }}>{Object.keys(lexicon).length}</div><div className="stat-label">Unique words</div></div>
            <div className="stat"><div className="stat-num" style={{ color:'var(--purple)' }}>{allWords.filter(w=>w.integrationClass==='morphological_hybrid').length}</div><div className="stat-label">Hybrids found</div></div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {!hasKey && <div className="warn-box" style={{ fontSize:11 }}>Set API key to run word analysis</div>}
            <button className="btn btn-primary" disabled={!hasKey||entries.length===0} onClick={runAllWordAnalysis}>
              Analyse all unprocessed entries
            </button>
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        <button className={`chip ${view==='byEntry'?'on':''}`} onClick={()=>setView('byEntry')}>By entry</button>
        <button className={`chip ${view==='lexicon'?'on':''}`} onClick={()=>setView('lexicon')}>Lexicon (deduplicated)</button>
        <button className={`chip ${view==='words'?'on':''}`} onClick={()=>setView('words')}>All words</button>
      </div>

      {/* BY ENTRY */}
      {view==='byEntry' && (
        <div>
          {entriesWithWords.map(e => (
            <div key={e.id} className="card" style={{ marginBottom:8, padding:'12px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                {e.thumbUrl && <img src={e.thumbUrl} alt="" style={{ width:48, height:48, objectFit:'cover', borderRadius:'var(--r)', border:'1px solid var(--border)' }} />}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:500, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.filename}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{e.wordCount} words analysed · {e.zone}</div>
                  {e.wordCount > 0 && (
                    <div className="chips" style={{ marginTop:5 }}>
                      {allWords.filter(w=>w.entryId===e.id).slice(0,6).map(w=>(
                        <span key={w.id} className="chip" style={{ fontSize:10, fontFamily:'var(--mono)' }}>{w.word}</span>
                      ))}
                      {allWords.filter(w=>w.entryId===e.id).length > 6 && <span style={{ fontSize:10, color:'var(--text3)' }}>+{allWords.filter(w=>w.entryId===e.id).length-6} more</span>}
                    </div>
                  )}
                </div>
                <button className="btn btn-sm btn-primary" disabled={!hasKey||analysing===e.id}
                  onClick={()=>runWordAnalysis(e)}>
                  {analysing===e.id?<><div className="spinner" />Analysing…</>:e.wordCount>0?'↻ Re-analyse':'▶ Analyse words'}
                </button>
              </div>
            </div>
          ))}
          {entries.length===0 && <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text3)' }}>No processed entries yet. Go to ② Process first.</div>}
        </div>
      )}

      {/* LEXICON */}
      {view==='lexicon' && (
        <div>
          <div style={{ fontSize:12, color:'var(--text2)', marginBottom:12 }}>{lexiconEntries.length} unique words across your dataset, sorted by frequency</div>
          <div className="card scroll-x">
            <table className="tbl">
              <thead><tr>
                <th>Word</th><th>Freq</th><th>Language</th><th>Integration class</th><th>Root</th><th>Meaning</th><th>Etymology</th>
              </tr></thead>
              <tbody>
                {lexiconEntries.map((w,i) => (
                  <tr key={i} className="clickable" onClick={()=>setSelected(w)}>
                    <td><span style={{ fontFamily:'var(--mono)', fontWeight:500 }}>{w.word}</span></td>
                    <td><span style={{ fontFamily:'var(--mono)', fontSize:12, background:'var(--bg3)', padding:'1px 6px', borderRadius:4 }}>{w.frequency}</span></td>
                    <td style={{ fontSize:12 }}>{w.languageName||'—'}</td>
                    <td><ICBadge cls={w.integrationClass} /></td>
                    <td style={{ fontFamily:'var(--mono)', fontSize:11 }}>{w.root||'—'}</td>
                    <td style={{ fontSize:11, color:'var(--text2)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.meaning_en||'—'}</td>
                    <td style={{ fontSize:11, color:'var(--text2)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.etymology||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ALL WORDS */}
      {view==='words' && (
        <div>
          <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap' }}>
            <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search words, meanings, etymology…" style={{ width:240 }} />
            <select value={filterIC} onChange={e=>setFilterIC(e.target.value)} style={{ width:'auto' }}>
              <option value="all">All classes</option>
              {INTEGRATION_CLASSES.map(c=><option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
            </select>
            <select value={filterLang} onChange={e=>setFilterLang(e.target.value)} style={{ width:'auto' }}>
              <option value="all">All languages</option>
              {allLangs.map(l=><option key={l}>{l}</option>)}
            </select>
            <span style={{ fontSize:12, color:'var(--text3)', alignSelf:'center' }}>{filteredWords.length} words</span>
          </div>
          <div className="card scroll-x">
            <table className="tbl">
              <thead><tr>
                <th>Word</th><th>Language</th><th>Script</th><th>Integration</th><th>Meaning</th><th>Root</th><th>POS</th>
              </tr></thead>
              <tbody>
                {filteredWords.map(w=>(
                  <tr key={w.id} className="clickable" onClick={()=>setSelected(w)}>
                    <td><span style={{ fontFamily:'var(--mono)', fontWeight:500 }}>{w.word}</span></td>
                    <td style={{ fontSize:12 }}>{w.languageName||'—'}</td>
                    <td style={{ fontSize:12 }}>{w.script||'—'}</td>
                    <td><ICBadge cls={w.integrationClass} /></td>
                    <td style={{ fontSize:11, color:'var(--text2)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.meaning_en||'—'}</td>
                    <td style={{ fontFamily:'var(--mono)', fontSize:11 }}>{w.root||'—'}</td>
                    <td style={{ fontSize:11 }}>{w.pos||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <WordEditor word={selected} onSave={updated=>{ setAllWords(prev=>prev.map(w=>w.id===updated.id?updated:w)); setSelected(null) }} onClose={()=>setSelected(null)} />
      )}
    </div>
  )
}
