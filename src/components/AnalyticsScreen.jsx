import React, { useState, useEffect } from 'react'
import { getAllEntries, getAllWords } from '../lib/db.js'

function Bar({ label, n, max, color, onClick }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, cursor:onClick?'pointer':'default' }} onClick={onClick}>
      <span style={{ width:160, fontSize:12, color:'var(--text2)', flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
      <div style={{ flex:1, height:8, background:'var(--bg3)', borderRadius:4, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:4, background:color||'var(--accent)', width:`${max?(n/max)*100:0}%`, transition:'width .4s' }} />
      </div>
      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)', width:30, textAlign:'right' }}>{n}</span>
      {max && <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text3)', width:32 }}>{Math.round(n/max*100)}%</span>}
    </div>
  )
}

function FindingCard({ number, title, subtitle, children, color='var(--accent)' }) {
  return (
    <div className="card" style={{ marginBottom:16, overflow:'hidden' }}>
      <div style={{ background:color, padding:'10px 20px', display:'flex', alignItems:'baseline', gap:10 }}>
        <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'rgba(255,255,255,.7)', fontWeight:700 }}>FINDING {number}</span>
        <span style={{ fontSize:14, fontWeight:600, color:'#fff' }}>{title}</span>
      </div>
      {subtitle && <div style={{ padding:'8px 20px', background:'rgba(0,0,0,.03)', fontSize:12, color:'var(--text2)', borderBottom:'1px solid var(--border)', fontStyle:'italic' }}>{subtitle}</div>}
      <div style={{ padding:'16px 20px' }}>{children}</div>
    </div>
  )
}

