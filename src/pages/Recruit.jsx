import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { P, G, O, Y, B, ORG_LEVEL_LABEL, TRACKS, orgPath, suggestTrackForDept } from '../lib/constants'
import { fetchRankCriteria } from '../lib/promotion'
import { calcCareer, judgeEntry, entryMonths, newCareerEntry, thisMonth, ranksForTrack, careerLabel, EDU_LEVELS, eduStatuses, SIMILARITY, CAREER_TYPES } from '../lib/careerRank'
import { QuickAddHireModal } from './HireResign'
import { Bd, KpiRow, LocationBadges, LocationPicker, crd, thS, tdS, inp, Loading, ErrorBox, EmptyState, Modal, field, label as lbl, btnPrimary, btnGhost, AddButton } from '../components/ui'

const STATUS_CFG = {
  최종협의: { c: '#7c3aed', bg: '#f3e8ff' }, 면접진행: { c: O, bg: '#fff7ed' }, 서류심사: { c: B, bg: '#e0f2fe' }, 공고중: { c: G, bg: '#dcfce7' }, 마감: { c: '#64748b', bg: '#f1f5f9' },
}
const RESULT_CFG = {
  입사확정: { c: '#fff', bg: G }, 합격대기: { c: G, bg: '#dcfce7' }, 통과: { c: B, bg: '#e0f2fe' }, 진행중: { c: O, bg: '#fff7ed' }, 검토중: { c: Y, bg: '#fef9c3' }, 탈락: { c: '#94a3b8', bg: '#f1f5f9' },
}

