import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { O, P, G, Y, R, B, TRACK_LABEL } from '../lib/constants'
import { deriveEmployee, fetchRankCriteria, fetchLeaveRate, CATEGORIES } from '../lib/promotion'
import {
  currentEvalPeriod, nextYearOutlook, gradeTrend, watchReasons, OUTLOOK, TREND_LABEL, WATCH_REASON,
} from '../lib/analysis'
import { KpiRow, Prog, Bd, GB, SB, Tip, crd, thS, tdS, inp, Loading, ErrorBox, EmptyState } from '../components/ui'

const CATEGORY_COLOR = { all: O, 사무: '#475569', 사무외국어필수: B, 연구: P, 부장수석: '#b45309', 임원: '#92400e' }
const CATEGORY_LABEL = { all: '전체', ...TRACK_LABEL, 부장수석: '부장/수석', 임원: '임원' }

const SECTIONS = [
  { key: 'outlook', label: '🔮 내년 승진 예상' },
  { key: 'good', label: '🏅 고과 우수자' },
  { key: 'watch', label: '⚠️ 주의 대상' },
  { key: 'dept', label: '🏢 본부별 요약' },
]

const GOOD_OPTIONS = [
  { v: 8, l: 'A·VG 이상' },
  { v: 9, l: 'A+ 이상' },
  { v: 10, l: 'S·EX만' },
]

const NO_DEPT = '(본부 미지정)'

