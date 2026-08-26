// ═══ 아주 단순한 CSV 인코더/디코더 (RFC4180 비슷하게, 따옴표·콤마·줄바꿈 처리) ═══

function escapeCell(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

export function toCSV(rows, columns) {
  const header = columns.map((c) => escapeCell(c.label)).join(',')
  const lines = rows.map((r) => columns.map((c) => escapeCell(r[c.key])).join(','))
  return '﻿' + [header, ...lines].join('\r\n') // BOM 붙여서 엑셀에서 한글 깨지지 않게
}

export function downloadCSV(filename, rows, columns) {
  const csv = toCSV(rows, columns)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// text -> [{header: value, ...}, ...]
export function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const clean = text.replace(/^﻿/, '')
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((v) => v !== '')) rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); if (row.some((v) => v !== '')) rows.push(row) }
  if (rows.length === 0) return []
  const header = rows[0]
  return rows.slice(1).map((r) => {
    const obj = {}
    header.forEach((h, i) => { obj[h] = r[i] ?? '' })
    return obj
  })
}
