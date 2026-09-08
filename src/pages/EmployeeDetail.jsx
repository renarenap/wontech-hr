import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { GRADE_COLOR, GRADE_HEIGHT, SIM_GRADE_POINTS, TRACK_LABEL, TRACKS, ORG_LEVEL_LABEL, orgPath, O, P, G, Y, R, B } from '../lib/constants'
import { deriveEmployee, fetchRankCriteria, fetchLeaveRate } from '../lib/promotion'
import { fetchEvalComments, addEvalComment, deleteEvalComment } from '../lib/evalComments'
import { fetchNoteEntries, addNoteEntry, deleteNoteEntry } from '../lib/noteEntries'
import {
  fetchCertEntries, addCertEntry, deleteCertEntry, CERT_CATEGORY_CAP, CERT_CATEGORY_DEFAULT_PTS, CERT_CATEGORIES,
  fetchTechEntries, addTechEntry, deleteTechEntry, TECH_CATEGORY_DEFAULT_PTS, TECH_CATEGORIES, TECH_TOTAL_CAP,
} from '../lib/certTech'
import { SB, Bd, NoteFlagBadge, LocationBadges, LocationPicker, Prog, TenureBar, Tip, crd, Loading, ErrorBox, Modal, field, label as lbl, btnPrimary, btnGhost } from '../components/ui'

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [raw, setRaw] = useState(null) // { employee, evals, rankCriteria, leaveRate } — 원본 데이터, 휴직 반영 토글 시 다시 계산하는 데 씀
  const [error, setError] = useState(null)
  const [sim, setSim] = useState('GD')
  const [showEdit, setShowEdit] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [includeLeave, setIncludeLeave] = useState(true) // false면 휴직기간 포인트·연차를 빼고 실제 근무 기록만으로 계산
  const [comments, setComments] = useState(null) // 정성평가 코멘트 이력(시계열) — employees 테이블과 별개로 따로 로드·갱신
  const [commentsError, setCommentsError] = useState(null)
  const [noteEntries, setNoteEntries] = useState(null) // 비고(근태 등 특이사항) 이력(시계열) — 마찬가지로 따로 로드·갱신
  const [noteEntriesError, setNoteEntriesError] = useState(null)
  const [certEntries, setCertEntries] = useState(null) // 자격가점 건별 이력 — 카테고리 상한 적용해 employees.cert_pts로 캐시됨
  const [certEntriesError, setCertEntriesError] = useState(null)
  const [techEntries, setTechEntries] = useState(null) // 기술성과 건별 이력 — 상한 적용해 employees.tech_pts로 캐시됨
  const [techEntriesError, setTechEntriesError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      setRaw(null)
      const [{ data: e, error: e1 }, { data: evals, error: e2 }, rankCriteria, leaveRate] = await Promise.all([
        supabase.from('employees').select('*').eq('id', id).single(),
        supabase.from('evaluations').select('*').eq('employee_id', id),
        fetchRankCriteria(),
        fetchLeaveRate(),
      ])
      if (cancelled) return
      if (e1 || e2) { setError(e1 || e2); return }
      setRaw({ employee: e, evals: evals || [], rankCriteria, leaveRate })
    }
    load().catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [id, refreshKey])

  const reloadComments = () => {
    fetchEvalComments(id).then(setComments).catch((err) => setCommentsError(err))
  }
  useEffect(() => { reloadComments() }, [id])

  const reloadNoteEntries = () => {
    fetchNoteEntries(id).then(setNoteEntries).catch((err) => setNoteEntriesError(err))
  }
  useEffect(() => { reloadNoteEntries() }, [id])

  // 자격가점/기술성과는 항목이 바뀔 때 employees.cert_pts·tech_pts(캐시값)도 같이 바뀌므로,
  // 이력 목록 새로고침과 함께 refreshKey로 상단 포인트 구성도 다시 불러옴
  const reloadCertEntries = () => {
    fetchCertEntries(id).then(setCertEntries).catch((err) => setCertEntriesError(err))
    setRefreshKey((k) => k + 1)
  }
  useEffect(() => { fetchCertEntries(id).then(setCertEntries).catch((err) => setCertEntriesError(err)) }, [id])

  const reloadTechEntries = () => {
    fetchTechEntries(id).then(setTechEntries).catch((err) => setTechEntriesError(err))
    setRefreshKey((k) => k + 1)
  }
  useEffect(() => { fetchTechEntries(id).then(setTechEntries).catch((err) => setTechEntriesError(err)) }, [id])

  // note_flag(+/-/o 요약)는 employees 테이블 필드라 여기서 바로 업데이트하고, 전체 새로고침(refreshKey)으로 반영
  const updateNoteFlag = async (flag) => {
    const { error: err } = await supabase.from('employees').update({ note_flag: flag }).eq('id', id)
    if (err) throw new Error(err.message)
    setRefreshKey((k) => k + 1)
  }

  // 어학 점수도 employees 테이블 필드라 마찬가지로 바로 업데이트 후 새로고침
  const updateLanguage = async (patch) => {
    const { error: err } = await supabase.from('employees').update(patch).eq('id', id)
    if (err) throw new Error(err.message)
    setRefreshKey((k) => k + 1)
  }

  // emp: 실제 저장된 값 그대로(휴직 포인트·연차 포함) — 수정 모달 초기값 등엔 항상 이걸 씀
  const emp = useMemo(() => raw && deriveEmployee(raw.employee, raw.evals, raw.rankCriteria, raw.leaveRate), [raw])
  // view: 화면에 실제로 보여줄 값 — "휴직기간 반영" 토글을 끄면 휴직연차를 0으로 놓고 다시 계산해서
  // 실제 근무 경력연차·실제 평가결과만 딱 나오게 함(휴직중 여부 자체는 시작·종료일 기준이라 토글과 무관하게 그대로 유지됨)
  const view = useMemo(() => {
    if (!raw) return null
    if (includeLeave) return emp
    return deriveEmployee({ ...raw.employee, leave_years: 0 }, raw.evals, raw.rankCriteria, raw.leaveRate)
  }, [raw, emp, includeLeave])

  if (error) return <ErrorBox error={error} />
  if (!view) return <Loading />

  const sp = SIM_GRADE_POINTS
  const proj = view.currentPts + (sp[sim] || 6)
  const pg = Math.max(0, view.threshold - proj)
  const fl = { fontSize: 11, color: '#64748b', marginBottom: 4 }
  const fv = { fontSize: 14, fontWeight: 600 }

  const breakdown = [
    {
      l: '평가 포인트', v: view.evalPts, c: O,
      note: `현재 직급 기준 최근 ${Math.max(0, ((view.level || 0) - 1) * 2)}건(반기 환산)만 반영 — 이전 직급 때 평가나 그 이전 기록은 승진 시 이미 반영된 것으로 보고 제외됩니다.`,
    },
    { l: '경력인정 포인트', v: view.backfillPts || 0, c: P },
    { l: '휴직 포인트', v: view.leavePts || 0, c: B },
    { l: '전문/직무 자격 가점', v: view.cert_pts || 0, c: '#6366f1' },
    { l: '기술성과 가점', v: view.tech_pts || 0, c: '#8b5cf6' },
    { l: '포상 가점', v: view.award_pts || 0, c: '#ca8a04' },
    { l: '어학 가점 (영어+중국어+일본어)', v: (view.eng_pts || 0) + (view.cn_pts || 0) + (view.jp_pts || 0), c: '#0284c7' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 16px', color: '#64748b', fontSize: 12, cursor: 'pointer' }}
        >
          ← 목록으로
        </button>
        <button style={btnGhost} onClick={() => setShowEdit(true)}>✏️ 수정</button>
      </div>

      <div style={{ ...crd, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{view.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <LocationBadges locations={view.locations} />
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {orgPath(view)}{view.role ? ` · ${view.role}` : ''}{view.join_date ? ` · 입사 ${view.join_date}` : ''}
              </div>
            </div>
            {view.leave_start_date && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span>🌿 휴직 {view.leave_start_date} ~ {view.leave_end_date || '(진행중)'}</span>
                {emp.leaveYears > 0 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: '#64748b' }}>
                    <input type="checkbox" checked={includeLeave} onChange={(ev) => setIncludeLeave(ev.target.checked)} />
                    휴직기간 포인트·연차 반영
                  </label>
                )}
              </div>
            )}
            {(noteEntries?.[0] || view.note_flag !== 'o') && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <NoteFlagBadge flag={view.note_flag} /> {noteEntries?.[0]?.text}
              </div>
            )}
          </div>
          <SB status={view.status} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div style={fl}>직급</div>
            <div style={fv}>{view.rank} {view.effectiveLevel}{view.role && <span style={{ color: '#94a3b8', fontWeight: 600 }}> · {view.role}</span>}</div>
          </div>
          <div><div style={fl}>직군</div><div style={fv}>{TRACK_LABEL[view.track] || view.track}</div></div>
          {view.hasCriteria ? (
            <>
              <div>
                <div style={fl}>체류연한{view.leaveYears > 0 ? ` (근무 ${view.level || 0}년 + 휴직 ${view.leaveYears}년)` : ''}</div>
                <div style={fv}><TenureBar level={view.effectiveLevel} reqTenure={view.req_tenure} /></div>
              </div>
              <div><div style={fl}>진급 기준</div><div style={fv}>{view.threshold}P</div></div>
            </>
          ) : (
            <div style={{ gridColumn: 'span 2' }}><div style={fl}>승진포인트 기준</div><div style={{ ...fv, color: '#94a3b8' }}>해당없음 (임원/부장/수석연구원은 별도 승진 기준을 두지 않음)</div></div>
          )}
        </div>
        {(view.engGated || view.eng_pts > 0 || view.cn_pts > 0 || view.jp_pts > 0) && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            <div style={fl}>어학 (포인트 합계에 포함 + 사무직 외국어필수 과장·차장 필수요건 겸용)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                영어 {view.eng_pts || 0}P{view.eng_lifetime ? ' · 평생인정' : ''}
              </span>
              {view.cn_pts > 0 && (
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  중국어 {view.cn_pts}P{view.cn_lifetime ? ' · 평생인정' : ''}
                </span>
              )}
              {view.jp_pts > 0 && (
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  일본어 {view.jp_pts}P{view.jp_lifetime ? ' · 평생인정' : ''}
                </span>
              )}
              {view.engGated && (
                <>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>승진요건(Im3 이상):</span>
                  <Bd color={view.engOk ? G : '#c026d3'} bg={view.engOk ? '#dcfce7' : '#fae8ff'}>
                    {view.engOk ? '✅ 충족' : '❌ 미충족'}
                  </Bd>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {!includeLeave && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#1e40af', marginBottom: 16, lineHeight: 1.6 }}>
          ℹ️ 지금은 휴직기간에 쌓인 포인트·연차를 빼고, <b>실제 근무 경력({view.level || 0}년)</b>과 <b>실제 평가 결과</b>만으로 계산한 값을 보고 있어요.
        </div>
      )}

      {view.leavePts > 0 && (
        <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#854d0e', marginBottom: 16, lineHeight: 1.6 }}>
          ⚠️ 이 총점(<b>{view.currentPts}P</b>)에는 <b>휴직 포인트 {view.leavePts}P</b>가 포함돼 있어요 — 휴직자 포인트 정책은 아직 확정되지 않았으니, 승진 여부를 최종 판단하실 땐 이 부분 감안해주세요.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={crd}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📊 평가 이력</div>
          {view.evalWindow.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>평가 이력이 없습니다</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, padding: '0 8px', marginBottom: 10 }}>
                {view.evalWindow.map((h) => {
                  const height = (GRADE_HEIGHT[h.grade] || 0) * 10
                  const color = GRADE_COLOR[h.grade] || '#e2e8f0'
                  return (
                    <div key={h.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: h.counted ? color : '#94a3b8' }}>{h.grade}</span>
                      <div
                        style={{
                          width: 32, height, borderRadius: 5,
                          ...(h.counted
                            ? { background: color }
                            : { background: `${color}1a`, border: `1px dashed ${color}` }),
                        }}
                      />
                      <span style={{ fontSize: 9, color: '#94a3b8' }}>{h.period}</span>
                    </div>
                  )
                })}
              </div>
              {view.evalWindow.some((h) => !h.counted) && (
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10 }}>
                  점선 = 이전 직급 때 평가 등, 지금 승진포인트 계산에는 반영되지 않음
                </div>
              )}
            </>
          )}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: 12 }}>평가 포인트 합계</span>
            <span style={{ color: O, fontWeight: 700, fontSize: 14 }}>{view.evalPts}P</span>
          </div>
        </div>

        <div style={crd}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>🏅 포인트 구성</div>
          {breakdown.map(({ l, v, c, note }) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: c }} />
                <span style={{ fontSize: 12, color: '#64748b' }}><Tip content={note}>{l}</Tip></span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: v > 0 ? c : '#d1d5db' }}>{v}P</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>총 승진포인트</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: O }}>{view.currentPts}P</span>
          </div>
          {view.hasCriteria ? (
            <div style={{ marginTop: 8 }}><Prog current={view.currentPts} max={view.threshold} /></div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>승진포인트 추적 대상이 아니에요.</div>
          )}
        </div>
      </div>

      {view.hasCriteria && (
      <div style={crd}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🔮 2026 시뮬레이션</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>26년 예상 등급 :</span>
          {['EX', 'VG', 'GD', 'NI'].map((g) => (
            <button
              key={g} onClick={() => setSim(g)}
              style={{ padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: sim === g ? '#fff' : '#64748b', background: sim === g ? P : '#f1f5f9' }}
            >
              {g}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            { l: '추가', v: `+${sp[sim]}P`, c: P },
            { l: '예상 총', v: `${proj}P`, c: proj >= view.threshold ? G : Y },
            { l: '잔여', v: pg > 0 ? `-${pg}P` : '✅ 충족', c: pg > 0 ? R : G },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ background: '#f8fafc', borderRadius: 10, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      )}

      <LanguageSection
        eng_pts={view.eng_pts} eng_lifetime={view.eng_lifetime}
        cn_pts={view.cn_pts} cn_lifetime={view.cn_lifetime}
        jp_pts={view.jp_pts} jp_lifetime={view.jp_lifetime}
        onSave={updateLanguage}
      />

      <CertSection
        employeeId={id}
        entries={certEntries}
        entriesError={certEntriesError}
        onChanged={reloadCertEntries}
      />

      <TechSection
        employeeId={id}
        entries={techEntries}
        entriesError={techEntriesError}
        onChanged={reloadTechEntries}
      />

      <QualitativeReviewSection
        employeeId={id}
        noteFlag={view.note_flag}
        onFlagChanged={updateNoteFlag}
        noteEntries={noteEntries}
        noteEntriesError={noteEntriesError}
        onNoteEntriesChanged={reloadNoteEntries}
        comments={comments}
        commentsError={commentsError}
        onCommentsChanged={reloadComments}
      />

      {showEdit && (
        <EditEmployeeModal
          employee={emp}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); setRefreshKey((k) => k + 1) }}
        />
      )}
    </div>
  )
}