export default function AnalyticsScreen({ tick }) {
  const [entries, setEntries] = useState([])
  const [words, setWords] = useState([])

  useEffect(() => {
    getAllEntries().then(e => setEntries(e.filter(x=>x.status==='done'||x.status==='ocr_done')))
    getAllWords().then(setWords)
  }, [tick])

  if (entries.length === 0) return (
    <div style={{ textAlign:'center', padding:'60px 0' }}>
      <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
      <div style={{ fontWeight:600, marginBottom:6 }}>No processed data yet</div>
      <div style={{ fontSize:13, color:'var(--text3)' }}>Upload and process entries first, then come back for analytics.</div>
    </div>
  )

  // ── Data calculations ──
  const total = entries.length
  const withSwitch = entries.filter(e=>e.hasCodeSwitching)
  const withGPS = entries.filter(e=>e.exif?.lat)
  const photoEntries = entries.filter(e=>e.sourceType==='photo')
  const audioEntries = entries.filter(e=>e.sourceType!=='photo')

  // Language frequency
  const langFreq = {}
  entries.forEach(e=>(e.languageNames||e.detectedLanguages||[]).forEach(l=>{ langFreq[l]=(langFreq[l]||0)+1 }))
  const topLangs = Object.entries(langFreq).sort((a,b)=>b[1]-a[1])

  // Domain × language
  const domainLang = {}
  entries.forEach(e=>{
    const d=e.domain||'Other'
    if (!domainLang[d]) domainLang[d]={}
    ;(e.languageNames||e.detectedLanguages||[]).forEach(l=>{ domainLang[d][l]=(domainLang[d][l]||0)+1 })
  })
  const topDomains = Object.entries(domainLang).sort((a,b)=>Object.values(b[1]).reduce((s,v)=>s+v,0)-Object.values(a[1]).reduce((s,v)=>s+v,0)).slice(0,8)

  // Zone distribution
  const zoneFreq = {}
  entries.forEach(e=>{ if(e.zone) zoneFreq[e.zone]=(zoneFreq[e.zone]||0)+1 })
  const topZones = Object.entries(zoneFreq).sort((a,b)=>b[1]-a[1])

  // Switch types
  const switchFreq = {}
  entries.filter(e=>e.hasCodeSwitching).forEach(e=>{ if(e.switchType) switchFreq[e.switchType]=(switchFreq[e.switchType]||0)+1 })
  const topSwitch = Object.entries(switchFreq).sort((a,b)=>b[1]-a[1])

  // Script mixing
  const scriptComboFreq = {}
  entries.forEach(e=>{
    const scripts=(e.scripts||[]).sort().join(' + ')
    if (scripts) scriptComboFreq[scripts]=(scriptComboFreq[scripts]||0)+1
  })
  const topScripts = Object.entries(scriptComboFreq).sort((a,b)=>b[1]-a[1]).slice(0,8)

  // Word integration classes
  const icFreq = {}
  words.forEach(w=>{ if(w.integrationClass) icFreq[w.integrationClass]=(icFreq[w.integrationClass]||0)+1 })
  const topIC = Object.entries(icFreq).sort((a,b)=>b[1]-a[1])

  // Word language origin
  const wordLangFreq = {}
  words.forEach(w=>{ if(w.languageName) wordLangFreq[w.languageName]=(wordLangFreq[w.languageName]||0)+1 })
  const topWordLangs = Object.entries(wordLangFreq).sort((a,b)=>b[1]-a[1])

  // Source breakdown
  const sourceFreq = { photo:photoEntries.length, native_speaker:entries.filter(e=>e.sourceType==='native_speaker').length, youtube:entries.filter(e=>e.sourceType==='youtube').length }

  const IC_COLORS = { native:'var(--green)', established_loanword:'var(--teal)', recent_borrowing:'var(--accent)', morphological_hybrid:'var(--amber)', code_switch:'var(--red)', calque:'var(--purple)', proper_noun:'var(--text3)', unknown:'var(--border2)' }

  return (
    <div>
      {/* Summary stats */}
      <div className="g4" style={{ marginBottom:20, gap:12 }}>
        {[
          ['Entries', total, 'var(--text)'],
          ['Code-switching', withSwitch.length, 'var(--accent)'],
          ['GPS-tagged', withGPS.length, 'var(--green)'],
          ['Words analysed', words.length, 'var(--purple)'],
        ].map(([l,n,c])=>(
          <div key={l} className="stat"><div className="stat-num" style={{ color:c }}>{n}</div><div className="stat-label">{l}</div></div>
        ))}
      </div>

      {/* Finding 1 — Language composition */}
      <FindingCard number={1} title="Language composition" color="#1d4ed8"
        subtitle={`Of ${total} entries analysed across all sources, ${topLangs[0]?.[0]} is the dominant language at ${topLangs[0]?Math.round(topLangs[0][1]/total*100):0}%`}>
        {topLangs.map(([l,n])=><Bar key={l} label={l} n={n} max={total} color="var(--accent)" />)}
      </FindingCard>

      {/* Finding 2 — Code-switching rate */}
      <FindingCard number={2} title="Code-switching by domain" color="#15803d"
        subtitle={`${withSwitch.length} of ${total} entries show code-switching (${total?Math.round(withSwitch.length/total*100):0}%). Breakdown by functional domain:`}>
        {topDomains.map(([domain, langMap])=>{
          const domainTotal = Object.values(langMap).reduce((s,v)=>s+v,0)
          const domainEntries = entries.filter(e=>e.domain===domain)
          const switchInDomain = domainEntries.filter(e=>e.hasCodeSwitching).length
          return (
            <div key={domain} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:12, fontWeight:500 }}>{domain}</span>
                <span style={{ fontSize:11, color:'var(--amber)', fontWeight:600 }}>{switchInDomain}/{domainEntries.length} switching ({domainEntries.length?Math.round(switchInDomain/domainEntries.length*100):0}%)</span>
              </div>
              <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                {Object.entries(langMap).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([l,n])=>(
                  <span key={l} style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'var(--accent-light)', color:'var(--accent)', border:'1px solid var(--accent-border)' }}>{l}: {n}</span>
                ))}
              </div>
            </div>
          )
        })}
      </FindingCard>

      {/* Finding 3 — Integration classes */}
      {words.length > 0 && (
        <FindingCard number={3} title="Morphological integration classes" color="#7c3aed"
          subtitle={`${words.length} words analysed across ${entries.length} entries. ${icFreq.morphological_hybrid||0} morphological hybrids identified — words formed by fusing foreign stems with native Azerbaijani grammar.`}>
          {topIC.map(([cls,n])=>(
            <Bar key={cls} label={cls.replace(/_/g,' ')} n={n} max={words.length} color={IC_COLORS[cls]||'var(--text3)'} />
          ))}
        </FindingCard>
      )}

      {/* Finding 4 — Geographic distribution */}
      <FindingCard number={4} title="Geographic coverage" color="#0f766e"
        subtitle={`${withGPS.length} of ${total} entries are GPS-tagged. Distribution across zones:`}>
        {topZones.map(([z,n])=><Bar key={z} label={z} n={n} max={topZones[0]?.[1]} color="var(--teal)" />)}
      </FindingCard>

      {/* Finding 5 — Word frequency */}
      {words.length > 0 && (
        <FindingCard number={5} title="Word language origins" color="#b45309"
          subtitle="Language distribution at the word level — what languages make up the vocabulary of your collected texts">
          {topWordLangs.map(([l,n])=><Bar key={l} label={l} n={n} max={topWordLangs[0]?.[1]} color="var(--amber)" />)}
        </FindingCard>
      )}

      {/* Finding 6 — Script mixing */}
      <FindingCard number={6} title="Script combinations on signs" color="#b91c1c"
        subtitle="How many scripts appear together on a single sign — a key indicator of multilingual display strategies">
        {topScripts.map(([combo,n])=><Bar key={combo} label={combo||'Single script'} n={n} max={topScripts[0]?.[1]} color="var(--red)" />)}
      </FindingCard>

      {/* Finding 7 — Switch types */}
      <FindingCard number={7} title="Code-switching types" color="#6d28d9"
        subtitle={`${withSwitch.length} entries show code-switching. Breakdown by linguistic type:`}>
        {topSwitch.length > 0
          ? topSwitch.map(([s,n])=><Bar key={s} label={s} n={n} max={withSwitch.length} color="var(--purple)" />)
          : <div style={{ color:'var(--text3)', fontSize:13 }}>No code-switching detected yet in processed entries.</div>
        }
      </FindingCard>

      {/* Source breakdown */}
      <FindingCard number="—" title="Data source breakdown" color="#374151">
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          {[
            ['📷 My photos', sourceFreq.photo, 'var(--green)'],
            ['🎙 Native speaker', sourceFreq.native_speaker, 'var(--purple)'],
            ['🎬 YouTube', sourceFreq.youtube, 'var(--red)'],
          ].map(([l,n,c])=>(
            <div key={l} style={{ background:'var(--bg3)', borderRadius:'var(--r)', padding:'12px 16px', minWidth:120 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:24, fontWeight:700, color:c }}>{n}</div>
              <div style={{ fontSize:11, color:'var(--text2)', marginTop:4 }}>{l}</div>
            </div>
          ))}
        </div>
      </FindingCard>
    </div>
  )
}