export default function Recruit() {
  const [positions, setPositions] = useState(null)
  const [error, setError] = useState(null)
  const [sel, setSel] = useState(null)
  const [f, setF] = useState('all')
  const [showAddPos, setShowAddPos] = useState(false)
  const [showAddCand, setShowAddCand] = useState(false)
  const [editCand, setEditCand] = useState(null)
  const [hireCand, setHireCand] = useState(null)
  const [calcCand, setCalcCand] = useState(null) // 계산기 값으로 지원자 등록
  const [calcHire, setCalcHire] = useState(null) // 계산기 값으로 바로 입사 등록
  const [criteriaMap, setCriteriaMap] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { fetchRankCriteria().then(setCriteriaMap).catch(setError) }, [])

  const load = async () => {
    const { data, error } = await supabase
      .from('recruit_positions')
      .select('*, recruit_candidates(*)')
      .order('open_date', { ascending: false })
    if (error) { setError(error); return }
    setPositions(data || [])
  }

  useEffect(() => { load() }, [])

  const removePosition = async (p) => {
    if (!window.confirm(`"${p.position}" 포지션과 지원자 전체를 삭제할까요?`)) return
    const { error } = await supabase.from('recruit_positions').delete().eq('id', p.id)
    if (error) { setError(error); return }
    setPositions(positions.filter((x) => x.id !== p.id))
    if (sel === p.id) setSel(null)
  }

  const removeCandidate = async (c) => {
    if (!window.confirm(`${c.name} 지원자를 삭제할까요?`)) return
    const { error } = await supabase.from('recruit_candidates').delete().eq('id', c.id)
    if (error) { setError(error); return }
    setPositions(positions.map((p) => (p.id === sel ? { ...p, recruit_candidates: p.recruit_candidates.filter((x) => x.id !== c.id) } : p)))
  }

  if (error) return <ErrorBox error={error} />
  if (!positions || !criteriaMap) return <Loading />

  const filtered = positions.filter((p) => f === 'all' || p.status === f)
  const s = positions.find((p) => p.id === sel)
  const totalCands = positions.reduce((a, p) => a + (p.recruit_candidates || []).length, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <select style={{ ...inp, cursor: 'pointer' }} value={f} onChange={(e) => setF(e.target.value)}>
          <option value="all">전체 상태</option>
          <option value="공고중">공고중</option>
          <option value="서류심사">서류심사</option>
          <option value="면접진행">면접진행</option>
          <option value="최종협의">최종협의</option>
          <option value="마감">마감</option>
        </select>
        <AddButton onClick={() => setShowAddPos(true)}>+ 포지션 추가</AddButton>
      </div>
      <KpiRow items={[
        { v: positions.length, l: '채용 포지션', c: P },
        { v: positions.filter((p) => p.status === '면접진행').length, l: '면접 진행중', c: O },
        { v: positions.filter((p) => p.status === '최종협의').length, l: '최종 협의', c: '#7c3aed' },
        { v: totalCands, l: '총 지원자', c: B },
      ]} />
      <CareerCalculator criteriaMap={criteriaMap} onRegister={setCalcCand} onHire={(v) => setCalcHire(candidateFromCalc(v, criteriaMap))} />
      <div style={{ display: 'grid', gridTemplateColumns: s ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div style={crd}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>채용 포지션</div>
          {filtered.length === 0 ? <EmptyState /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['포지션', '위치', '소속', '유형', '레벨', '지원자', '상태', ''].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((p) => {
                  const st = STATUS_CFG[p.status] || { c: '#64748b', bg: '#f1f5f9' }
                  const cands = p.recruit_candidates || []
                  return (
                    <tr key={p.id} style={{ cursor: 'pointer', background: sel === p.id ? '#FFF5F0' : 'transparent' }}
                      onClick={() => setSel(p.id === sel ? null : p.id)}
                      onMouseEnter={(ev) => { if (sel !== p.id) ev.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={(ev) => { if (sel !== p.id) ev.currentTarget.style.background = 'transparent' }}>
                      <td style={{ ...tdS, fontWeight: 600 }}>{p.position}</td>
                      <td style={tdS}><LocationBadges locations={p.locations} /></td>
                      <td style={{ ...tdS, color: '#64748b' }}>{orgPath(p)}</td>
                      <td style={tdS}>{p.hire_type}</td>
                      <td style={tdS}>{p.level}</td>
                      <td style={tdS}><span style={{ fontWeight: 600, color: cands.length ? P : '#94a3b8' }}>{cands.length}명</span></td>
                      <td style={tdS}><Bd color={st.c} bg={st.bg}>{p.status}</Bd></td>
                      <td style={tdS}><button style={{ ...btnGhost, padding: '4px 9px', fontSize: 11 }} onClick={(e) => { e.stopPropagation(); removePosition(p) }}>삭제</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {s && (
          <div style={crd}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{s.position}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <LocationBadges locations={s.locations} />
                  <div style={{ fontSize: 12, color: '#64748b' }}>{orgPath(s)} · {s.hire_type} · {s.level}</div>
                </div>
              </div>
              <button style={{ ...btnGhost, padding: '5px 12px', fontSize: 11 }} onClick={() => setShowAddCand(true)}>+ 지원자 추가</button>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>👤 지원자 ({(s.recruit_candidates || []).length}명)</div>
            {(s.recruit_candidates || []).length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>지원자 없음</div>
            ) : (
              s.recruit_candidates.map((c) => {
                const cx = RESULT_CFG[c.result] || RESULT_CFG['검토중']
                const hired = c.result === '입사확정'
                const profile = [eduLabel(c), c.career_months > 0 ? `인정 경력 ${careerLabel(c.career_months)}` : null].filter(Boolean).join(' · ')
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 4px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>
                        {c.name}
                        {c.est_rank && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: P }}>{c.est_rank} {c.est_level ?? 0}연차</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{[c.stage, profile].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <Bd color={cx.c} bg={cx.bg}>{c.result}</Bd>
                      {!hired && <button style={{ ...btnGhost, padding: '3px 8px', fontSize: 10, color: G, borderColor: '#bbf7d0' }} onClick={() => setHireCand(c)}>입사 등록</button>}
                      <button style={{ ...btnGhost, padding: '3px 8px', fontSize: 10 }} onClick={() => setEditCand(c)}>수정</button>
                      <button style={{ ...btnGhost, padding: '3px 8px', fontSize: 10 }} onClick={() => removeCandidate(c)}>삭제</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
      {showAddPos && <AddPositionModal onClose={() => setShowAddPos(false)} onCreated={() => { setShowAddPos(false); load() }} />}
      {showAddCand && s && <CandidateModal position={s} criteriaMap={criteriaMap} onClose={() => setShowAddCand(false)} onSaved={() => { setShowAddCand(false); load() }} />}
      {editCand && s && <CandidateModal position={s} candidate={editCand} criteriaMap={criteriaMap} onClose={() => setEditCand(null)} onSaved={() => { setEditCand(null); load() }} />}
      {hireCand && s && (
        <QuickAddHireModal
          initial={hireInitial(hireCand, s)}
          onClose={() => setHireCand(null)}
          onCreated={async (emp) => {
            const { error } = await supabase.from('recruit_candidates').update({ result: '입사확정', stage: '입사', hired_employee_id: emp?.id || null }).eq('id', hireCand.id)
            if (error) window.alert(`입사 등록은 됐지만 지원자 상태를 못 바꿨어요: ${error.message}`)
            setHireCand(null)
            navigate('/hire-resign')
          }}
        />
      )}
      {calcCand && (
        <CandidateModal
          positions={positions} initialCareer={calcCand} defaultPositionId={sel} criteriaMap={criteriaMap}
          onClose={() => setCalcCand(null)}
          onSaved={(positionId) => { setCalcCand(null); setSel(positionId); load() }}
        />
      )}
      {calcHire && (
        <QuickAddHireModal
          initial={hireInitial(calcHire, null)}
          onClose={() => setCalcHire(null)}
          onCreated={() => { setCalcHire(null); navigate('/hire-resign') }}
        />
      )}
    </div>
  )
}

function AddPositionModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ position: '', division: '', dept: '', team: '', locations: [], hire_type: '경력', level: '', status: '공고중', open_date: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error } = await supabase.from('recruit_positions').insert({ ...form, division: form.division || null, team: form.team || null })
    setSaving(false)
    if (error) { setError(error.message); return }
    onCreated()
  }

  return (
    <Modal title="채용 포지션 추가" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={lbl}>포지션명</label>
        <input style={field} required value={form.position} onChange={set('position')} />
        <label style={lbl}>위치</label>
        <LocationPicker value={form.locations} onChange={(v) => setForm({ ...form, locations: v })} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>{ORG_LEVEL_LABEL.division}</label><input style={field} value={form.division} onChange={set('division')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>{ORG_LEVEL_LABEL.dept}</label><input style={field} required value={form.dept} onChange={set('dept')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>{ORG_LEVEL_LABEL.team}</label><input style={field} value={form.team} onChange={set('team')} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>채용 유형</label>
            <select style={field} value={form.hire_type} onChange={set('hire_type')}>
              <option value="경력">경력</option><option value="신입">신입</option><option value="신입/경력">신입/경력</option>
            </select>
          </div>
          <div style={{ flex: 1 }}><label style={lbl}>레벨</label><input style={field} value={form.level} onChange={set('level')} placeholder="예: 대리~과장" /></div>
        </div>
        <label style={lbl}>공고 시작일</label>
        <input style={field} type="date" required value={form.open_date} onChange={set('open_date')} />
        <label style={lbl}>상태</label>
        <select style={field} value={form.status} onChange={set('status')}>
          <option value="공고중">공고중</option><option value="서류심사">서류심사</option><option value="면접진행">면접진행</option><option value="최종협의">최종협의</option><option value="마감">마감</option>
        </select>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" style={btnGhost} onClick={onClose}>취소</button>
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? '저장 중…' : '추가'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ═══ 학력·경력 → 예상 직급 계산 (학력 인정 기준·경력 인정 기준 + rank_criteria 체류연한 누적, src/lib/careerRank.js) ═══
const miniField = { ...field, padding: '7px 8px', fontSize: 12, marginBottom: 0 }

// 예전에 저장된 학력 값(학사/전문학사) → 학력 인정 기준표 이름으로
const LEGACY_EDU = { 학사: '4년제 대졸', 전문학사: '전문대졸' }

// 기간↔날짜 입력 전환 — 날짜로 계산된 기간은 "기간 입력"으로 넘어갈 때 그 값을 그대로 가져감
function modeSwitch(e, mode) {
  if (mode === 'period' && e.mode === 'date') {
    const m = entryMonths(e)
    return { mode, years: Math.floor(m / 12), months: m % 12 }
  }
  return { mode }
}

// v: { track, edu_level, edu_status, entries[] }
function CareerEditor({ v, set }) {
  const setEntry = (i, patch) => set({ ...v, entries: v.entries.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
  const statuses = eduStatuses(v.edu_level)
  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1.2 }}>
          <label style={lbl}>직군</label>
          <select style={field} value={v.track} onChange={(e) => set({ ...v, track: e.target.value })}>
            {TRACKS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>최종학력</label>
          <select style={field} value={v.edu_level} onChange={(e) => set({ ...v, edu_level: e.target.value, edu_status: '졸업' })}>
            <option value="">(미입력)</option>
            {EDU_LEVELS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div style={{ flex: 0.8 }}>
          <label style={lbl}>졸업/수료</label>
          <select style={field} value={statuses.includes(v.edu_status) ? v.edu_status : '졸업'} disabled={statuses.length < 2} onChange={(e) => set({ ...v, edu_status: e.target.value })}>
            {(statuses.length ? statuses : ['졸업']).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      </div>

      <label style={lbl}>경력 (회사별로 입력 — 직무 유사도 상 100% · 중 80% · 하 50%)</label>
      {v.entries.map((e, i) => {
        const j = judgeEntry(e)
        return (
          <div key={i} style={{ border: '1px solid #f1f5f9', borderRadius: 8, padding: 8, marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input style={{ ...miniField, flex: 1 }} placeholder="회사명" value={e.company} onChange={(ev) => setEntry(i, { company: ev.target.value })} />
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                {[['period', '기간 입력'], ['date', '날짜 입력']].map(([m, t]) => (
                  <button key={m} type="button" onClick={() => setEntry(i, modeSwitch(e, m))}
                    style={{ border: 'none', padding: '6px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 600, background: (e.mode || 'period') === m ? P : '#fff', color: (e.mode || 'period') === m ? '#fff' : '#64748b' }}>{t}</button>
                ))}
              </div>
              <button type="button" title="삭제" onClick={() => set({ ...v, entries: v.entries.filter((_, k) => k !== i) })} style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              {e.mode === 'date' ? (
                <>
                  <input style={{ ...miniField, width: 130 }} type="month" placeholder="YYYY-MM" value={e.start || ''} onChange={(ev) => setEntry(i, { start: ev.target.value })} />
                  <span style={{ fontSize: 11 }}>~</span>
                  <input style={{ ...miniField, width: 130 }} type="month" placeholder="YYYY-MM" disabled={e.ongoing} value={e.ongoing ? thisMonth() : e.end || ''} onChange={(ev) => setEntry(i, { end: ev.target.value })} />
                  <label style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!e.ongoing} onChange={(ev) => setEntry(i, { ongoing: ev.target.checked })} /> 재직중
                  </label>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginLeft: 'auto' }}>= {careerLabel(j.raw)}</span>
                </>
              ) : (
                <>
                  <input style={{ ...miniField, width: 60 }} type="number" min="0" value={e.years} onChange={(ev) => setEntry(i, { years: ev.target.value })} /><span style={{ fontSize: 11 }}>년</span>
                  <input style={{ ...miniField, width: 60 }} type="number" min="0" max="11" value={e.months} onChange={(ev) => setEntry(i, { months: ev.target.value })} /><span style={{ fontSize: 11 }}>개월</span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
              <select style={{ ...miniField, flex: 1.3 }} value={e.type} onChange={(ev) => setEntry(i, { type: ev.target.value })}>
                {CAREER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select style={{ ...miniField, flex: 1 }} value={e.similarity} onChange={(ev) => setEntry(i, { similarity: ev.target.value })}>
                {SIMILARITY.map((x) => <option key={x.value} value={x.value}>유사도 {x.value} ({x.rate}%)</option>)}
              </select>
              <div style={{ flex: 1.4, fontSize: 11, textAlign: 'right', fontWeight: 600, color: j.ok ? G : '#dc2626' }}>
                {j.ok ? `인정 ${careerLabel(j.months)}` : `불인정 (${j.reason})`}
              </div>
            </div>
            {j.reason && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                <label style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!e.exception} onChange={(ev) => setEntry(i, { exception: ev.target.checked })} /> 예외 인정
                </label>
                <input style={{ ...miniField, flex: 1 }} placeholder="비고 (예외 인정 사유)" value={e.note} onChange={(ev) => setEntry(i, { note: ev.target.value })} />
              </div>
            )}
          </div>
        )
      })}
      <button type="button" style={{ ...btnGhost, padding: '5px 12px', fontSize: 11, marginBottom: 10 }} onClick={() => set({ ...v, entries: [...v.entries, newCareerEntry()] })}>+ 경력 추가</button>
    </>
  )
}

function CareerResult({ est }) {
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`)
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 12, lineHeight: 1.7 }}>
      <div style={{ color: '#475569' }}>
        인정 경력 {careerLabel(est.recMonths)} → <b>{est.careerYears}년</b>
        {est.eduYears !== 0 && <> · 학력 <b>{sign(est.eduYears)}년</b></>}
      </div>
      <div>
        인정 연차 <b>{est.total}년</b> → <b style={{ color: P, fontSize: 14 }}>{est.rank} {est.level}연차</b>
      </div>
      <div style={{ color: '#94a3b8', fontSize: 11 }}>
        {est.steps.map((st) => `${st.rank} ${st.years}년`).join(' → ')} (기준표 체류연한 누적 · 남는 개월은 1년으로 올림)
      </div>
    </div>
  )
}

const emptyCareer = (track = '사무') => ({ track, edu_level: '', edu_status: '졸업', entries: [newCareerEntry()] })

// 채용 탭 상단 — 저장 없이 바로 돌려보는 계산기
function CareerCalculator({ criteriaMap, onRegister, onHire }) {
  const [v, setV] = useState(emptyCareer())
  const est = calcCareer(v, criteriaMap)
  return (
    <div style={{ ...crd, marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🧮 학력·경력 → 직급 계산기</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12, lineHeight: 1.6 }}>
        학력 가감(박사 졸업 +4·수료 +3 / 석사 +2·+1 / 4년제 0 / 전문대 -1 / 고졸 -2) + 경력(유사도 상·중·하 100·80·50%, 프리랜서·개인사업자·인턴·6개월 미만은 불인정)을
        승진기준표 체류연한(사원 {criteriaMap['사원']?.req_tenure ?? '-'}년 · 대리 {criteriaMap['대리']?.req_tenure ?? '-'}년 …)에 쌓아서 직급·연차를 계산해요.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div>
          <label style={lbl}>이름</label>
          <input style={field} placeholder="지원자 이름 (등록할 때 그대로 들어가요)" value={v.name || ''} onChange={(e) => setV({ ...v, name: e.target.value })} />
          <CareerEditor v={v} set={setV} />
        </div>
        <div>
          <CareerResult est={est} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" style={btnGhost} onClick={() => onRegister(v)}>이 내용으로 지원자 등록</button>
            <button type="button" style={{ ...btnPrimary, background: G }} onClick={() => onHire(v)}>바로 입사 등록</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 계산기 값 → 입사 등록 화면에 넘길 지원자 모양 (저장 안 된 임시 값)
function candidateFromCalc(v, criteriaMap) {
  const est = calcCareer(v, criteriaMap)
  return {
    name: (v.name || '').trim(), track: v.track, edu_level: v.edu_level || null, edu_status: v.edu_status, edu_years: est.eduYears,
    career_months: Math.round(est.recMonths), est_rank: est.rank, est_level: est.level,
  }
}

// 저장된 지원자 → 편집용 경력 값 (career_entries가 없던 1차 버전 데이터는 총 경력 1건으로 변환)
function careerFromCandidate(c, defaultTrack) {
  let entries = Array.isArray(c.career_entries) && c.career_entries.length ? c.career_entries : null
  if (!entries && c.career_months > 0) {
    const sim = SIMILARITY.find((x) => x.rate === c.career_rate)?.value || '상'
    entries = [{ ...newCareerEntry(), years: Math.floor(c.career_months / 12), months: c.career_months % 12, similarity: sim }]
  }
  return {
    track: c.track || defaultTrack, edu_level: LEGACY_EDU[c.edu_level] || c.edu_level || '', edu_status: c.edu_status || '졸업',
    entries: entries || [newCareerEntry()],
  }
}

// position 없이 열리면(계산기에서 등록) 포지션을 고르는 칸이 나오고, initialCareer로 계산기 값을 그대로 가져옴
function CandidateModal({ position: fixedPosition, positions = [], defaultPositionId, initialCareer, candidate, criteriaMap, onClose, onSaved }) {
  const c = candidate || {}
  const [positionId, setPositionId] = useState(fixedPosition?.id || defaultPositionId || '')
  const position = fixedPosition || positions.find((p) => p.id === positionId) || null
  const [form, setForm] = useState({
    name: c.name || initialCareer?.name || '', stage: c.stage || '서류심사', result: c.result || '검토중',
    school: c.school || '', major: c.major || '', memo: c.memo || '',
  })
  const [career, setCareer] = useState(() => initialCareer || careerFromCandidate(c, suggestTrackForDept(position?.dept, false, position?.team)))
  const est = calcCareer(career, criteriaMap)
  // 직위·연차는 계산값을 따라가다가, 직접 고치면(override) 그 값을 유지
  const [override, setOverride] = useState(null)
  const rank = override?.rank ?? est.rank
  const level = override?.level ?? est.level
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!position) { setError('채용 포지션을 선택해주세요. (포지션이 없으면 먼저 "+ 포지션 추가")'); return }
    setSaving(true)
    const entries = career.entries
      .filter((x) => entryMonths(x) > 0 || (x.company || '').trim())
      .map((x) => {
        const m = entryMonths(x)
        return { ...x, company: (x.company || '').trim(), years: Math.floor(m / 12), months: m % 12, note: (x.note || '').trim() }
      })
    const row = {
      ...form, school: form.school.trim() || null, major: form.major.trim() || null, memo: form.memo.trim() || null,
      track: career.track, edu_level: career.edu_level || null, edu_status: career.edu_level ? (eduStatuses(career.edu_level).includes(career.edu_status) ? career.edu_status : '졸업') : null,
      edu_years: est.eduYears, career_entries: entries, career_months: Math.round(est.recMonths), career_rate: 100,
      est_rank: rank, est_level: Number(level) || 0,
    }
    const { error } = candidate
      ? await supabase.from('recruit_candidates').update(row).eq('id', candidate.id)
      : await supabase.from('recruit_candidates').insert({ ...row, position_id: position.id })
    setSaving(false)
    if (error) {
      setError(/column/i.test(error.message)
        ? `DB에 학력·경력 칸이 아직 없어요 — supabase/migrations/2026-10-28b_recruit_career_entries.sql을 먼저 실행해주세요. (${error.message})`
        : error.message)
      return
    }
    onSaved(position.id)
  }

  return (
    <Modal title={`${candidate ? '지원자 수정' : '지원자 추가'}${fixedPosition ? ` — ${fixedPosition.position}` : ''}`} onClose={onClose} width={560}>
      <form onSubmit={submit}>
        {!fixedPosition && (
          <>
            <label style={lbl}>채용 포지션</label>
            <select style={field} required value={positionId} onChange={(e) => setPositionId(e.target.value)}>
              <option value="" disabled>선택하세요</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.position}{orgPath(p) ? ` (${orgPath(p)})` : ''} · {p.status}</option>)}
            </select>
          </>
        )}
        <label style={lbl}>이름 (예: 김○○)</label>
        <input style={field} required value={form.name} onChange={set('name')} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>단계</label>
            <input style={field} required value={form.stage} onChange={set('stage')} placeholder="예: 서류심사 / 1차면접 / 처우협의" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>결과</label>
            <select style={field} value={form.result} onChange={set('result')}>
              {['검토중', '진행중', '통과', '합격대기', '탈락', '입사확정'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, margin: '6px 0 8px' }}>🎓 학력 · 💼 경력</div>
        <CareerEditor v={career} set={setCareer} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>학교</label><input style={field} value={form.school} onChange={set('school')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>전공</label><input style={field} value={form.major} onChange={set('major')} /></div>
        </div>
        <CareerResult est={est} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1.4 }}>
            <label style={lbl}>적용 직위 {override && <button type="button" onClick={() => setOverride(null)} style={{ border: 'none', background: 'none', color: B, fontSize: 11, cursor: 'pointer', padding: 0, marginLeft: 4 }}>계산값으로 되돌리기</button>}</label>
            <select style={field} value={rank} onChange={(e) => setOverride({ rank: e.target.value, level })}>
              {[...new Set([...ranksForTrack(career.track), rank])].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>연차</label>
            <input style={field} type="number" step="1" value={level} onChange={(e) => setOverride({ rank, level: e.target.value })} />
          </div>
        </div>
        {candidate?.est_rank && !override && (candidate.est_rank !== est.rank || (candidate.est_level ?? 0) !== est.level) && (
          <div style={{ fontSize: 11, color: '#b45309', marginTop: -6, marginBottom: 10 }}>
            이전에 저장된 값은 {candidate.est_rank} {candidate.est_level ?? 0}연차예요 — 저장하면 위 계산값으로 바뀝니다.{' '}
            <button type="button" onClick={() => setOverride({ rank: candidate.est_rank, level: candidate.est_level ?? 0 })} style={{ border: 'none', background: 'none', color: B, fontSize: 11, cursor: 'pointer', padding: 0 }}>이전 값 유지</button>
          </div>
        )}

        <label style={lbl}>메모</label>
        <input style={field} value={form.memo} onChange={set('memo')} placeholder="예: 이전 직장 직급, 처우 조건 등" />

        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" style={btnGhost} onClick={onClose}>취소</button>
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? '저장 중…' : candidate ? '저장' : '추가'}</button>
        </div>
      </form>
    </Modal>
  )
}

// 지원자 목록·입사 등록 화면에 보여줄 학력 한 줄 (예: "석사 수료 ○○대 전자공학")
function eduLabel(c) {
  const lv = LEGACY_EDU[c.edu_level] || c.edu_level
  if (!lv) return ''
  const st = eduStatuses(lv).length > 1 && c.edu_status ? ` ${c.edu_status}` : ''
  return [`${lv}${st}`, c.school, c.major].filter(Boolean).join(' ')
}

// 합격자 → 입사자 등록 화면에 미리 채울 값 (포지션의 소속·위치 + 지원자의 예상 직급·연차)
function hireInitial(c, position) {
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`)
  const note = [
    c.career_months > 0 ? `인정 경력 ${careerLabel(c.career_months)}` : '경력 없음',
    c.edu_level ? `${eduLabel(c)}${c.edu_years ? ` (${sign(c.edu_years)}년)` : ''}` : null,
  ].filter(Boolean).join(' · ') + (c.est_rank ? ` → ${c.est_rank} ${c.est_level ?? 0}연차` : '')
  return {
    name: c.name, division: position?.division, dept: position?.dept, team: position?.team, locations: position?.locations || [],
    rank: c.est_rank || '', track: c.track || suggestTrackForDept(position?.dept, false, position?.team), level: c.est_level ?? 0, note,
  }
}
