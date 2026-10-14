import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../lib/auth'
import { P, G, B, Y, O, ORG_LEVEL_LABEL, OFFICE_RANKS, RESEARCH_RANKS, EXEC_RANKS, baseRank } from '../lib/constants'
import { KpiRow, LocationBadges, crd, thS, tdS, inp, Loading, ErrorBox, EmptyState, Modal, field, label as lbl, btnPrimary, btnGhost } from '../components/ui'

// ═══ 조직도 — 부문 → 본부 → 팀 ═══
// 조직도를 따로 저장하는 테이블은 없고, employees의 division/dept/team 값을 모아서 트리를 만듦.
// 그래서 "조직 편집"도 결국 해당 조직 소속 직원들의 division/dept/team을 한꺼번에 고치는 것 —
// 직원이 0명인 조직은 트리에 안 나옴(그 조직 소속 직원이 생기면 자동으로 나타남)
const LEVELS = ['division', 'dept', 'team']
const EMPTY_LABEL = { division: '(부문 미지정)', dept: '(본부 없음)', team: '(팀 없음)' }
const LEVEL_COLOR = { division: P, dept: B, team: G }

const norm = (v) => (typeof v === 'string' ? v.trim() : v) || null
const keyOf = (path) => JSON.stringify(path)
const nameOf = (level, v) => v ?? EMPTY_LABEL[level]
const pathStr = (path) => LEVELS.slice(0, path.length).map((l, i) => nameOf(l, path[i])).join(' › ')

// 직급 높은 순 — 임원 → 부장…사원 / 수석…연구원
const RANK_ORDER = [...[...EXEC_RANKS].reverse(), ...[...OFFICE_RANKS].reverse(), ...[...RESEARCH_RANKS].reverse()]
const rankIdx = (r) => { const i = RANK_ORDER.indexOf(baseRank(r)); return i < 0 ? 999 : i }
const byKo = (a, b) => (a.name === null) - (b.name === null) || (a.name || '').localeCompare(b.name || '', 'ko')

// 직원 배열 → 트리 노드 { level, name, path, members, children }
function buildTree(emps) {
  const build = (list, depth, prefix) => {
    const level = LEVELS[depth]
    const groups = new Map()
    list.forEach((e) => {
      const v = e[level]
      if (!groups.has(v)) groups.set(v, [])
      groups.get(v).push(e)
    })
    return [...groups.entries()].map(([name, members]) => {
      const path = [...prefix, name]
      const node = { level, name, path, members, children: [] }
      // 하위 단계가 전부 비어 있으면(예: 팀 없이 본부만) 굳이 "(팀 없음)" 노드를 만들지 않음
      if (members.some((m) => LEVELS.slice(depth + 1).some((l) => m[l] !== null))) {
        node.children = build(members, depth + 1, path)
      }
      return node
    }).sort(byKo)
  }
  return build(emps, 0, [])
}

function flatten(nodes, out = []) {
  nodes.forEach((n) => { out.push(n); flatten(n.children, out) })
  return out
}