// ═══ 직원 정보 수정 — CSV 없이 이 화면에서 바로 고칠 수 있게 ═══
function EditEmployeeModal({ employee, onClose, onSaved }) {
  const e = employee
  const [form, setForm] = useState({
    name: e.name || '',
    join_date: e.join_date || '',
    locations: e.locations || [],
    division: e.division || '',
    dept: e.dept || '',
    team: e.team || '',
    rank: e.rank || '',
    role: e.role || '',
    track: e.track || '사무',
    level: e.level ?? 0,
    leave_start_date: e.leave_start_date || '',
    leave_end_date: e.leave_end_date || '',
    leave_years: e.leave_years ?? 0,
    backfill_full_tenure: !!e.backfill_full_tenure,
    award_pts: e.award_pts ?? 0,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (ev) => setForm({ ...form, [k]: ev.target.value })
  const setChecked = (k) => (ev) => setForm({ ...form, [k]: ev.target.checked })

  const submit = async (ev) => {
    ev.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('이름이 비어있어요'); return }
    if (!form.division && !form.dept && !form.team) { setError(`${ORG_LEVEL_LABEL.division}/${ORG_LEVEL_LABEL.dept}/${ORG_LEVEL_LABEL.team} 중 최소 하나는 있어야 해요`); return }
    if (!form.rank.trim()) { setError('직급이 비어있어요'); return }
    setSaving(true)
    // 휴직시작·종료일이 둘 다 있으면 그걸로 휴직연차를 자동 계산(우선), 없으면 휴직연차 칸을 그대로 씀
    const autoLeaveYears = monthsBetween(form.leave_start_date, form.leave_end_date)
    const patch = {
      name: form.name.trim(),
      join_date: form.join_date || null,
      locations: form.locations,
      division: form.division.trim() || null,
      dept: form.dept.trim() || null,
      team: form.team.trim() || null,
      rank: form.rank.trim(),
      role: form.role.trim() || null,
      track: form.track,
      level: Number(form.level) || 0,
      leave_start_date: form.leave_start_date || null,
      leave_end_date: form.leave_end_date || null,
      leave_years: autoLeaveYears !== null ? autoLeaveYears / 12 : Number(form.leave_years) || 0,
      backfill_full_tenure: form.backfill_full_tenure,
      award_pts: Number(form.award_pts) || 0,
    }
    const { error: err } = await supabase.from('employees').update(patch).eq('id', e.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <Modal title={`${e.name} 정보 수정`} onClose={onClose} width={520}>
      <form onSubmit={submit}>
        <label style={lbl}>이름</label>
        <input style={field} required value={form.name} onChange={set('name')} />

        <label style={lbl}>입사일</label>
        <input style={field} type="date" value={form.join_date} onChange={set('join_date')} />

        <label style={lbl}>위치</label>
        <LocationPicker value={form.locations} onChange={(v) => setForm({ ...form, locations: v })} />

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>{ORG_LEVEL_LABEL.division}</label><input style={field} value={form.division} onChange={set('division')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>{ORG_LEVEL_LABEL.dept}</label><input style={field} value={form.dept} onChange={set('dept')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>{ORG_LEVEL_LABEL.team}</label><input style={field} value={form.team} onChange={set('team')} /></div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>직급</label><input style={field} required value={form.rank} onChange={set('rank')} /></div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>직군</label>
            <select style={field} value={form.track} onChange={set('track')}>
              {TRACKS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}><label style={lbl}>연차</label><input style={field} type="number" value={form.level} onChange={set('level')} /></div>
        </div>

        <label style={lbl}>직책 (팀장·본부장·부문장 등, 없으면 비워두세요)</label>
        <input style={field} value={form.role} onChange={set('role')} />

        <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.backfill_full_tenure} onChange={setChecked('backfill_full_tenure')} />
          경력직 인정포인트 적용 (7월 2일 이후 입사자=당해년도 평가 미대상자 일 경우체크)
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>휴직시작일</label><input style={field} type="date" value={form.leave_start_date} onChange={set('leave_start_date')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>휴직종료일</label><input style={field} type="date" value={form.leave_end_date} onChange={set('leave_end_date')} /></div>
        </div>
        {monthsBetween(form.leave_start_date, form.leave_end_date) === null && (
          <div>
            <label style={lbl}>휴직 연차 (시작·종료일 없을 때만 직접 입력, 예: 1.25 = 1년 3개월)</label>
            <input style={field} type="number" step="0.01" value={form.leave_years} onChange={set('leave_years')} />
          </div>
        )}

        <label style={lbl}>포상가점</label>
        <input style={field} type="number" step="0.5" value={form.award_pts} onChange={set('award_pts')} />

        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
          어학·자격가점·기술성과는 상세화면의 "어학"·"자격증"·"기술성과" 카드에서, 비고(+/−/o)와 정성평가 코멘트
          이력은 "승진리스트 검토 참고사항"에서 각각 직접 등록·수정해주세요.
        </div>

        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" style={btnGhost} onClick={onClose}>취소</button>
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </form>
    </Modal>
  )
}

// 날짜+텍스트가 계속 쌓이는 시계열 로그 UI — 비고(근태 등 특이사항)와 정성평가 코멘트 둘 다 이 모양이라 공용화함
function TimelineLog({ entries, entriesError, dateKey, onAdd, onDelete, placeholder, emptyLabel }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (ev) => {
    ev.preventDefault()
    if (!text.trim()) return
    setSaving(true); setErr('')
    try {
      await onAdd(date, text.trim())
      setText('')
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('이 항목을 삭제할까요?')) return
    try {
      await onDelete(id)
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <div>
      {entries === null ? (
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>불러오는 중…</div>
      ) : entries.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{emptyLabel}</div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {entries.map((row) => (
            <div key={row.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', minWidth: 78, paddingTop: 2 }}>{row[dateKey]}</div>
              <div style={{ flex: 1, fontSize: 13, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{row.text}</div>
              <button
                type="button" onClick={() => remove(row.id)} title="삭제"
                style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13, padding: 0 }}
              >✕</button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input
          type="date" value={date} onChange={(ev) => setDate(ev.target.value)}
          style={{ ...field, marginBottom: 0, width: 140, flexShrink: 0 }}
        />
        <textarea
          value={text} onChange={(ev) => setText(ev.target.value)}
          placeholder={placeholder}
          style={{ ...field, marginBottom: 0, flex: 1, minHeight: 38, resize: 'vertical', fontFamily: 'inherit' }}
        />
        <button type="submit" style={{ ...btnPrimary, flexShrink: 0 }} disabled={saving || !text.trim()}>
          {saving ? '추가 중…' : '추가'}
        </button>
      </form>
      {(err || entriesError) && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{err || entriesError?.message}</div>}
    </div>
  )
}

// 어학 카드에서 다루는 3개 언어 — 각각 점수(0.5~4P, 기준표 참고)와 평생인정 여부를 따로 관리
const LANGUAGES = [
  { key: 'eng', label: '영어' },
  { key: 'cn', label: '중국어' },
  { key: 'jp', label: '일본어' },
]

// ═══ 어학 — 영어/중국어/일본어 점수·평생인정 여부. 값을 바꾸면 선택만 되고, "저장"을 눌러야 실제 반영됨.
// 배점 기준(AL/IH/IM3/IM2/IM1 → 4/3/2/1/0.5P)은 기준표 화면에 참고용으로만 실어두고, 여기선 그냥 결과 점수만 입력받음.
// (말하기 시험 외 기타 외국어 시험은 직무자격과 같은 배점이라 "자격증" 카드에 직무자격으로 등록해주세요.) ═══
function LanguageSection({ eng_pts, eng_lifetime, cn_pts, cn_lifetime, jp_pts, jp_lifetime, onSave }) {
  const initial = {
    eng_pts: eng_pts || 0, eng_lifetime: !!eng_lifetime,
    cn_pts: cn_pts || 0, cn_lifetime: !!cn_lifetime,
    jp_pts: jp_pts || 0, jp_lifetime: !!jp_lifetime,
  }
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { setForm(initial) }, [eng_pts, eng_lifetime, cn_pts, cn_lifetime, jp_pts, jp_lifetime]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(form) !== JSON.stringify(initial)

  const save = async () => {
    setSaving(true); setErr(''); setSaved(false)
    try {
      await onSave({
        eng_pts: Number(form.eng_pts) || 0, eng_lifetime: form.eng_lifetime,
        cn_pts: Number(form.cn_pts) || 0, cn_lifetime: form.cn_lifetime,
        jp_pts: Number(form.jp_pts) || 0, jp_lifetime: form.jp_lifetime,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={crd}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🌐 어학</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>
        승진포인트 합산 + 사무직(외국어필수) 과장·차장 필수요건(Im3=2점 이상 또는 평생인정) 판정에 같이 쓰여요.
        배점 기준(등급별 점수)은 기준표 화면을 참고해주세요.
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {LANGUAGES.map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div>
              <label style={{ ...lbl, marginTop: 0 }}>{label}점수</label>
              <input
                style={{ ...field, marginBottom: 0, width: 90 }} type="number" step="0.5"
                value={form[`${key}_pts`]} onChange={(ev) => setForm({ ...form, [`${key}_pts`]: ev.target.value })}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, paddingBottom: 10 }}>
              <input
                type="checkbox" checked={form[`${key}_lifetime`]}
                onChange={(ev) => setForm({ ...form, [`${key}_lifetime`]: ev.target.checked })}
              /> AL/IH 평생인정
            </label>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}>
          <button
            type="button" onClick={save} disabled={!dirty || saving}
            style={{
              padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: dirty ? 'pointer' : 'default',
              border: 'none', background: dirty ? P : '#e2e8f0', color: dirty ? '#fff' : '#94a3b8',
            }}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
          {saved && <span style={{ color: G, fontSize: 11, fontWeight: 600 }}>✓ 저장됨</span>}
          {err && <span style={{ color: '#dc2626', fontSize: 11 }}>{err}</span>}
        </div>
      </div>
    </div>
  )
}

// ═══ 자격 가점 — 전문자격(건당3P·최대6P)/직무자격(건당1P·최대3P)을 건별로 입력받아 카테고리 상한 자동 적용 ═══
function CertSection({ employeeId, entries, entriesError, onChanged }) {
  const [category, setCategory] = useState(CERT_CATEGORIES[0])
  const [name, setName] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [points, setPoints] = useState(CERT_CATEGORY_DEFAULT_PTS[CERT_CATEGORIES[0]])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const changeCategory = (cat) => { setCategory(cat); setPoints(CERT_CATEGORY_DEFAULT_PTS[cat]) }

  const submit = async (ev) => {
    ev.preventDefault()
    if (!name.trim()) return
    setSaving(true); setErr('')
    try {
      await addCertEntry(employeeId, { category, name: name.trim(), valid_until: validUntil, points: Number(points) || 0 })
      setName(''); setValidUntil('')
      onChanged()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (entryId) => {
    if (!window.confirm('이 항목을 삭제할까요?')) return
    try {
      await deleteCertEntry(entryId, employeeId)
      onChanged()
    } catch (e) {
      setErr(e.message)
    }
  }

  const byCat = {}
  ;(entries || []).forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.points || 0) })

  return (
    <div style={crd}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🎓 자격증</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>
        전문자격: 건당 3P(최대 6P) · 직무 유관 자격: 건당 1P(최대 3P) — 카테고리 상한을 넘을 경우는 반영되지 않습니다.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {CERT_CATEGORIES.map((cat) => (
          <div key={cat}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{cat}</div>
            <Prog current={Math.min(byCat[cat] || 0, CERT_CATEGORY_CAP[cat])} max={CERT_CATEGORY_CAP[cat]} />
          </div>
        ))}
      </div>

      {entries === null ? (
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>불러오는 중…</div>
      ) : entries.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>등록된 자격증이 없습니다</div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {entries.map((row) => (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
              <Bd color="#6366f1" bg="#eef2ff">{row.category}</Bd>
              <div style={{ flex: 1, fontSize: 13, color: '#334155' }}>{row.name}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', minWidth: 90 }}>{row.valid_until ? `~${row.valid_until}` : '평생인정'}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', minWidth: 32, textAlign: 'right' }}>{row.points}P</div>
              <button
                type="button" onClick={() => remove(row.id)} title="삭제"
                style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13, padding: 0 }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ ...lbl, marginTop: 0 }}>구분</label>
          <select style={{ ...field, marginBottom: 0, width: 100 }} value={category} onChange={(ev) => changeCategory(ev.target.value)}>
            {CERT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={{ ...lbl, marginTop: 0 }}>자격증명</label>
          <input style={{ ...field, marginBottom: 0 }} value={name} onChange={(ev) => setName(ev.target.value)} placeholder="예: 정보처리기사" />
        </div>
        <div>
          <label style={{ ...lbl, marginTop: 0 }}>유효기간(비우면 평생인정)</label>
          <input style={{ ...field, marginBottom: 0, width: 150 }} type="date" value={validUntil} onChange={(ev) => setValidUntil(ev.target.value)} />
        </div>
        <div>
          <label style={{ ...lbl, marginTop: 0 }}>점수</label>
          <input style={{ ...field, marginBottom: 0, width: 70 }} type="number" step="0.5" value={points} onChange={(ev) => setPoints(ev.target.value)} />
        </div>
        <button type="submit" style={{ ...btnPrimary, flexShrink: 0 }} disabled={saving || !name.trim()}>
          {saving ? '추가 중…' : '추가'}
        </button>
      </form>
      {(err || entriesError) && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{err || entriesError?.message}</div>}
    </div>
  )
}

// ═══ 기술성과 — 특허/논문(국내2P·해외3P)을 건별로 입력받아 전체 상한(최대6P) 자동 적용 ═══
function TechSection({ employeeId, entries, entriesError, onChanged }) {
  const [category, setCategory] = useState(TECH_CATEGORIES[0])
  const [name, setName] = useState('')
  const [achievedDate, setAchievedDate] = useState('')
  const [points, setPoints] = useState(TECH_CATEGORY_DEFAULT_PTS[TECH_CATEGORIES[0]])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const changeCategory = (cat) => { setCategory(cat); setPoints(TECH_CATEGORY_DEFAULT_PTS[cat]) }

  const submit = async (ev) => {
    ev.preventDefault()
    if (!name.trim()) return
    setSaving(true); setErr('')
    try {
      await addTechEntry(employeeId, { category, name: name.trim(), achieved_date: achievedDate, points: Number(points) || 0 })
      setName(''); setAchievedDate('')
      onChanged()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (entryId) => {
    if (!window.confirm('이 항목을 삭제할까요?')) return
    try {
      await deleteTechEntry(entryId, employeeId)
      onChanged()
    } catch (e) {
      setErr(e.message)
    }
  }

  const total = (entries || []).reduce((s, e) => s + Number(e.points || 0), 0)

  return (
    <div style={crd}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🔬 기술성과 (특허·논문)</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>
        국내 특허·논문: 건당 2P · 해외·국제 특허·논문: 건당 3P(합계 최대 6P) — 상한을 넘을 경우는 반영되지 않습니다.
      </div>

      <div style={{ marginBottom: 16 }}>
        <Prog current={Math.min(total, TECH_TOTAL_CAP)} max={TECH_TOTAL_CAP} />
      </div>

      {entries === null ? (
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>불러오는 중…</div>
      ) : entries.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>등록된 기술성과가 없습니다</div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {entries.map((row) => (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
              <Bd color="#8b5cf6" bg="#f5f3ff">{row.category}</Bd>
              <div style={{ flex: 1, fontSize: 13, color: '#334155' }}>{row.name}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', minWidth: 90 }}>{row.achieved_date || ''}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8b5cf6', minWidth: 32, textAlign: 'right' }}>{row.points}P</div>
              <button
                type="button" onClick={() => remove(row.id)} title="삭제"
                style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13, padding: 0 }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ ...lbl, marginTop: 0 }}>구분</label>
          <select style={{ ...field, marginBottom: 0, width: 110 }} value={category} onChange={(ev) => changeCategory(ev.target.value)}>
            {TECH_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={{ ...lbl, marginTop: 0 }}>특허/논문명</label>
          <input style={{ ...field, marginBottom: 0 }} value={name} onChange={(ev) => setName(ev.target.value)} placeholder="예: OOO 장치" />
        </div>
        <div>
          <label style={{ ...lbl, marginTop: 0 }}>등록/게재일</label>
          <input style={{ ...field, marginBottom: 0, width: 150 }} type="date" value={achievedDate} onChange={(ev) => setAchievedDate(ev.target.value)} />
        </div>
        <div>
          <label style={{ ...lbl, marginTop: 0 }}>점수</label>
          <input style={{ ...field, marginBottom: 0, width: 70 }} type="number" step="0.5" value={points} onChange={(ev) => setPoints(ev.target.value)} />
        </div>
        <button type="submit" style={{ ...btnPrimary, flexShrink: 0 }} disabled={saving || !name.trim()}>
          {saving ? '추가 중…' : '추가'}
        </button>
      </form>
      {(err || entriesError) && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{err || entriesError?.message}</div>}
    </div>
  )
}

// 비고 +/−/o 요약 선택기 — 버튼 클릭은 "선택"만 하고, 실수로 바로 저장되지 않게 별도 "저장" 버튼을 눌러야 실제 반영됨
function NoteFlagEditor({ noteFlag, onSave }) {
  const [selected, setSelected] = useState(noteFlag)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { setSelected(noteFlag) }, [noteFlag]) // 서버에서 새로 불러온 값(저장 성공 후 등)으로 동기화

  const dirty = selected !== noteFlag

  const save = async () => {
    setSaving(true); setErr(''); setSaved(false)
    try {
      await onSave(selected)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 4 }}>
        {['+', 'o', '-'].map((f) => (
          <button
            key={f} type="button" onClick={() => setSelected(f)} title={f === '+' ? '긍정' : f === '-' ? '부정(근태 등 문제)' : '특이사항 없음'}
            style={{
              width: 26, height: 26, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              border: f === selected ? '2px solid #334155' : '1px solid var(--border)',
              background: f === selected ? '#f1f5f9' : '#fff', color: '#475569',
            }}
          >
            {f === '-' ? '−' : f}
          </button>
        ))}
      </div>
      <button
        type="button" onClick={save} disabled={!dirty || saving}
        style={{
          padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: dirty ? 'pointer' : 'default',
          border: 'none', background: dirty ? P : '#e2e8f0', color: dirty ? '#fff' : '#94a3b8',
        }}
      >
        {saving ? '저장 중…' : '저장'}
      </button>
      {saved && <span style={{ color: G, fontSize: 11, fontWeight: 600 }}>✓ 저장됨</span>}
      {err && <span style={{ color: '#dc2626', fontSize: 11 }}>{err}</span>}
    </>
  )
}

// ═══ 승진리스트 검토 참고사항 — 포인트 계산엔 안 들어가지만 승진후보 뽑을 때 같이 봐야 할 정성적 정보 ═══
// - 비고: 근태 등 특이사항. 목록에 뜨는 +/−/o 요약은 여기서 바로 바꾸고, 상세 내용은 정성평가처럼 계속 이어지는 로그
// - 정성평가 코멘트 이력: 문제 생길 때마다 날짜 찍어 바로 이 화면에서 추가 → 계속 이어지는 시계열 로그
function QualitativeReviewSection({
  employeeId, noteFlag, onFlagChanged,
  noteEntries, noteEntriesError, onNoteEntriesChanged,
  comments, commentsError, onCommentsChanged,
}) {
  return (
    <div style={crd}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📌 승진리스트 검토 참고사항</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>
        승진포인트 계산엔 반영되지 않는 정성적 판단 근거예요 — 승진후보를 뽑을 때 같이 참고해주세요.
      </div>

      <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>비고 (근태 등 특이사항) — 목록 요약</span>
          <NoteFlagEditor noteFlag={noteFlag} onSave={onFlagChanged} />
        </div>
        <TimelineLog
          entries={noteEntries} entriesError={noteEntriesError} dateKey="entry_date"
          onAdd={async (date, text) => { await addNoteEntry(employeeId, date, text); onNoteEntriesChanged() }}
          onDelete={async (id) => { await deleteNoteEntry(id); onNoteEntriesChanged() }}
          placeholder="지각·징계 등 특이사항을 남기면 계속 이어서 쌓여요"
          emptyLabel="등록된 특이사항이 없습니다"
        />
      </div>

      <div>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 8 }}>정성평가 코멘트 이력</div>
        <TimelineLog
          entries={comments} entriesError={commentsError} dateKey="comment_date"
          onAdd={async (date, text) => { await addEvalComment(employeeId, date, text); onCommentsChanged() }}
          onDelete={async (id) => { await deleteEvalComment(id); onCommentsChanged() }}
          placeholder="문제 상황이나 특이사항을 코멘트로 남기면 계속 이어서 쌓여요"
          emptyLabel="등록된 코멘트가 없습니다"
        />
      </div>
    </div>
  )
}

// 휴직시작일·종료일이 둘 다 있으면 개월수 계산(EmployeeList.jsx의 동일 함수와 같은 규칙), 아니면 null
function monthsBetween(startStr, endStr) {
  const s = startStr && startStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const en = endStr && endStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!s || !en) return null
  const sy = Number(s[1]), sm = Number(s[2]), sd = Number(s[3])
  const ey = Number(en[1]), em = Number(en[2]), ed = Number(en[3])
  let months = (ey - sy) * 12 + (em - sm)
  if (ed < sd) months -= 1
  return Math.max(0, months)
}
