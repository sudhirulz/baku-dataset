export async function extractEXIF(file) {
  try { const buffer = await file.arrayBuffer(); return parseEXIF(new DataView(buffer)) }
  catch { return null }
}

function parseEXIF(view) {
  if (view.getUint16(0) !== 0xFFD8) return null
  let offset = 2
  while (offset < view.byteLength) {
    if (view.getUint8(offset) !== 0xFF) break
    const marker = view.getUint16(offset); offset += 2
    if (marker === 0xFFE1) return parseApp1(view, offset)
    offset += view.getUint16(offset)
  }
  return null
}

function parseApp1(view, offset) {
  offset += 2
  const hdr = String.fromCharCode(view.getUint8(offset),view.getUint8(offset+1),view.getUint8(offset+2),view.getUint8(offset+3))
  if (hdr !== 'Exif') return null
  offset += 6
  const ts = offset
  const le = view.getUint16(offset) === 0x4949
  const ifd0 = parseIFD(view, ts + getU32(view,offset+4,le), ts, le)
  const result = {}
  if (ifd0[0x0132]) result.datetime = ifd0[0x0132]
  if (ifd0[0x010F]) result.make = ifd0[0x010F]
  if (ifd0[0x0110]) result.model = ifd0[0x0110]
  if (ifd0[0x8769]) {
    const sub = parseIFD(view, ts+ifd0[0x8769], ts, le)
    if (sub[0x9003]) result.datetime = sub[0x9003]
  }
  if (ifd0[0x8825]) {
    const gps = parseIFD(view, ts+ifd0[0x8825], ts, le)
    const lat = parseGPS(gps[0x0002], gps[0x0001])
    const lon = parseGPS(gps[0x0004], gps[0x0003])
    if (lat != null) result.lat = lat
    if (lon != null) result.lon = lon
    if (gps[0x0006]) result.altitude = typeof gps[0x0006]==='number' ? gps[0x0006].toFixed(1) : null
  }
  return Object.keys(result).length > 0 ? result : null
}

const getU16 = (v,o,le) => le ? v.getUint16(o,true) : v.getUint16(o,false)
const getU32 = (v,o,le) => le ? v.getUint32(o,true) : v.getUint32(o,false)
const getI32 = (v,o,le) => le ? v.getInt32(o,true) : v.getInt32(o,false)

function parseIFD(view, offset, ts, le) {
  const r = {}
  try {
    const n = getU16(view,offset,le); offset += 2
    for (let i=0;i<n;i++) {
      const tag=getU16(view,offset,le), type=getU16(view,offset+2,le), count=getU32(view,offset+4,le)
      r[tag] = readVal(view,type,count,offset+8,ts,le); offset+=12
    }
  } catch {}
  return r
}

function readVal(view,type,count,vo,ts,le) {
  const sz=[0,1,1,2,4,8,1,1,2,4,8,4,8]
  let off = sz[type]*count>4 ? ts+getU32(view,vo,le) : vo
  try {
    if (type===2) { let s=''; for(let i=0;i<count-1;i++) s+=String.fromCharCode(view.getUint8(off+i)); return s.trim() }
    if (type===3) return getU16(view,off,le)
    if (type===4) return getU32(view,off,le)
    if (type===5) { const n=[]; for(let i=0;i<count;i++) { const a=getU32(view,off+i*8,le),b=getU32(view,off+i*8+4,le); n.push(b?a/b:0) } return count===1?n[0]:n }
    if (type===10) { const n=[]; for(let i=0;i<count;i++) { const a=getI32(view,off+i*8,le),b=getI32(view,off+i*8+4,le); n.push(b?a/b:0) } return count===1?n[0]:n }
  } catch {}
  return null
}

function parseGPS(coords, ref) {
  if (!coords||!Array.isArray(coords)) return null
  let d = coords[0]+coords[1]/60+coords[2]/3600
  if (ref==='S'||ref==='W') d=-d
  return parseFloat(d.toFixed(6))
}

export function formatCoords(lat, lon) {
  if (lat==null||lon==null) return 'No GPS'
  return `${Math.abs(lat).toFixed(5)}°${lat>=0?'N':'S'}  ${Math.abs(lon).toFixed(5)}°${lon>=0?'E':'W'}`
}

export function mapsUrl(lat, lon) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=16`
}

export async function reverseGeocode(lat, lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`, { headers: { 'User-Agent': 'BakuComixResearch/1.0' } })
    if (!r.ok) return null
    const d = await r.json(); const a = d.address||{}
    return { country:a.country||'', city:a.city||a.town||a.village||a.county||'', district:a.suburb||a.district||'', street:a.road||a.pedestrian||'', raw:d.display_name||'' }
  } catch { return null }
}
