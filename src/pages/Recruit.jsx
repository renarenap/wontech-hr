import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { P, G, O, Y, B, ORG_LEVEL_LABEL, TRACKS, orgPath, suggestTrackForDept } from '../lib/constants'
import { fetchRankCriteria } from '../lib/promotion'
import { estimateRank, recognizedYears, ranksForTrack, careerLabel } from '../lib/careerRank'
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
  const [criteriaMap, setCriteriaMap] = useState(null)

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
      <CareerCalculator criteriaMap={criteriaMap} />
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
                const profile = [c.edu_level && [c.edu_level, c.school, c.major].filter(Boolean).join(' '), c.career_months > 0 ? `경력 ${careerLabel(c.career_months)}` : null].filter(Boolean).join(' · ')
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
            load()
          }}
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

// ═══ 경력 → 예상 직급 계산 (rank_criteria 체류연한 누적 기준, src/lib/careerRank.js) ═══
const EDU_LEVELS = ['고졸', '전문학사', '학사', '석사', '박사']

// 총 인정 연차 = 경력(개월 × 인정비율, 만 년수) + 학력 인정 연차
function calcCareer(v, criteriaMap) {
  const months = (Number(v.years) || 0) * 12 + (Number(v.months) || 0)
  const total = recognizedYears(months, v.rate) + Math.max(0, Number(v.edu_years) || 0)
  return { months, total, ...estimateRank(total, v.track, criteriaMap) }
}

function CareerFields({ v, set }) {
  const num = (k) => (e) => set({ ...v, [k]: e.target.value })
  return (
    <>
      <label style={lbl}>직군</label>
      <select style={field} value={v.track} onChange={num('track')}>
        {TRACKS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}><label style={lbl}>경력 (년)</label><input style={field} type="number" min="0" value={v.years} onChange={num('years')} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>+ 개월</label><input style={field} type="number" min="0" max="11" value={v.months} onChange={num('months')} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>인정비율 (%)</label><input style={field} type="number" min="0" max="100" value={v.rate} onChange={num('rate')} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>학력 인정 (년)</label><input style={field} type="number" min="0" value={v.edu_years} onChange={num('edu_years')} /></div>
      </div>
    </>
  )
}

function CareerResult({ est }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 12 }}>
      <div>
        인정 연차 <b>{est.total}년</b> → <b style={{ color: P, fontSize: 14 }}>{est.rank} {est.level}연차</b>
      </div>
      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>
        {est.steps.map((st) => `${st.rank} ${st.years}년`).join(' → ')} (기준표 체류연한 누적 · 남는 개월은 버림)
      </div>
    </div>
  )
}

const emptyCareer = (track = '사무') => ({ track, years: 0, months: 0, rate: 100, edu_years: 0 })

// 채용 탭 상단 — 저장 없이 바로 돌려보는 계산기
function CareerCalculator({ criteriaMap }) {
  const [v, setV] = useState(emptyCareer())
  const est = calcCareer(v, criteriaMap)
  return (
    <div style={{ ...crd, marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🧮 경력 → 직급 계산기</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
        경력 연차를 넣으면 승진기준표 체류연한(사원 {criteriaMap['사원']?.req_tenure ?? '-'}년 · 대리 {criteriaMap['대리']?.req_tenure ?? '-'}년 …)을 쌓아서 어느 직급 몇 연차인지 계산해요.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.2fr)', gap: 16, alignItems: 'end' }}>
        <div><CareerFields v={v} set={setV} /></div>
        <CareerResult est={est} />
      </div>
    </div>
  )
}

function CandidateModal({ position, candidate, criteriaMap, onClose, onSaved }) {
  const c = candidate || {}
  const defaultTrack = c.track || suggestTrackForDept(position.dept, false, position.team)
  const [form, setForm] = useState({
    name: c.name || '', stage: c.stage || '서류심사', result: c.result || '검토중',
    edu_level: c.edu_level || '', school: c.school || '', major: c.major || '', memo: c.memo || '',
  })
  const [career, setCareer] = useState({
    track: defaultTrack, years: Math.floor((c.career_months || 0) / 12), months: (c.career_months || 0) % 12,
    rate: c.career_rate ?? 100, edu_years: c.edu_years || 0,
  })
  const est = calcCareer(career, criteriaMap)
  // 직위·연차는 계산값을 따라가다가, 직접 고치면(override) 그 값을 유지
  const [override, setOverride] = useState(c.est_rank ? { rank: c.est_rank, level: c.est_level ?? 0 } : null)
  const rank = override?.rank ?? est.rank
  const level = override?.level ?? est.level
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    const row = {
      ...form, edu_level: form.edu_level || null, school: form.school.trim() || null, major: form.major.trim() || null, memo: form.memo.trim() || null,
      track: career.track, career_months: est.months, career_rate: Number(career.rate) || 0, edu_years: Math.max(0, Number(career.edu_years) || 0),
      est_rank: rank, est_level: Number(level) || 0,
    }
    const { error } = candidate
      ? await supabase.from('recruit_candidates').update(row).eq('id', candidate.id)
      : await supabase.from('recruit_candidates').insert({ ...row, position_id: position.id })
    setSaving(false)
    if (error) {
      setError(/column/i.test(error.message)
        ? `DB에 학력·경력 칸이 아직 없어요 — supabase/migrations/2026-10-28_recruit_candidate_profile.sql을 먼저 실행해주세요. (${error.message})`
        : error.message)
      return
    }
    onSaved()
  }

  return (
    <Modal title={`${candidate ? '지원자 수정' : '지원자 추가'} — ${position.position}`} onClose={onClose} width={460}>
      <form onSubmit={submit}>
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

        <div style={{ fontSize: 12, fontWeight: 700, margin: '6px 0 8px' }}>🎓 학력</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>최종학력</label>
            <select style={field} value={form.edu_level} onChange={set('edu_level')}>
              <option value="">(미입력)</option>
              {EDU_LEVELS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div style={{ flex: 1.3 }}><label style={lbl}>학교</label><input style={field} value={form.school} onChange={set('school')} /></div>
          <div style={{ flex: 1.3 }}><label style={lbl}>전공</label><input style={field} value={form.major} onChange={set('major')} /></div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, margin: '6px 0 8px' }}>💼 경력 → 예상 직급</div>
        <CareerFields v={career} set={setCareer} />
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

// 합격자 → 입사자 등록 화면에 미리 채울 값 (포지션의 소속·위치 + 지원자의 예상 직급·연차)
function hireInitial(c, position) {
  const edu = [c.edu_level, c.school, c.major].filter(Boolean).join(' ')
  const note = [
    c.career_months > 0 ? `경력 ${careerLabel(c.career_months)}${c.career_rate !== 100 ? ` (인정 ${c.career_rate}%)` : ''}` : '신입',
    c.edu_years > 0 ? `학력 인정 ${c.edu_years}년` : null,
    edu || null,
  ].filter(Boolean).join(' · ') + (c.est_rank ? ` → ${c.est_rank} ${c.est_level ?? 0}연차` : '')
  return {
    name: c.name, division: position.division, dept: position.dept, team: position.team, locations: position.locations || [],
    rank: c.est_rank || '', track: c.track || suggestTrackForDept(position.dept, false, position.team), level: c.est_level ?? 0, note,
  }
}
