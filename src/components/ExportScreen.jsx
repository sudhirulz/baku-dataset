import React, { useState, useEffect } from 'react'
import { getAllEntries, getAllWords, exportEntriesJSONL, exportWordsJSONL, exportEntriesCSV, exportWordsCSV } from '../lib/db.js'

function dl(name, content, mime) {
  const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(new Blob([content],{type:mime})), download:name })
  a.click(); URL.revokeObjectURL(a.href)
}

function Bar({ label, n, max, color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
      <span style={{ width:150, fontSize:12, color:'var(--text2)', flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
      <div style={{ flex:1, height:6, background:'var(--bg3)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:3, background:color||'var(--accent)', width:`${max?(n/max)*100:0}%`, transition:'width .4s' }} />
      </div>
      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)', width:24, textAlign:'right' }}>{n}</span>
    </div>
  )
}

export default function ExportScreen({ tick }) {
  const [entries, setEntries] = useState([])
  const [words, setWords] = useState([])
  const today = new Date().toISOString().slice(0,10)

  useEffect(() => {
    getAllEntries().then(setEntries)
    getAllWords().then(setWords)
  }, [tick])

  const done = entries.filter(e=>e.status==='done'||e.status==='ocr_done')
  const withSwitch = done.filter(e=>e.hasCodeSwitching)
  const withGPS = done.filter(e=>e.exif?.lat)
  const allLangs = [...new Set(done.flatMap(e=>e.detectedLanguages||[]))]
  const langFreq = {}; done.forEach(e=>(e.languageNames||e.detectedLanguages||[]).forEach(l=>{ langFreq[l]=(langFreq[l]||0)+1 }))
  const domainFreq = {}; done.forEach(e=>{ if(e.domain) domainFreq[e.domain]=(domainFreq[e.domain]||0)+1 })
  const zoneFreq = {}; done.forEach(e=>{ if(e.zone) zoneFreq[e.zone]=(zoneFreq[e.zone]||0)+1 })
  const icFreq = {}; words.forEach(w=>{ if(w.integrationClass) icFreq[w.integrationClass]=(icFreq[w.integrationClass]||0)+1 })
  const topLangs = Object.entries(langFreq).sort((a,b)=>b[1]-a[1])
  const topDomains = Object.entries(domainFreq).sort((a,b)=>b[1]-a[1])
  const topZones = Object.entries(zoneFreq).sort((a,b)=>b[1]-a[1])
  const topIC = Object.entries(icFreq).sort((a,b)=>b[1]-a[1])
  const sources = { photo:done.filter(e=>e.sourceType==='photo').length, native_speaker:done.filter(e=>e.sourceType==='native_speaker').length, youtube:done.filter(e=>e.sourceType==='youtube').length }

  const datasetCard = `---
language:
${allLangs.map(l=>`- ${l}`).join('\n')||'- az'}
license: cc-by-4.0
task_categories:
- text-classification
- token-classification
pretty_name: "Baku Comix: Urban Multilingual Signage & Speech Dataset"
size_categories:
- ${done.length < 100 ? 'n<1K' : '1K<n<10K'}
tags:
- linguistics
- code-switching
- linguistic-landscape
- azerbaijani
- post-soviet
- multilingual
- caucasus
---

# Baku Comix Dataset

A linguistic landscape and spoken language dataset documenting multilingual signage and
speech in Baku, Azerbaijan and surrounding regions (Guba, Gabala, Khinaliq, Shamakhi).
Collected during field research in summer 2026.

## Research context

This dataset documents code-switching and language contact phenomena in post-Soviet urban
Azerbaijan, with particular focus on the mixing of Azerbaijani, Russian, English, and minority
languages (Lezgi, Talysh, Khinaliq, Udi, Tsakhur) in commercial signage, public announcements,
and spontaneous speech.

## Dataset statistics

- **Total entries:** ${done.length}
- **Photos (linguistic landscape):** ${sources.photo}
- **Native speaker recordings:** ${sources.native_speaker}
- **YouTube pedagogical recordings:** ${sources.youtube}
- **With GPS coordinates:** ${withGPS.length} (${done.length?Math.round(withGPS.length/done.length*100):0}%)
- **With code-switching:** ${withSwitch.length} (${done.length?Math.round(withSwitch.length/done.length*100):0}%)
- **Words analysed:** ${words.length}
- **Languages documented:** ${allLangs.join(', ')||'Azerbaijani, Russian, English'}
- **Collection date:** ${today}
- **Collector:** Sudarshan Manikantan

## Sources

1. **Linguistic landscape photos** — photographed by researcher in Baku and surrounding regions.
   EXIF metadata (GPS, timestamps, camera model) preserved for all entries.

2. **Native speaker recordings** — spontaneous and elicited speech from native Baku Azerbaijani
   speaker. Consent recorded. Speaker metadata anonymised.

3. **YouTube pedagogical data** — Learn Azerbaijani Today (youtube.com/@learnazerbaijanitoday).
   Permission granted by Samantha Parker, 7 July 2026. Audio not redistributed;
   transcriptions and annotations included only.

## Data files

- \`entries.jsonl\` — one entry per line (photos, audio sources)
- \`words.jsonl\` — one word per line (deep linguistic analysis)

## Key data fields

### Entry level
| Field | Source | Description |
|-------|--------|-------------|
| sourceType | Researcher | photo / native_speaker / youtube |
| collectedBy | Researcher | Collector name |
| exif_datetime | EXIF | Camera timestamp |
| exif_lat, exif_lon | EXIF | GPS coordinates |
| ocrText | AI (Claude) | Verbatim OCR |
| transcription | AI (Claude) | Audio transcription with language tags |
| translation_en | AI (Claude) | English translation |
| detectedLanguages | AI + Researcher | ISO language codes |
| hasCodeSwitching | AI + Researcher | Boolean |
| switchType | AI + Researcher | Type of code-switching |
| comments | Researcher | Field-level comments |
| customFields | Researcher | Researcher-added custom annotations |

### Word level
| Field | Description |
|-------|-------------|
| word | Exact form as it appears |
| language | Language code |
| root, prefix, suffix | Morphological decomposition |
| integrationClass | native / established_loanword / recent_borrowing / morphological_hybrid / code_switch / calque |
| meaning_en | Dictionary meaning |
| meaning_contextual | Meaning in this specific text |
| meaningShift | Semantic change from source language |
| etymology | Historical origin |

## Citation

\`\`\`bibtex
@dataset{baku_comix_${today.slice(0,4)},
  title={Baku Comix: Urban Multilingual Signage and Speech Dataset},
  author={Manikantan, Sudarshan},
  year={${today.slice(0,4)}},
  publisher={Hugging Face},
  url={https://huggingface.co/datasets/sudhirulz/baku-comix},
  license={cc-by-4.0},
  note={Field research conducted in Baku, Azerbaijan, summer 2026}
}
\`\`\`

## Ethical statement

All photographs taken in public spaces. No personally identifiable information included.
Speaker data from audio recordings is anonymised. YouTube data used with explicit written
permission. Dataset released under CC BY 4.0.
`

  return (
    <div>
      {/* Stats */}
      <div className="g4" style={{ marginBottom:20, gap:12 }}>
        <div className="stat"><div className="stat-num">{done.length}</div><div className="stat-label">Processed entries</div></div>
        <div className="stat"><div className="stat-num" style={{ color:'var(--accent)' }}>{withSwitch.length}</div><div className="stat-label">Code-switching</div></div>
        <div className="stat"><div className="stat-num" style={{ color:'var(--green)' }}>{words.length}</div><div className="stat-label">Words analysed</div></div>
        <div className="stat"><div className="stat-num" style={{ color:'var(--purple)' }}>{withGPS.length}</div><div className="stat-label">GPS tagged</div></div>
      </div>

      <div className="g2" style={{ gap:16, marginBottom:20 }}>
        <div className="card card-pad"><div className="card-title">Language frequency</div>{topLangs.map(([l,n])=><Bar key={l} label={l} n={n} max={topLangs[0]?.[1]} color="var(--accent)" />)}</div>
        <div className="card card-pad"><div className="card-title">Domain breakdown</div>{topDomains.map(([d,n])=><Bar key={d} label={d} n={n} max={topDomains[0]?.[1]} color="var(--green)" />)}</div>
        <div className="card card-pad"><div className="card-title">Zone coverage</div>{topZones.map(([z,n])=><Bar key={z} label={z} n={n} max={topZones[0]?.[1]} color="var(--teal)" />)}</div>
        {words.length > 0 && <div className="card card-pad"><div className="card-title">Integration classes</div>{topIC.map(([c,n])=><Bar key={c} label={c.replace(/_/g,' ')} n={n} max={topIC[0]?.[1]} color="var(--purple)" />)}</div>}
      </div>

      {/* Source breakdown */}
      <div className="card card-pad" style={{ marginBottom:16 }}>
        <div className="card-title">Source breakdown</div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          {[['📷 Photos',sources.photo,'var(--green)'],['🎙 Native speaker',sources.native_speaker,'var(--purple)'],['🎬 YouTube',sources.youtube,'var(--red)']].map(([l,n,c])=>(
            <div key={l} style={{ background:'var(--bg3)', borderRadius:'var(--r)', padding:'12px 16px', minWidth:120 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:22, fontWeight:700, color:c }}>{n}</div>
              <div style={{ fontSize:11, color:'var(--text2)', marginTop:4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="card card-pad" style={{ marginBottom:16 }}>
        <div className="card-title">Download dataset</div>
        <div style={{ fontSize:13, color:'var(--text2)', marginBottom:14, lineHeight:1.6 }}>
          Two dataset files — entry-level (one row per photo/audio) and word-level (one row per word).
          JSON-L is Hugging Face compatible. CSV is for Excel, R, Python pandas.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div style={{ background:'var(--bg3)', borderRadius:'var(--r)', padding:'14px' }}>
            <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>Entry-level dataset</div>
            <div style={{ fontSize:12, color:'var(--text2)', marginBottom:10 }}>{done.length} entries · photos + audio sources</div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary btn-sm" disabled={done.length===0} onClick={async()=>dl(`baku-comix-entries-${today}.jsonl`,await exportEntriesJSONL(),'application/jsonlines')}>JSON-L</button>
              <button className="btn btn-sm" disabled={done.length===0} onClick={async()=>dl(`baku-comix-entries-${today}.csv`,await exportEntriesCSV(),'text/csv')}>CSV</button>
            </div>
          </div>
          <div style={{ background:'var(--bg3)', borderRadius:'var(--r)', padding:'14px' }}>
            <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>Word-level dataset</div>
            <div style={{ fontSize:12, color:'var(--text2)', marginBottom:10 }}>{words.length} words · deep linguistic analysis</div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary btn-sm" disabled={words.length===0} onClick={async()=>dl(`baku-comix-words-${today}.jsonl`,await exportWordsJSONL(),'application/jsonlines')}>JSON-L</button>
              <button className="btn btn-sm" disabled={words.length===0} onClick={async()=>dl(`baku-comix-words-${today}.csv`,await exportWordsCSV(),'text/csv')}>CSV</button>
            </div>
          </div>
        </div>
      </div>

      {/* Dataset card */}
      <div className="card card-pad">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div>
            <div className="card-title" style={{ marginBottom:2 }}>Hugging Face dataset card</div>
            <div style={{ fontSize:12, color:'var(--text2)' }}>Paste this as README.md when publishing to Hugging Face</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-sm" onClick={()=>{ navigator.clipboard.writeText(datasetCard); alert('Copied!') }}>Copy</button>
            <button className="btn btn-sm" onClick={()=>dl(`README-${today}.md`,datasetCard,'text/markdown')}>Download .md</button>
          </div>
        </div>
        <pre style={{ fontFamily:'var(--mono)', fontSize:11, background:'var(--bg3)', padding:14, borderRadius:'var(--r)', overflow:'auto', lineHeight:1.65, whiteSpace:'pre-wrap', maxHeight:400 }}>{datasetCard}</pre>
      </div>
    </div>
  )
}