export default function OrgChart() {
  const { isAdmin } = useAuth()
  const [emps, setEmps] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(() => new Set())
  const [selKey, setSelKey] = useState(null)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [showDiagram, setShowDiagram] = useState(true)
  const detailRef = useRef(null)

  const load = async () => {
    const { data, error } = await supabase.from('employees').select('id, name, rank, division, dept, team, locations')
    if (error) { setError(error); return }
    setEmps((data || []).map((e) => ({ ...e, division: norm(e.division), dept: norm(e.dept), team: norm(e.team) })))
  }
  useEffect(() => { load() }, [])

  const tree = useMemo(() => (emps ? buildTree(emps) : []), [emps])
  const allNodes = useMemo(() => flatten(tree), [tree])
  const nodeByKey = useMemo(() => new Map(allNodes.map((n) => [keyOf(n.path), n])), [allNodes])
  const selected = selKey ? nodeByKey.get(selKey) : null

  // 검색: 조직 이름이나 직원 이름이 맞는 노드 + 그 조상만 남김
  const query = q.trim().toLowerCase()
  const visibleKeys = useMemo(() => {
    if (!query) return null
    const keys = new Set()
    allNodes.forEach((n) => {
      const hit = (n.name || '').toLowerCase().includes(query)
        || (n.children.length === 0 && n.members.some((m) => (m.name || '').toLowerCase().includes(query)))
      if (hit) for (let i = 1; i <= n.path.length; i++) keys.add(keyOf(n.path.slice(0, i)))
    })
    return keys
  }, [allNodes, query])

  if (error) return <ErrorBox error={error} />
  if (!emps) return <Loading />

  const count = (level) => new Set(emps.filter((e) => e[level] !== null).map((e) => keyOf(LEVELS.slice(0, LEVELS.indexOf(level) + 1).map((l) => e[l])))).size
  const unassigned = emps.filter((e) => e.division === null).length

  // 다이어그램에서 고르면 트리에서도 그 조직이 보이게 상위를 펼치고, 아래 명단 카드로 스크롤
  const selectFromDiagram = (path) => {
    setSelKey(keyOf(path))
    setOpen((s) => { const n = new Set(s); for (let i = 1; i < path.length; i++) n.add(keyOf(path.slice(0, i))); return n })
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0)
  }

  const toggle = (k) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const setAll = (on) => setOpen(on ? new Set(allNodes.filter((n) => n.children.length).map((n) => keyOf(n.path))) : new Set())

  const renderNode = (n, depth) => {
    const k = keyOf(n.path)
    if (visibleKeys && !visibleKeys.has(k)) return null
    const isOpen = !!visibleKeys || open.has(k)
    const isSel = selKey === k
    return (
      <div key={k}>
        <div
          onClick={() => setSelKey(k)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', paddingLeft: 10 + depth * 22, borderRadius: 8,
            cursor: 'pointer', background: isSel ? '#fff7ed' : 'transparent', marginBottom: 2,
          }}
        >
          <span
            onClick={(ev) => { ev.stopPropagation(); if (n.children.length) toggle(k) }}
            style={{ width: 14, color: '#94a3b8', fontSize: 10, textAlign: 'center', flexShrink: 0 }}
          >{n.children.length ? (isOpen ? '▼' : '▶') : '·'}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: LEVEL_COLOR[n.level], flexShrink: 0 }}>{ORG_LEVEL_LABEL[n.level]}</span>
          <span style={{ fontSize: 13, fontWeight: isSel ? 700 : 600, color: n.name === null ? '#94a3b8' : isSel ? O : 'var(--text)' }}>{nameOf(n.level, n.name)}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{n.members.length}명</span>
        </div>
        {isOpen && n.children.map((c) => renderNode(c, depth + 1))}
      </div>
    )
  }

  return (
    <div>
      <KpiRow items={[
        { v: emps.length, l: '전체 인원', c: P },
        { v: count('division'), l: ORG_LEVEL_LABEL.division, c: P },
        { v: count('dept'), l: ORG_LEVEL_LABEL.dept, c: B },
        { v: count('team'), l: ORG_LEVEL_LABEL.team, c: G },
        { v: unassigned, l: `${ORG_LEVEL_LABEL.division} 미지정 인원`, c: Y },
      ]} />
      {tree.length > 0 && (
        <div style={crd}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showDiagram ? 18 : 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>조직 다이어그램</div>
            {showDiagram && <div style={{ fontSize: 11, color: '#94a3b8' }}>박스를 누르면 아래에 소속 직원이 보여요</div>}
            <button style={{ ...btnGhost, padding: '6px 12px', marginLeft: 'auto' }} onClick={() => setShowDiagram((v) => !v)}>{showDiagram ? '접기' : '펼치기'}</button>
          </div>
          {showDiagram && <OrgDiagram tree={tree} total={emps.length} selKey={selKey} onSelect={selectFromDiagram} />}
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ ...crd, flex: '1 1 380px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginRight: 'auto' }}>조직도</div>
            <input style={{ ...inp, width: 170 }} placeholder="조직·직원 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
            <button style={{ ...btnGhost, padding: '7px 12px' }} onClick={() => setAll(true)}>모두 펼치기</button>
            <button style={{ ...btnGhost, padding: '7px 12px' }} onClick={() => setAll(false)}>접기</button>
          </div>
          {tree.length === 0 ? <EmptyState /> : (
            visibleKeys && visibleKeys.size === 0 ? <EmptyState label="검색 결과가 없습니다" /> : tree.map((n) => renderNode(n, 0))
          )}
        </div>
        <div ref={detailRef} style={{ ...crd, flex: '1 1 420px', minWidth: 0 }}>
          {!selected ? (
            <div style={{ color: '#94a3b8', fontSize: 12, padding: '40px 0', textAlign: 'center' }}>왼쪽에서 조직을 누르면 소속 직원이 보여요.</div>
          ) : (
            <NodeDetail node={selected} isAdmin={isAdmin} onEdit={(mode) => setEditing({ mode, node: selected })} />
          )}
        </div>
      </div>
      {editing && (
        <EditModal
          {...editing}
          allNodes={allNodes}
          onClose={() => setEditing(null)}
          onDone={async (newPath) => {
            setEditing(null)
            await load()
            // 편집한 조직을 계속 선택한 상태로 + 상위 조직들 펼쳐두기
            setSelKey(keyOf(newPath))
            setOpen((s) => { const n = new Set(s); for (let i = 1; i < newPath.length; i++) n.add(keyOf(newPath.slice(0, i))); return n })
          }}
        />
      )}
    </div>
  )
}

// ═══ 다이어그램 — 회사 → 부문(가로로 나열) → 본부 카드(세로로 쌓음) → 팀 칩 ═══
// 팀까지 가로로 펼치면 너무 넓어져서, 부문만 가로 트리로 잇고 본부·팀은 부문 밑에 카드로 쌓음
const LINE = '#cbd5e1'

function OrgDiagram({ tree, total, selKey, onSelect }) {
  const last = tree.length - 1
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 'max-content' }}>
        <div style={{ background: O, color: '#fff', borderRadius: 10, padding: '10px 22px', fontWeight: 800, fontSize: 14, textAlign: 'center' }}>
          WONTECH <span style={{ fontWeight: 500, fontSize: 12, opacity: 0.85, marginLeft: 4 }}>{total}명</span>
        </div>
        <div style={{ width: 2, height: 18, background: LINE }} />
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {tree.map((div, i) => (
            <div key={keyOf(div.path)} style={{ position: 'relative', padding: '18px 8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* 부문들을 잇는 가로선 — 첫/마지막 칸은 가운데까지만 */}
              {tree.length > 1 && (
                <div style={{ position: 'absolute', top: 0, height: 2, background: LINE, left: i === 0 ? '50%' : 0, right: i === last ? '50%' : 0 }} />
              )}
              <div style={{ position: 'absolute', top: 0, left: 'calc(50% - 1px)', width: 2, height: 18, background: LINE }} />
              <DiagramBox node={div} selKey={selKey} onSelect={onSelect} />
              {div.children.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, width: '100%', minWidth: 170, borderTop: `2px solid ${LINE}`, paddingTop: 10 }}>
                  {div.children.map((d) => <DeptCard key={keyOf(d.path)} node={d} selKey={selKey} onSelect={onSelect} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DiagramBox({ node, selKey, onSelect }) {
  const sel = selKey === keyOf(node.path)
  const empty = node.name === null
  return (
    <div
      onClick={() => onSelect(node.path)}
      style={{
        cursor: 'pointer', borderRadius: 10, padding: '9px 16px', textAlign: 'center', minWidth: 140, boxSizing: 'border-box',
        background: empty ? '#f8fafc' : '#f3e8ff', color: empty ? '#94a3b8' : P,
        border: `2px ${empty ? 'dashed' : 'solid'} ${sel ? O : empty ? '#e2e8f0' : '#e9d5ff'}`,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>{nameOf(node.level, node.name)}</div>
      <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>{node.members.length}명</div>
    </div>
  )
}

function DeptCard({ node, selKey, onSelect }) {
  const sel = selKey === keyOf(node.path)
  const empty = node.name === null
  return (
    <div
      onClick={() => onSelect(node.path)}
      style={{
        cursor: 'pointer', borderRadius: 8, padding: '8px 10px', background: '#fff',
        border: `1.5px ${empty ? 'dashed' : 'solid'} ${sel ? O : '#e2e8f0'}`, borderLeft: `4px solid ${sel ? O : empty ? '#cbd5e1' : B}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: empty ? '#94a3b8' : 'var(--text)', whiteSpace: 'nowrap' }}>{empty ? '본부 없이 바로' : node.name}</span>
        <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto' }}>{node.members.length}명</span>
      </div>
      {node.children.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, maxWidth: 220 }}>
          {node.children.map((t) => {
            const tSel = selKey === keyOf(t.path)
            return (
              <span
                key={keyOf(t.path)}
                onClick={(ev) => { ev.stopPropagation(); onSelect(t.path) }}
                style={{
                  fontSize: 10.5, padding: '2px 8px', borderRadius: 12, whiteSpace: 'nowrap', cursor: 'pointer',
                  background: tSel ? O : t.name === null ? '#f1f5f9' : '#dcfce7', color: tSel ? '#fff' : t.name === null ? '#94a3b8' : '#166534',
                }}
              >{nameOf(t.level, t.name)} {t.members.length}</span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NodeDetail({ node, isAdmin, onEdit }) {
  const members = [...node.members].sort((a, b) => rankIdx(a.rank) - rankIdx(b.rank) || (a.name || '').localeCompare(b.name || '', 'ko'))
  const depth = LEVELS.indexOf(node.level)
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{pathStr(node.path)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginRight: 'auto' }}>
          {nameOf(node.level, node.name)} <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{members.length}명</span>
        </div>
        {isAdmin && (
          <>
            <button style={{ ...btnGhost, padding: '6px 12px' }} onClick={() => onEdit('rename')}>{node.name === null ? '이름 지정' : '이름 변경'}</button>
            {depth > 0 && <button style={{ ...btnGhost, padding: '6px 12px' }} onClick={() => onEdit('move')}>상위 조직 이동</button>}
            <button style={{ ...btnGhost, padding: '6px 12px' }} onClick={() => onEdit('merge')}>다른 조직으로 합치기</button>
          </>
        )}
      </div>
      <div style={{ maxHeight: 560, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thS}>이름</th>
              <th style={thS}>직급</th>
              {LEVELS.slice(depth + 1).map((l) => <th key={l} style={thS}>{ORG_LEVEL_LABEL[l]}</th>)}
              <th style={thS}>지역</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td style={{ ...tdS, fontWeight: 600 }}><Link to={`/employees/${m.id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>{m.name}</Link></td>
                <td style={tdS}>{m.rank || '—'}</td>
                {LEVELS.slice(depth + 1).map((l) => <td key={l} style={{ ...tdS, color: m[l] ? 'var(--text)' : '#cbd5e1' }}>{m[l] || '—'}</td>)}
                <td style={tdS}><LocationBadges locations={m.locations} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const MODE_TITLE = { rename: '이름 변경', move: '상위 조직 이동', merge: '다른 조직으로 합치기' }

// 세 가지 편집 모두 "이 조직의 경로(path)를 새 경로로 바꾸기" — 소속 직원들의 해당 단계까지 값을 새 경로로 덮어씀
//  - 이름 변경: 마지막 칸만 새 이름
//  - 상위 조직 이동: 마지막 칸(자기 이름)은 그대로, 앞쪽(상위 조직)만 다른 기존 조직으로
//  - 합치기: 같은 단계의 다른 기존 조직 경로로 통째로
function EditModal({ mode, node, allNodes, onClose, onDone }) {
  const depth = LEVELS.indexOf(node.level)
  const [name, setName] = useState(node.name || '')
  const [targetKey, setTargetKey] = useState('')
  const [newParentName, setNewParentName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const selfKey = keyOf(node.path)
  const parentKey = keyOf(node.path.slice(0, -1))
  // 이동 대상: 한 단계 위 조직들 (현재 상위는 제외). 본부를 옮길 때는 새 부문 직접 입력도 허용,
  // 팀을 옮길 때는 본부 없이 부문 바로 밑으로 붙이는 것도 허용
  const parentPaths = [
    ...allNodes.filter((n) => n.path.length === depth).map((n) => n.path),
    ...(depth === 2 ? allNodes.filter((n) => n.level === 'division').map((n) => [n.name, null]) : []),
  ]
  const parentOptions = [...new Map(parentPaths.map((p) => [keyOf(p), p])).values()].filter((p) => keyOf(p) !== parentKey)
  // 합치기 대상: 같은 단계의 다른 조직 (이름 없는 자리 표시 노드는 제외)
  const mergeOptions = allNodes.filter((n) => n.level === node.level && n.name !== null && keyOf(n.path) !== selfKey)

  let newPath = null
  if (mode === 'rename') {
    const v = name.trim()
    if (v && v !== node.name) newPath = [...node.path.slice(0, -1), v]
  } else if (mode === 'move') {
    if (targetKey === '__custom__') { const v = newParentName.trim(); if (v && depth === 1) newPath = [v, node.name] }
    else if (targetKey) newPath = [...JSON.parse(targetKey), node.name]
  } else if (targetKey) {
    newPath = JSON.parse(targetKey)
  }

  // 같은 경로에 이미 다른 조직이 있으면(이름 변경·이동 결과가 기존 조직과 겹치면) 자동으로 합쳐진다는 안내
  const collides = newPath && mode !== 'merge' && allNodes.some((n) => keyOf(n.path) === keyOf(newPath))

  const submit = async (e) => {
    e.preventDefault()
    if (!newPath) return
    const patch = Object.fromEntries(LEVELS.slice(0, depth + 1).map((l, i) => [l, newPath[i]]))
    if (!window.confirm(`${node.members.length}명의 소속이 바뀝니다.\n\n${pathStr(node.path)}\n→ ${pathStr(newPath)}\n\n진행할까요?`)) return
    setSaving(true)
    setErr('')
    const ids = node.members.map((m) => m.id)
    // URL 길이 제한 때문에 나눠서 업데이트
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await supabase.from('employees').update(patch).in('id', ids.slice(i, i + 100))
      if (error) {
        setSaving(false)
        setErr(i > 0 ? `${i}명까지만 반영되고 실패했어요: ${error.message}` : error.message)
        return
      }
    }
    setSaving(false)
    onDone(newPath)
  }

  return (
    <Modal title={`${MODE_TITLE[mode]} — ${nameOf(node.level, node.name)}`} onClose={onClose} width={440}>
      <form onSubmit={submit}>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>현재: {pathStr(node.path)} · {node.members.length}명</div>
        {mode === 'rename' && (
          <>
            <label style={lbl}>새 {ORG_LEVEL_LABEL[node.level]} 이름</label>
            <input style={field} autoFocus required value={name} onChange={(e) => setName(e.target.value)} />
          </>
        )}
        {mode === 'move' && (
          <>
            <label style={lbl}>옮겨갈 상위 조직</label>
            <select style={field} required value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
              <option value="" disabled>선택하세요</option>
              {parentOptions.map((p) => <option key={keyOf(p)} value={keyOf(p)}>{pathStr(p)}</option>)}
              {depth === 1 && <option value="__custom__">+ 새 {ORG_LEVEL_LABEL.division} 직접 입력</option>}
            </select>
            {targetKey === '__custom__' && (
              <input style={field} required placeholder={`새 ${ORG_LEVEL_LABEL.division}명`} value={newParentName} onChange={(e) => setNewParentName(e.target.value)} />
            )}
          </>
        )}
        {mode === 'merge' && (
          <>
            <label style={lbl}>합칠 대상 {ORG_LEVEL_LABEL[node.level]}</label>
            <select style={field} required value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
              <option value="" disabled>선택하세요</option>
              {mergeOptions.map((n) => <option key={keyOf(n.path)} value={keyOf(n.path)}>{pathStr(n.path)} ({n.members.length}명)</option>)}
            </select>
            {node.children.length > 0 && (
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>하위 조직은 이름 그대로 대상 조직 밑으로 옮겨집니다.</div>
            )}
          </>
        )}
        {newPath && (
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
            <div><b>{node.members.length}명</b>의 소속이 이렇게 바뀝니다</div>
            <div style={{ color: '#94a3b8' }}>{pathStr(node.path)}</div>
            <div style={{ color: O, fontWeight: 600 }}>→ {pathStr(newPath)}</div>
            {collides && <div style={{ color: '#b45309', marginTop: 4 }}>같은 이름의 조직이 이미 있어서 그 조직과 합쳐집니다.</div>}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
          외국어필수 트랙 자동 추천은 조직 이름 기준이라, 해당 본부·팀 이름이 바뀌면 개발 쪽 설정도 함께 바꿔야 합니다.
        </div>
        {err && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" style={btnGhost} onClick={onClose}>취소</button>
          <button type="submit" style={{ ...btnPrimary, opacity: newPath && !saving ? 1 : 0.5 }} disabled={!newPath || saving}>{saving ? '적용 중…' : '적용'}</button>
        </div>
      </form>
    </Modal>
  )
}
