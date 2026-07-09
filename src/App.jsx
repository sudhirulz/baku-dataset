import React, { useState, useEffect } from 'react'
import { getSetting, setSetting, getAllEntries, getAllWords } from './lib/db.js'
import { setApiKey } from './lib/api.js'
import UploadScreen from './components/UploadScreen.jsx'
import ProcessScreen from './components/ProcessScreen.jsx'
import WordScreen from './components/WordScreen.jsx'
import ReviewScreen from './components/ReviewScreen.jsx'
import AnalyticsScreen from './components/AnalyticsScreen.jsx'
import ExportScreen from './components/ExportScreen.jsx'

export default function App() {
  const [tab, setTab] = useState('upload')
  const [apiKey, setKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [counts, setCounts] = useState({ entries:0, done:0, words:0 })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    getSetting('apiKey').then(k => { if (k) { setKey(k); setApiKey(k) } })
  }, [])

  useEffect(() => {
    Promise.all([getAllEntries(), getAllWords()]).then(([entries, words]) => {
      setCounts({ entries:entries.length, done:entries.filter(e=>e.status==='done'||e.status==='ocr_done').length, words:words.length })
    })
  }, [tick])

  function saveKey() {
    const k = keyInput.trim(); if (!k) return
    setKey(k); setApiKey(k); setSetting('apiKey', k)
    setShowKeyInput(false); setKeyInput('')
  }

  const refresh = () => setTick(t => t+1)

  const tabs = [
    { id:'upload', label:'① Upload' },
    { id:'process', label:'② Process', count: counts.entries },
    { id:'words', label:'③ Words', count: counts.words || null },
    { id:'review', label:'④ Review & Edit', count: counts.done },
    { id:'analytics', label:'⑤ Analytics' },
    { id:'export', label:'⑥ Export' },
  ]

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span style={{ color:"var(--az-blue)" }}>Baku</span>{" "}<span style={{ color:"var(--az-red)" }}>Comix</span>{" "}<span style={{ color:"var(--text3)", fontWeight:400, fontSize:12 }}>— Linguistic Dataset Platform</span></div>
        {tabs.map(t => (
          <button key={t.id} className={`nav-btn ${tab===t.id?'active':''}`} onClick={() => { setTab(t.id); refresh() }}>
            {t.label}
            {t.count > 0 && <span className="cnt">{t.count}</span>}
          </button>
        ))}
        <div className="topbar-right">
          <span style={{ fontSize:11, color: apiKey?'var(--green)':'var(--red)', fontWeight:600 }}>
            {apiKey ? '● API key active' : '○ No API key'}
          </span>
          {showKeyInput ? (
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <div style={{ position:'relative' }}>
                <input type={showKey?'text':'password'} value={keyInput} onChange={e => setKeyInput(e.target.value)}
                  placeholder="sk-ant-..." style={{ width:210, fontSize:12, paddingRight:36 }}
                  onKeyDown={e => e.key==='Enter' && saveKey()} autoFocus />
                <button onClick={() => setShowKey(s=>!s)} style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:10 }}>
                  {showKey?'hide':'show'}
                </button>
              </div>
              <button className="btn btn-sm btn-primary" onClick={saveKey}>Save</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowKeyInput(false)}>✕</button>
            </div>
          ) : (
            <button className="btn btn-sm" onClick={() => setShowKeyInput(true)}>
              {apiKey ? 'Change key' : 'Set API key'}
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {!apiKey && tab !== 'upload' && tab !== 'review' && tab !== 'analytics' && tab !== 'export' && (
          <div className="warn-box" style={{ marginBottom:16 }}>No API key set — set it in the top bar to enable AI processing.</div>
        )}
        {tab==='upload' && <UploadScreen onUploaded={refresh} />}
        {tab==='process' && <ProcessScreen tick={tick} onProcessed={refresh} hasKey={!!apiKey} />}
        {tab==='words' && <WordScreen tick={tick} onDone={refresh} hasKey={!!apiKey} />}
        {tab==='review' && <ReviewScreen tick={tick} onEdited={refresh} />}
        {tab==='analytics' && <AnalyticsScreen tick={tick} />}
        {tab==='export' && <ExportScreen tick={tick} />}
      </main>
    </div>
  )
}
