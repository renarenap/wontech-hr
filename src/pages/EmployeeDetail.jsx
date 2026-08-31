import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { GRADE_COLOR, GRADE_HEIGHT, SIM_GRADE_POINTS, TRACK_LABEL, TRACKS, orgPath, O, P, G, Y, R, B } from '../lib/constants'
import { deriveEmployee, fetchRankCriteria, fetchLeaveRate } from '../lib/promotion'
import { SB, Bd, LocationBadges, LocationPicker, Prog, TenureBar, Tip, crd, Loading, ErrorBox, Modal, field, label as lbl, btnPrimary, btnGhost } from '../components/ui'

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [emp, setEmp] = useState(null)
  const [error, setError] = useState(null)
  const [sim, setSim] = useState('GD')
  const [showEdit, setShowEdit] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      setEmp(null)
      const [{ data: e, error: e1 }, { data: evals, error: e2 }, rankCriteria, leaveRate] = await Promise.all([
        supabase.from('employees').select('*').eq('id', id).single(),
        supabase.from('evaluations').select('*').eq('employee_id', id),
        fetchRankCriteria(),
        fetchLeaveRate(),
      ])
      if (cancelled) return
      if (e1 || e2) { setError(e1 || e2); return }
      setEmp(deriveEmployee(e, evals || [], rankCriteria, leaveRate))
    }
    load().catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [id, refreshKey])

  if (error) return <ErrorBox error={error} />
  if (!emp) return <Loading />

  const sp = SIM_GRADE_POINTS
  const proj = emp.currentPts + (sp[sim] || 6)
  const pg = Math.max(0, emp.threshold - proj)
  const fl = { fontSize: 11, color: '#64748b', marginBottom: 4 }
  const fv = { fontSize: 14, fontWeight: 600 }

  const breakdown = [
    {
      l: '평가 포인트', v: emp.evalPts, c: O,
      note: `현재 직급 기준 최근 ${Math.max(0, ((emp.level || 0) - 1) * 2)}건(반기 환산)만 반영 — 이전 직급 때 평가나 그 이전 기록은 승진 시 이미 반영된 것으로 보고 제외됩니다.`,
    },
    { l: '경력인정 포인트', v: emp.backfillPts || 0, c: P },
    { l: '휴직 포인트', v: emp.leavePts || 0, c: B },
    { l: '전문/직무 자격·기술성과 가점', v: emp.cert_pts || 0, c: '#6366f1' },
    { l: '포상 가점', v: emp.award_pts || 0, c: '#ca8a04' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={() => navigate('/employees')}
          style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 16px', color: '#64748b', fontSize: 12, cursor: 'pointer' }}
        >
          ← 목록으로
        </button>
        <button style={btnGhost} onClick={() => setShowEdit(true)}>✏️ 수정</button>
      </div>

      <div style={{ ...crd, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{emp.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <LocationBadges locations={emp.locations} />
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {orgPath(emp)}{emp.role ? ` · ${emp.role}` : ''}{emp.join_date ? ` · 입사 ${emp.join_date}` : ''}
              </div>
            </div>
            {emp.leave_start_date && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                🌿 휴직 {emp.leave_start_date} ~ {emp.leave_end_date || '(진행중)'}
              </div>
            )}
            {emp.note && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>📝 {emp.note}</div>}
          </div>
          <SB status={emp.status} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          <div><div style={fl}>직급</div><div style={fv}>{emp.rank}</div></div>
          <div><div style={fl}>직군</div><div style={fv}>{TRACK_LABEL[emp.track] || emp.track}</div></div>
          {emp.hasCriteria ? (
            <>
              <div>
                <div style={fl}>체류연한{emp.leaveYears > 0 ? ` (근무 ${emp.level || 0}년 + 휴직 ${emp.leaveYears}년)` : ''}</div>
                <div style={fv}><TenureBar level={emp.effectiveLevel} reqTenure={emp.req_tenure} /></div>
              </div>
              <div><div style={fl}>진급 기준</div><div style={fv}>{emp.threshold}P</div></div>
            </>
          ) : (
            <div style={{ gridColumn: 'span 2' }}><div style={fl}>승진포인트 기준</div><div style={{ ...fv, color: '#94a3b8' }}>해당없음 (임원/부장/수석연구원은 별도 승진 기준을 두지 않음)</div></div>
          )}
        </div>
        {(emp.engGated || emp.eng_pts > 0 || emp.eng2_pts > 0) && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            <div style={fl}>어학 (승진포인트 합계에는 포함되지 않는 별도 필수요건 필드)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                영어 {emp.eng_pts || 0}P{emp.eng_lifetime ? ' · AL/IH 평생인정' : ''}
              </span>
              {emp.eng2_pts > 0 && (
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  제2외국어 {emp.eng2_pts}P{emp.eng2_lifetime ? ' · 평생인정' : ''}
                </span>
              )}
              {emp.engGated && (
                <>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>승진요건(Im3 이상):</span>
                  <Bd color={emp.engOk ? G : '#c026d3'} bg={emp.engOk ? '#dcfce7' : '#fae8ff'}>
                    {emp.engOk ? '✅ 충족' : '❌ 미충족'}
                  </Bd>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={crd}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📊 평가 이력</div>
          {emp.evalWindow.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>평가 이력이 없습니다</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, padding: '0 8px', marginBottom: 10 }}>
                {emp.evalWindow.map((h) => {
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
              {emp.evalWindow.some((h) => !h.counted) && (
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10 }}>
                  점선 = 이전 직급 때 평가 등, 지금 승진포인트 계산에는 반영되지 않음
                </div>
              )}
            </>
          )}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: 12 }}>평가 포인트 합계</span>
            <span style={{ color: O, fontWeight: 700, fontSize: 14 }}>{emp.evalPts}P</span>
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
            <span style={{ fontSize: 20, fontWeight: 800, color: O }}>{emp.currentPts}P</span>
          </div>
          {emp.hasCriteria ? (
            <div style={{ marginTop: 8 }}><Prog current={emp.currentPts} max={emp.threshold} /></div>
          ) : (
            <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>승진포인트 추적 대상이 아니에요.</div>
          )}
        </div>
      </div>

      {emp.hasCriteria && (
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
            { l: '예상 총', v: `${proj}P`, c: proj >= emp.threshold ? G : Y },
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
    track: e.track || '사무',
    level: e.level ?? 0,
    leave_start_date: e.leave_start_date || '',
    leave_end_date: e.leave_end_date || '',
    leave_years: e.leave_years ?? 0,
    backfill_full_tenure: !!e.backfill_full_tenure,
    eng_pts: e.eng_pts ?? 0,
    eng_lifetime: !!e.eng_lifetime,
    eng2_pts: e.eng2_pts ?? 0,
    eng2_lifetime: !!e.eng2_lifetime,
    cert_pts: e.cert_pts ?? 0,
    award_pts: e.award_pts ?? 0,
    note: e.note || '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (ev) => setForm({ ...form, [k]: ev.target.value })
  const setChecked = (k) => (ev) => setForm({ ...form, [k]: ev.target.checked })

  const submit = async (ev) => {
    ev.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('이름이 비어있어요'); return }
    if (!form.division && !form.dept && !form.team) { setError('실/팀/파트 중 최소 하나는 있어야 해요'); return }
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
      track: form.track,
      level: Number(form.level) || 0,
      leave_start_date: form.leave_start_date || null,
      leave_end_date: form.leave_end_date || null,
      leave_years: autoLeaveYears !== null ? autoLeaveYears / 12 : Number(form.leave_years) || 0,
      backfill_full_tenure: form.backfill_full_tenure,
      eng_pts: Number(form.eng_pts) || 0,
      eng_lifetime: form.eng_lifetime,
      eng2_pts: Number(form.eng2_pts) || 0,
      eng2_lifetime: form.eng2_lifetime,
      cert_pts: Number(form.cert_pts) || 0,
      award_pts: Number(form.award_pts) || 0,
      note: form.note.trim() || null,
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
          <div style={{ flex: 1 }}><label style={lbl}>실</label><input style={field} value={form.division} onChange={set('division')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>팀</label><input style={field} value={form.dept} onChange={set('dept')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>파트</label><input style={field} value={form.team} onChange={set('team')} /></div>
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

        <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.backfill_full_tenure} onChange={setChecked('backfill_full_tenure')} />
          경력직 인정포인트 적용 (아니면 평가 인정포인트로 계산)
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

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>영어점수</label>
            <input style={field} type="number" step="0.5" value={form.eng_pts} onChange={set('eng_pts')} />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={form.eng_lifetime} onChange={setChecked('eng_lifetime')} /> AL/IH 평생인정
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>제2외국어점수</label>
            <input style={field} type="number" step="0.5" value={form.eng2_pts} onChange={set('eng2_pts')} />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={form.eng2_lifetime} onChange={setChecked('eng2_lifetime')} /> 평생인정
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>자격가점</label><input style={field} type="number" step="0.5" value={form.cert_pts} onChange={set('cert_pts')} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>포상가점</label><input style={field} type="number" step="0.5" value={form.award_pts} onChange={set('award_pts')} /></div>
        </div>

        <label style={lbl}>비고 (겸직 등 자유메모)</label>
        <input style={field} value={form.note} onChange={set('note')} />

        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" style={btnGhost} onClick={onClose}>취소</button>
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </form>
    </Modal>
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