export default function Analysis() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const section = SECTIONS.some((s) => s.key === searchParams.get('tab')) ? searchParams.get('tab') : 'outlook'
  const setSection = (key) => setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('tab', key); return n }, { replace: true })

  const [raw, setRaw] = useState(null)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState('all')
  const [dept, setDept] = useState('all')
  const [recentN, setRecentN] = useState(4)
  const [goodMin, setGoodMin] = useState(8)
  const [minStreak, setMinStreak] = useState(3)
  const [outlookFilter, setOutlookFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      const [{ data: emps, error: e1 }, { data: evals, error: e2 }, rankCriteria, leaveRate] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('evaluations').select('employee_id, period, grade, points'),
        fetchRankCriteria(),
        fetchLeaveRate(),
      ])
      if (cancelled) return
      if (e1 || e2) {
        setError(e1 || e2)
        return
      }
      const byEmp = {}
      ;(evals || []).forEach((ev) => {
        ;(byEmp[ev.employee_id] ||= []).push(ev)
      })
      setRaw({ emps: emps || [], byEmp, rankCriteria, leaveRate })
    }
    load().catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [])

  const period = currentEvalPeriod()

  // 내년 예상은 등급 3개 가정마다 deriveEmployee를 다시 돌려서 무거우니 원본 데이터가 바뀔 때만 계산
  const base = useMemo(() => {
    if (!raw) return null
    return raw.emps.map((e) => {
      const evals = raw.byEmp[e.id] || []
      const d = deriveEmployee(e, evals, raw.rankCriteria, raw.leaveRate)
      return { ...d, evals, outlook: nextYearOutlook(d, evals, raw.rankCriteria, raw.leaveRate, period) }
    })
  }, [raw, period])

  // 고과 추이·주의 사유는 화면의 기준값(최근 N건, 우수 기준)에 따라 달라짐
  const rows = useMemo(() => {
    if (!base) return null
    return base.map((e) => {
      const trend = gradeTrend(e.evals, { recentN, goodMin })
      return { ...e, trend, watch: watchReasons(e, trend) }
    })
  }, [base, recentN, goodMin])

  const deptOptions = useMemo(() => {
    if (!rows) return []
    return [...new Set(rows.map((e) => e.dept || NO_DEPT))].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [rows])

  const scoped = useMemo(() => {
    if (!rows) return null
    const cat = CATEGORIES.find((c) => c.key === category)
    return rows.filter((e) => (!cat || cat.test(e)) && (dept === 'all' || (e.dept || NO_DEPT) === dept))
  }, [rows, category, dept])

  if (error) return <ErrorBox error={error} />
  if (!scoped) return <Loading />

  const goTo = (id) => navigate(`/employees/${id}`)

  return (
    <div>
      <div style={{ ...crd, padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...CATEGORIES.map((c) => c.key)].map((k) => (
            <button
              key={k} onClick={() => setCategory(k)}
              style={{
                padding: '6px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                color: category === k ? '#fff' : CATEGORY_COLOR[k],
                background: category === k ? CATEGORY_COLOR[k] : '#f1f5f9',
              }}
            >
              {CATEGORY_LABEL[k]}
            </button>
          ))}
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} style={inp}>
          <option value="all">전체 본부</option>
          {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{scoped.length}명</span>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {SECTIONS.map((s) => (
          <button
            key={s.key} onClick={() => setSection(s.key)}
            style={{
              padding: '10px 16px', border: 'none', background: 'transparent', fontSize: 13, cursor: 'pointer',
              fontWeight: section === s.key ? 700 : 500, color: section === s.key ? O : '#64748b',
              borderBottom: `2px solid ${section === s.key ? O : 'transparent'}`, marginBottom: -1,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'outlook' && (
        <OutlookSection rows={scoped} period={period} filter={outlookFilter} setFilter={setOutlookFilter} goTo={goTo} />
      )}
      {section === 'good' && (
        <GoodSection
          rows={scoped} goTo={goTo}
          recentN={recentN} setRecentN={setRecentN} goodMin={goodMin} setGoodMin={setGoodMin}
          minStreak={minStreak} setMinStreak={setMinStreak}
        />
      )}
      {section === 'watch' && <WatchSection rows={scoped} goTo={goTo} recentN={recentN} />}
      {section === 'dept' && <DeptSection rows={scoped} minStreak={minStreak} recentN={recentN} />}
    </div>
  )
}

function RowHover({ onClick, children }) {
  return (
    <tr
      style={{ cursor: 'pointer' }} onClick={onClick}
      onMouseEnter={(ev) => (ev.currentTarget.style.background = '#f8fafc')}
      onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
    >
      {children}
    </tr>
  )
}

const nameTd = { ...tdS, color: '#111827', fontWeight: 700 }
const hint = { fontSize: 11, color: '#94a3b8', fontWeight: 400 }

function RecentGrades({ list }) {
  if (!list.length) return <span style={{ fontSize: 11, color: '#cbd5e1' }}>평가 없음</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {list.map((e) => (
        <span key={e.period} title={e.period} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
          <GB grade={e.grade} />
          <span style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{e.period}</span>
        </span>
      ))}
    </span>
  )
}

function Chip({ active, color, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 20, border: `1px solid ${active ? color : 'var(--border)'}`, fontSize: 12, fontWeight: 600,
        cursor: 'pointer', color: active ? '#fff' : color, background: active ? color : '#fff',
      }}
    >
      {children}
    </button>
  )
}

// ─── 1. 내년 승진 예상 ───
function OutlookSection({ rows, period, filter, setFilter, goTo }) {
  const tracked = rows.filter((e) => e.hasCriteria)
  const count = (b) => tracked.filter((e) => e.outlook.bucket === b).length
  const candidates = tracked
    .filter((e) => OUTLOOK[e.outlook.bucket])
    .filter((e) => filter === 'all' || e.outlook.bucket === filter)
    .sort((a, b) => {
      const order = ['safe', 'needVG', 'needEX', 'no']
      const d = order.indexOf(a.outlook.bucket) - order.indexOf(b.outlook.bucket)
      if (d) return d
      return (b.outlook.best?.currentPts / (b.threshold || 1)) - (a.outlook.best?.currentPts / (a.threshold || 1))
    })

  return (
    <>
      <KpiRow
        items={[
          { v: count('already'), l: '이미 기준 충족', c: G },
          ...Object.entries(OUTLOOK).map(([k, o]) => ({
            v: count(k), l: `${o.label} (${o.desc})`, c: o.color, onClick: () => setFilter(filter === k ? 'all' : k),
          })),
          { v: count('onLeave'), l: '휴직중 (예측 제외)', c: '#0d9488' },
        ]}
      />
      <div style={crd}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            <Tip
              width={340}
              content={`올해('${period}) 연간평가를 해당 등급으로 받고, 연차 일괄 +1까지 반영된 뒤의 상태를 다시 계산한 결과예요. 연차가 늘면서 평가 반영범위와 체류연한 충족 여부도 같이 바뀝니다. 올해 평가가 이미 입력된 사람은 실제 평가로 계산해요(확정 표시).`}
            >
              내년 승진 예상 명단
            </Tip>
            <span style={{ ...hint, marginLeft: 8 }}>{candidates.length}명</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip active={filter === 'all'} color={O} onClick={() => setFilter('all')}>전체</Chip>
            {Object.entries(OUTLOOK).map(([k, o]) => (
              <Chip key={k} active={filter === k} color={o.color} onClick={() => setFilter(k)}>{o.label}</Chip>
            ))}
          </div>
        </div>
        {candidates.length === 0 ? <EmptyState /> : (
          <div style={{ maxHeight: 560, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['이름', '직급', '본부', '현재 상태', '현재 포인트', '연차', '예상', 'GD 시', 'VG 시', 'EX 시', '비고'].map((h) => <th key={h} style={thS}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {candidates.map((e) => {
                  const o = OUTLOOK[e.outlook.bucket]
                  const pr = e.outlook.projections
                  const cell = (p) => {
                    if (!p) return <td style={{ ...tdS, color: '#cbd5e1' }}>—</td>
                    const ok = p.ptsMet && p.tenureMet
                    return (
                      <td style={{ ...tdS, color: ok ? G : '#94a3b8', fontWeight: ok ? 700 : 400 }}>
                        {p.currentPts}P {ok ? '✓' : p.ptsMet ? '(연차)' : `(-${p.gap})`}
                      </td>
                    )
                  }
                  return (
                    <RowHover key={e.id} onClick={() => goTo(e.id)}>
                      <td style={nameTd}>{e.name}</td>
                      <td style={tdS}>{e.rank}</td>
                      <td style={tdS}>{e.dept || '—'}</td>
                      <td style={tdS}><SB status={e.status} /></td>
                      <td style={tdS}><Prog current={e.currentPts} max={e.threshold} /></td>
                      <td style={tdS}>{e.effectiveLevel}/{e.req_tenure}년</td>
                      <td style={tdS}><Bd color={o.color} bg={o.bg}>{o.label}</Bd></td>
                      {e.outlook.confirmed ? (
                        <td colSpan={3} style={{ ...tdS, color: '#64748b' }}>
                          올해 평가 확정 → {pr.actual.currentPts}P {pr.actual.ptsMet && pr.actual.tenureMet ? '✓' : ''}
                        </td>
                      ) : (
                        <>{cell(pr.GD)}{cell(pr.VG)}{cell(pr.EX)}</>
                      )}
                      <td style={tdS}>
                        {e.outlook.confirmed && <Bd color={B} bg="#e0f2fe">확정</Bd>}
                        {e.outlook.langBlocked && <Bd color="#c026d3" bg="#fae8ff">외국어 요건 별도</Bd>}
                      </td>
                    </RowHover>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ─── 2. 고과 우수자 ───
function GoodSection({ rows, goTo, recentN, setRecentN, goodMin, setGoodMin, minStreak, setMinStreak }) {
  const list = rows
    .filter((e) => e.trend.streak >= minStreak)
    .sort((a, b) => b.trend.streak - a.trend.streak || (b.trend.avg || 0) - (a.trend.avg || 0))
  const goodLabel = GOOD_OPTIONS.find((g) => g.v === goodMin)?.l

  return (
    <div style={crd}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          고과 우수자 <span style={{ ...hint, marginLeft: 6 }}>최근부터 {goodLabel} {minStreak}회 이상 연속 · {list.length}명</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#64748b' }}>
          우수 기준
          <select value={goodMin} onChange={(e) => setGoodMin(Number(e.target.value))} style={inp}>
            {GOOD_OPTIONS.map((g) => <option key={g.v} value={g.v}>{g.l}</option>)}
          </select>
          연속
          <select value={minStreak} onChange={(e) => setMinStreak(Number(e.target.value))} style={inp}>
            {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}회 이상</option>)}
          </select>
          <RecentNSelect recentN={recentN} setRecentN={setRecentN} />
        </div>
      </div>
      {list.length === 0 ? <EmptyState label="조건에 맞는 직원이 없습니다" /> : (
        <div style={{ maxHeight: 600, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['이름', '직급', '본부', '연속 우수', `최근 ${recentN}회`, '평균(10점)', '추세', '승진 상태', '내년 예상'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <RowHover key={e.id} onClick={() => goTo(e.id)}>
                  <td style={nameTd}>{e.name}</td>
                  <td style={tdS}>{e.rank}</td>
                  <td style={tdS}>{e.dept || '—'}</td>
                  <td style={{ ...tdS, color: O, fontWeight: 800 }}>{e.trend.streak}회</td>
                  <td style={tdS}><RecentGrades list={e.trend.recent} /></td>
                  <td style={{ ...tdS, fontWeight: 700 }}>{e.trend.avg ?? '—'}</td>
                  <td style={tdS}><TrendText t={e.trend.trend} /></td>
                  <td style={tdS}><SB status={e.status} /></td>
                  <td style={tdS}><OutlookBadge outlook={e.outlook} /></td>
                </RowHover>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RecentNSelect({ recentN, setRecentN }) {
  return (
    <>
      최근
      <select value={recentN} onChange={(e) => setRecentN(Number(e.target.value))} style={inp}>
        {[3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n}회</option>)}
      </select>
    </>
  )
}

function TrendText({ t }) {
  if (!t) return <span style={{ fontSize: 11, color: '#cbd5e1' }}>이력 부족</span>
  const s = TREND_LABEL[t]
  return <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</span>
}

function OutlookBadge({ outlook }) {
  if (outlook.bucket === 'already') return <Bd color={G} bg="#dcfce7">이미 충족</Bd>
  const o = OUTLOOK[outlook.bucket]
  if (!o) return <span style={{ fontSize: 11, color: '#cbd5e1' }}>—</span>
  return <Bd color={o.color} bg={o.bg}>{o.label}</Bd>
}

// ─── 3. 주의 대상 ───
function WatchSection({ rows, goTo, recentN }) {
  const [reason, setReason] = useState('all')
  const flagged = rows.filter((e) => e.watch.length > 0)
  const list = flagged
    .filter((e) => reason === 'all' || e.watch.includes(reason))
    .sort((a, b) => b.watch.length - a.watch.length || (a.trend.avg ?? 99) - (b.trend.avg ?? 99))
  const count = (k) => flagged.filter((e) => e.watch.includes(k)).length

  return (
    <>
      <KpiRow
        items={Object.entries(WATCH_REASON).map(([k, w]) => ({
          v: count(k), l: w.label, c: w.color, onClick: () => setReason(reason === k ? 'all' : k),
        }))}
      />
      <div style={crd}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            <Tip
              width={360}
              content={`고과 하락: 최근 2회 평균이 그 직전 2회보다 1점(10점 만점) 이상 낮음 · 저고과 반복: 최근 ${recentN}회 중 C·NI 이하가 2회 이상 · 승진 정체: 체류연한을 2년 이상 넘겼는데 포인트 부족 · 외국어만 남음: 포인트·연차는 충족했지만 외국어 요건 미충족`}
            >
              주의 대상
            </Tip>
            <span style={{ ...hint, marginLeft: 8 }}>{list.length}명</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip active={reason === 'all'} color={O} onClick={() => setReason('all')}>전체</Chip>
            {Object.entries(WATCH_REASON).map(([k, w]) => (
              <Chip key={k} active={reason === k} color={w.color} onClick={() => setReason(k)}>{w.label}</Chip>
            ))}
          </div>
        </div>
        {list.length === 0 ? <EmptyState label="해당하는 직원이 없습니다" /> : (
          <div style={{ maxHeight: 560, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['이름', '직급', '본부', '사유', `최근 ${recentN}회`, '평균(10점)', '추세', '포인트', '연차'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <RowHover key={e.id} onClick={() => goTo(e.id)}>
                    <td style={nameTd}>{e.name}</td>
                    <td style={tdS}>{e.rank}</td>
                    <td style={tdS}>{e.dept || '—'}</td>
                    <td style={tdS}>
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        {e.watch.map((k) => <Bd key={k} color={WATCH_REASON[k].color} bg={WATCH_REASON[k].bg}>{WATCH_REASON[k].label}</Bd>)}
                      </span>
                    </td>
                    <td style={tdS}><RecentGrades list={e.trend.recent} /></td>
                    <td style={{ ...tdS, fontWeight: 700 }}>{e.trend.avg ?? '—'}</td>
                    <td style={tdS}><TrendText t={e.trend.trend} /></td>
                    <td style={tdS}>{e.hasCriteria ? <Prog current={e.currentPts} max={e.threshold} /> : '—'}</td>
                    <td style={tdS}>{e.hasCriteria ? `${e.effectiveLevel}/${e.req_tenure}년` : '—'}</td>
                  </RowHover>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ─── 4. 본부별 요약 ───
function DeptSection({ rows, minStreak, recentN }) {
  const groups = {}
  rows.forEach((e) => {
    const k = e.dept || NO_DEPT
    const g = (groups[k] ||= { dept: k, total: 0, tracked: 0, already: 0, safe: 0, needVG: 0, good: 0, watch: 0, avgSum: 0, avgN: 0 })
    g.total++
    if (e.hasCriteria) g.tracked++
    if (e.outlook.bucket === 'already') g.already++
    if (e.outlook.bucket === 'safe') g.safe++
    if (e.outlook.bucket === 'needVG') g.needVG++
    if (e.trend.streak >= minStreak) g.good++
    if (e.watch.length) g.watch++
    if (e.trend.avg != null) { g.avgSum += e.trend.avg; g.avgN++ }
  })
  const list = Object.values(groups).sort((a, b) => b.total - a.total)

  return (
    <div style={crd}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
        본부별 요약 <span style={{ ...hint, marginLeft: 6 }}>평균 고과는 최근 {recentN}회 기준 · 우수자는 {minStreak}회 이상 연속</span>
      </div>
      {list.length === 0 ? <EmptyState /> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['본부', '인원', '추적 대상', '승진 가능', '내년 안정권', '내년 고과 필요', '고과 우수자', '주의 대상', '평균 고과(10점)'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {list.map((g) => {
              const avg = g.avgN ? (g.avgSum / g.avgN).toFixed(1) : '—'
              return (
                <tr key={g.dept}>
                  <td style={{ ...tdS, fontWeight: 700, color: '#111827' }}>{g.dept}</td>
                  <td style={tdS}>{g.total}명</td>
                  <td style={tdS}>{g.tracked}명</td>
                  <td style={{ ...tdS, color: G, fontWeight: 700 }}>{g.already}</td>
                  <td style={{ ...tdS, color: G }}>{g.safe}</td>
                  <td style={{ ...tdS, color: Y }}>{g.needVG}</td>
                  <td style={{ ...tdS, color: O, fontWeight: 700 }}>{g.good}</td>
                  <td style={{ ...tdS, color: g.watch ? R : '#94a3b8' }}>{g.watch}</td>
                  <td style={tdS}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                      <div style={{ flex: 1, height: 7, borderRadius: 4, background: '#f1f5f9' }}>
                        <div style={{ height: 7, borderRadius: 4, background: P, width: `${g.avgN ? (g.avgSum / g.avgN) * 10 : 0}%` }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: P, minWidth: 28, textAlign: 'right' }}>{avg}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
