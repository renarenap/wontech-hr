import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { O, P, G, Y, R, B, TRACK_LABEL, baseRank, STATUS_LABEL, LOCATIONS, LOCATION_STYLE, ORG_LEVEL_LABEL, orgPath } from '../lib/constants'
import { downloadCSV } from '../lib/csv'
import { deriveEmployee, fetchRankCriteria, fetchLeaveRate, CATEGORIES } from '../lib/promotion'
import {
  currentEvalPeriod, nextYearOutlook, passesWithGrade, gradeTrend, watchReasons, OUTLOOK, GRADE_STEPS, gradeText, TREND_LABEL, WATCH_REASON,
} from '../lib/analysis'
import { KpiRow, Prog, Bd, GB, SB, Tip, crd, thS, tdS, inp, btnGhost, Loading, ErrorBox, EmptyState } from '../components/ui'

const CATEGORY_COLOR = { all: O, 사무: '#475569', 사무외국어필수: B, 연구: P, 부장수석: '#b45309', 임원: '#92400e' }
const CATEGORY_LABEL = { all: '전체', ...TRACK_LABEL, 부장수석: '부장/수석', 임원: '임원' }

const SECTIONS = [
  { key: 'outlook', label: '🔮 올해 평가 반영 승진 예상' },
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
  const [outlookGrade, setOutlookGrade] = useState('GD')
  const [includeAlready, setIncludeAlready] = useState(true)

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

  // 올해 평가 반영 예상은 등급 4개 가정마다 deriveEmployee를 다시 돌려서 무거우니 원본 데이터가 바뀔 때만 계산
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
        <OutlookSection
          rows={scoped} period={period} goTo={goTo}
          grade={outlookGrade} setGrade={setOutlookGrade} includeAlready={includeAlready} setIncludeAlready={setIncludeAlready}
        />
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

// ─── 공통: 명단 위 요약 그래프(인원수·지역 비율·본부 순위) + CSV 다운로드 ───
// 지역 색은 앱 전체의 지역 배지(LOCATION_STYLE)와 같은 색 — 같은 지역이 화면마다 다른 색으로 보이지 않게
const LOC_COLOR = { ...Object.fromEntries(LOCATIONS.map((l) => [l, LOCATION_STYLE[l]?.c || '#94a3b8'])), 미지정: '#cbd5e1' }
const shortLoc = (l) => l.replace(/\(.*\)/, '')
const chartCard = { background: '#f8fafc', borderRadius: 10, padding: '14px 16px', position: 'relative', minWidth: 0 }
const chartTitle = { fontSize: 12, fontWeight: 700, marginBottom: 10, color: '#334155' }

// 막대에 마우스를 올리면 뜨는 툴팁 — 카드(position: relative) 기준 좌표로 띄움
function useChartTip() {
  const [tip, setTip] = useState(null)
  const bind = (text) => ({
    onMouseMove: (ev) => {
      const box = ev.currentTarget.closest('[data-chart]').getBoundingClientRect()
      setTip({ x: ev.clientX - box.left, y: ev.clientY - box.top, text })
    },
    onMouseLeave: () => setTip(null),
  })
  const el = tip && (
    <div
      style={{
        position: 'absolute', left: tip.x + 12, top: tip.y - 36, zIndex: 20, pointerEvents: 'none', whiteSpace: 'nowrap',
        background: '#1e293b', color: '#f1f5f9', fontSize: 11, padding: '6px 9px', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,.2)',
      }}
    >
      {tip.text}
    </div>
  )
  return { bind, el }
}

// 인원수: 큰 숫자 + 구분별 세로 막대. bars: [{ label, value, active }] — active=false는 지금 명단에 안 들어간 구분(흐리게)
function CountChart({ total, caption, bars }) {
  const { bind, el } = useChartTip()
  const max = Math.max(1, ...bars.map((b) => b.value))
  return (
    <div style={chartCard} data-chart>
      <div style={chartTitle}>인원수</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{total}</span>
        <span style={{ fontSize: 13, color: '#64748b' }}>명</span>
        {caption && <span style={{ ...hint, marginLeft: 4 }}>{caption}</span>}
      </div>
      {bars.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 96, borderBottom: '1px solid #e2e8f0' }}>
          {bars.map((b) => (
            <div key={b.label} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', cursor: 'default' }} {...bind(`${b.label}: ${b.value}명`)}>
              <span style={{ fontSize: 11, fontWeight: 700, color: b.active ? '#111827' : '#94a3b8', marginBottom: 3 }}>{b.value}</span>
              <div style={{ width: '70%', maxWidth: 34, height: `${(b.value / max) * 72}px`, minHeight: b.value ? 3 : 0, borderRadius: '4px 4px 0 0', background: b.active ? O : '#cbd5e1' }} />
            </div>
          ))}
        </div>
      )}
      {bars.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
          {bars.map((b) => (
            <span key={b.label} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: b.active ? '#334155' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.label}</span>
          ))}
        </div>
      )}
      {el}
    </div>
  )
}

// 지역 비율: 100% 누적 가로막대 + 구간마다 직접 라벨(색만으로 구분하지 않게) + 아래 범례
function LocationChart({ list }) {
  const { bind, el } = useChartTip()
  const locCount = {}
  let multi = 0
  list.forEach((e) => {
    const locs = e.locations?.length ? e.locations : ['미지정']
    if (locs.length > 1) multi++
    locs.forEach((l) => { locCount[l] = (locCount[l] || 0) + 1 })
  })
  const order = [...LOCATIONS, '미지정'].filter((l) => locCount[l])
  const sum = order.reduce((s, l) => s + locCount[l], 0)
  const pct = (l) => Math.round((locCount[l] / sum) * 100)
  return (
    <div style={chartCard} data-chart>
      <div style={chartTitle}>지역 비율</div>
      <div style={{ display: 'flex', gap: 2, height: 34, marginBottom: 12 }}>
        {order.map((l) => (
          <div
            key={l} {...bind(`${l}: ${locCount[l]}명 (${pct(l)}%)`)}
            style={{
              width: `${(locCount[l] / sum) * 100}%`, background: LOC_COLOR[l], borderRadius: 4, minWidth: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              color: l === '미지정' ? '#475569' : '#fff', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
            }}
          >
            {pct(l) >= 12 ? `${pct(l)}%` : ''}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {order.map((l) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: LOC_COLOR[l], flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{shortLoc(l)}</span>
            <b>{locCount[l]}명</b>
            <span style={{ color: '#94a3b8', width: 36, textAlign: 'right' }}>{pct(l)}%</span>
          </div>
        ))}
      </div>
      {multi > 0 && <div style={{ ...hint, marginTop: 8 }}>복수 소속 {multi}명은 양쪽에 모두 집계</div>}
      {el}
    </div>
  )
}

// 본부 순위: 인원 많은 순 가로막대 — 라벨은 막대 오른쪽에 인원·본부 인원 대비 비율
function DeptRankChart({ list, population }) {
  const { bind, el } = useChartTip()
  const deptTotal = {}
  population.forEach((e) => { const k = e.dept || NO_DEPT; deptTotal[k] = (deptTotal[k] || 0) + 1 })
  const deptCount = {}
  list.forEach((e) => { const k = e.dept || NO_DEPT; deptCount[k] = (deptCount[k] || 0) + 1 })
  const ranking = Object.entries(deptCount).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  const top = ranking[0]?.[1] || 1
  return (
    <div style={chartCard} data-chart>
      <div style={chartTitle}>본부 순위 <span style={hint}>· 괄호는 본부 전체 인원 대비</span></div>
      <div style={{ maxHeight: 170, overflow: 'auto', paddingRight: 4 }}>
        {ranking.map(([d, n], i) => {
          const ratio = Math.round((n / (deptTotal[d] || n)) * 100)
          return (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0' }} {...bind(`${d}: ${n}명 / 본부 ${deptTotal[d] || n}명 중 ${ratio}%`)}>
              <span style={{ width: 16, color: i < 3 ? O : '#94a3b8', fontWeight: 800, textAlign: 'right' }}>{i + 1}</span>
              <span style={{ width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155' }}>{d}</span>
              <div style={{ flex: 1, height: 14 }}>
                <div style={{ height: 14, borderRadius: '0 4px 4px 0', background: i < 3 ? O : '#fdba74', width: `${(n / top) * 100}%`, minWidth: 3 }} />
              </div>
              <span style={{ width: 78, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <b>{n}명</b> <span style={{ color: '#94a3b8' }}>({ratio}%)</span>
              </span>
            </div>
          )
        })}
      </div>
      {el}
    </div>
  )
}

// list: 지금 보여주는 명단 / population: 같은 필터(직군·본부)가 걸린 전체 인원 — 본부별 비율 분모
// countBars/countCaption: 인원수 카드의 구분별 막대(탭마다 다름)
function ListSummary({ list, population, countBars = [], countCaption }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 16 }}>
      <CountChart total={list.length} caption={countCaption} bars={countBars} />
      {list.length > 0 ? <LocationChart list={list} /> : <div style={chartCard}><div style={chartTitle}>지역 비율</div><EmptyState /></div>}
      {list.length > 0 ? <DeptRankChart list={list} population={population} /> : <div style={chartCard}><div style={chartTitle}>본부 순위</div><EmptyState /></div>}
    </div>
  )
}

// 명단을 key별로 세서 인원수 막대용 [{label, value, active}]로 — 인원 많은 순, 5개 넘으면 나머지는 "기타"
function countBy(list, keyFn) {
  const c = {}
  list.forEach((e) => { const k = keyFn(e) || '미지정'; c[k] = (c[k] || 0) + 1 })
  const sorted = Object.entries(c).sort((a, b) => b[1] - a[1])
  const head = sorted.slice(0, 5).map(([label, value]) => ({ label, value, active: true }))
  const rest = sorted.slice(5).reduce((s, [, v]) => s + v, 0)
  return rest ? [...head, { label: '기타', value: rest, active: true }] : head
}

const baseCsvCols = [
  { key: 'name', label: '이름' },
  { key: 'orgPathStr', label: `소속(${ORG_LEVEL_LABEL.division}·${ORG_LEVEL_LABEL.dept}·${ORG_LEVEL_LABEL.team})` },
  { key: 'locStr', label: '지역' },
  { key: 'rank', label: '직급' },
  { key: 'trackLabel', label: '직군' },
]
const baseCsvRow = (e) => ({
  ...e,
  orgPathStr: orgPath(e),
  locStr: (e.locations || []).join(' / '),
  trackLabel: TRACK_LABEL[e.track] || e.track,
  statusLabel: (e.issues || []).map((i) => (STATUS_LABEL[i] || STATUS_LABEL.short).label).join(' / '),
  recentStr: e.trend.recent.map((x) => `${x.period}:${x.grade}`).join(' '),
  trendStr: e.trend.trend ? TREND_LABEL[e.trend.trend].label : '',
  avg: e.trend.avg ?? '',
})

function DownloadButton({ filename, rows, columns }) {
  const stamp = new Date().toISOString().slice(0, 10)
  return (
    <button
      style={{ ...btnGhost, padding: '7px 14px' }} disabled={!rows.length}
      onClick={() => downloadCSV(`${filename}_${stamp}.csv`, rows, columns)}
    >
      ⬇ 명단 다운로드 ({rows.length}명)
    </button>
  )
}

// ─── 1. 올해 평가 반영 승진 예상 ───
function OutlookSection({ rows, period, grade, setGrade, includeAlready, setIncludeAlready, goTo }) {
  const tracked = rows.filter((e) => e.hasCriteria)
  const count = (b) => tracked.filter((e) => e.outlook.bucket === b).length
  const already = tracked.filter((e) => e.outlook.bucket === 'already')
  const byGrade = tracked.filter((e) => OUTLOOK[e.outlook.bucket] && passesWithGrade(e.outlook, grade))
  const list = [...(includeAlready ? already : []), ...byGrade].sort((a, b) => {
    const rank = (e) => (e.outlook.bucket === 'already' ? -1 : e.outlook.confirmed ? 0 : GRADE_STEPS.indexOf(e.outlook.minGrade))
    return rank(a) - rank(b) || (b.currentPts / (b.threshold || 1)) - (a.currentPts / (a.threshold || 1))
  })
  const yearLabel = `20${period}`

  const csvRows = list.map((e) => {
    const p = e.outlook.confirmed ? e.outlook.projections.actual : e.outlook.projections?.[grade]
    return {
      ...baseCsvRow(e),
      outlookStr: e.outlook.bucket === 'already' ? '이미 기준 충족' : e.outlook.confirmed ? '올해 평가 확정 → 충족' : `${gradeText(e.outlook.minGrade)} 이상이면 가능`,
      projPts: p ? p.currentPts : e.currentPts,
      langStr: e.outlook.langBlocked || (e.engGated && !e.engOk) ? '미충족' : '',
    }
  })
  const csvCols = [
    ...baseCsvCols,
    { key: 'currentPts', label: '현재 포인트' },
    { key: 'threshold', label: '진급기준' },
    { key: 'effectiveLevel', label: '현재 연차' },
    { key: 'req_tenure', label: '요구연차' },
    { key: 'outlookStr', label: '구분' },
    { key: 'projPts', label: `올해 ${gradeText(grade)} 반영 시 예상 포인트` },
    { key: 'langStr', label: '외국어 요건' },
    { key: 'recentStr', label: '최근 고과' },
  ]

  return (
    <>
      <KpiRow
        items={[
          { v: count('already'), l: '이미 기준 충족', c: G },
          { v: count('safe'), l: OUTLOOK.safe.label, c: OUTLOOK.safe.color, onClick: () => setGrade('GD') },
          { v: count('needVG'), l: OUTLOOK.needVG.label, c: OUTLOOK.needVG.color, onClick: () => setGrade('VG') },
          { v: count('needEX'), l: OUTLOOK.needEX.label, c: OUTLOOK.needEX.color, onClick: () => setGrade('EX') },
          { v: count('no'), l: OUTLOOK.no.label, c: OUTLOOK.no.color },
          { v: count('onLeave'), l: '휴직중 (예측 제외)', c: '#0d9488' },
        ]}
      />
      <div style={crd}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              <Tip
                width={360}
                content={`올해(${yearLabel}) 연간평가를 해당 등급으로 받고, 1/1 연차 일괄 +1까지 반영된 뒤 승진 기준(포인트·체류연한)을 채우는지 다시 계산한 결과예요. 연차가 늘면서 평가 반영범위와 체류연한 충족 여부도 같이 바뀝니다. 올해 평가가 이미 입력된 사람은 실제 평가로 판단해요(확정 표시).`}
              >
                올해({yearLabel}) 평가를
              </Tip>
            </span>
            {GRADE_STEPS.map((g) => (
              <Chip key={g} active={grade === g} color={P} onClick={() => setGrade(g)}>{gradeText(g)}</Chip>
            ))}
            <span style={{ fontSize: 15, fontWeight: 700 }}>이상 받으면 승진 가능</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: O, marginLeft: 6 }}>{list.length}명</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
              <input type="checkbox" checked={includeAlready} onChange={(e) => setIncludeAlready(e.target.checked)} />
              이미 기준 충족한 {already.length}명 포함
            </label>
            <DownloadButton filename={`올해${gradeText(grade)}이상_승진가능`} rows={csvRows} columns={csvCols} />
          </div>
        </div>
        <ListSummary
          list={list} population={rows} countCaption={`올해 ${gradeText(grade)} 이상 기준`}
          countBars={[
            ...(includeAlready ? [{ label: '이미 충족', value: already.length, active: true }] : []),
            { label: '평가 확정', value: byGrade.filter((e) => e.outlook.confirmed).length, active: true },
            ...GRADE_STEPS.map((g) => ({
              label: `${gradeText(g)}부터`,
              value: tracked.filter((e) => !e.outlook.confirmed && e.outlook.minGrade === g).length,
              active: GRADE_STEPS.indexOf(g) <= GRADE_STEPS.indexOf(grade),
            })),
          ].filter((b) => b.label !== '평가 확정' || b.value > 0)}
        />
        {list.length === 0 ? <EmptyState /> : (
          <div style={{ maxHeight: 560, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['이름', '직급', '본부', '지역', '현재 상태', '현재 포인트', '연차', '필요 등급', ...GRADE_STEPS.map((g) => `${gradeText(g)} 시`), '비고'].map((h) => <th key={h} style={thS}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {list.map((e) => {
                  const pr = e.outlook.projections
                  const cell = (g) => {
                    const p = pr?.[g]
                    if (!p) return <td key={g} style={{ ...tdS, color: '#cbd5e1' }}>—</td>
                    const ok = p.ptsMet && p.tenureMet
                    return (
                      <td key={g} style={{ ...tdS, color: ok ? G : '#94a3b8', fontWeight: ok ? 700 : 400, background: g === grade ? '#faf5ff' : undefined }}>
                        {p.currentPts}P {ok ? '✓' : p.ptsMet ? '(연차)' : `(-${p.gap})`}
                      </td>
                    )
                  }
                  const o = e.outlook
                  return (
                    <RowHover key={e.id} onClick={() => goTo(e.id)}>
                      <td style={nameTd}>{e.name}</td>
                      <td style={tdS}>{e.rank}</td>
                      <td style={tdS}>{e.dept || '—'}</td>
                      <td style={tdS}>{(e.locations || []).map(shortLoc).join('·') || '—'}</td>
                      <td style={tdS}><SB status={e.status} /></td>
                      <td style={tdS}><Prog current={e.currentPts} max={e.threshold} /></td>
                      <td style={tdS}>{e.effectiveLevel}/{e.req_tenure}년</td>
                      <td style={tdS}>
                        {o.bucket === 'already' ? <Bd color={G} bg="#dcfce7">이미 충족</Bd>
                          : o.confirmed ? <Bd color={B} bg="#e0f2fe">평가 확정</Bd>
                          : <Bd color={OUTLOOK[o.bucket].color} bg={OUTLOOK[o.bucket].bg}>{gradeText(o.minGrade)} 이상</Bd>}
                      </td>
                      {o.confirmed ? (
                        <td colSpan={GRADE_STEPS.length} style={{ ...tdS, color: '#64748b' }}>
                          올해 평가 확정 → {pr.actual.currentPts}P ✓
                        </td>
                      ) : o.bucket === 'already' ? (
                        <td colSpan={GRADE_STEPS.length} style={{ ...tdS, color: '#94a3b8' }}>지금도 기준 충족</td>
                      ) : GRADE_STEPS.map(cell)}
                      <td style={tdS}>
                        {(o.langBlocked || (e.engGated && !e.engOk)) && <Bd color="#c026d3" bg="#fae8ff">외국어 요건 별도</Bd>}
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
          <DownloadButton filename="고과우수자" rows={list.map(goodCsvRow)} columns={GOOD_CSV_COLS} />
        </div>
      </div>
      <ListSummary list={list} population={rows} countCaption="직급별" countBars={countBy(list, (e) => baseRank(e.rank))} />
      {list.length === 0 ? <EmptyState label="조건에 맞는 직원이 없습니다" /> : (
        <div style={{ maxHeight: 600, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['이름', '직급', '본부', '연속 우수', `최근 ${recentN}회`, '평균(10점)', '추세', '승진 상태', '올해 평가 반영 예상'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr>
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

const outlookStr = (o) => (o.bucket === 'already' ? '이미 충족' : OUTLOOK[o.bucket]?.label || '')
const goodCsvRow = (e) => ({ ...baseCsvRow(e), streakStr: `${e.trend.streak}회`, outlookText: outlookStr(e.outlook) })
const GOOD_CSV_COLS = [
  ...baseCsvCols,
  { key: 'streakStr', label: '연속 우수' },
  { key: 'recentStr', label: '최근 고과' },
  { key: 'avg', label: '평균(10점)' },
  { key: 'trendStr', label: '추세' },
  { key: 'statusLabel', label: '승진 상태' },
  { key: 'outlookText', label: '올해 평가 반영 예상' },
]
const watchCsvRow = (e) => ({ ...baseCsvRow(e), reasonStr: e.watch.map((k) => WATCH_REASON[k].label).join(' / ') })
const WATCH_CSV_COLS = [
  ...baseCsvCols,
  { key: 'reasonStr', label: '사유' },
  { key: 'recentStr', label: '최근 고과' },
  { key: 'avg', label: '평균(10점)' },
  { key: 'trendStr', label: '추세' },
  { key: 'currentPts', label: '현재 포인트' },
  { key: 'threshold', label: '진급기준' },
  { key: 'effectiveLevel', label: '현재 연차' },
  { key: 'req_tenure', label: '요구연차' },
]

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
            <DownloadButton filename="주의대상" rows={list.map(watchCsvRow)} columns={WATCH_CSV_COLS} />
          </div>
        </div>
        <ListSummary
          list={list} population={rows} countCaption="사유별 (중복 포함)"
          countBars={Object.entries(WATCH_REASON).map(([k, w]) => ({ label: w.label, value: list.filter((e) => e.watch.includes(k)).length, active: true }))}
        />
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
            <tr>{['본부', '인원', '추적 대상', '승진 가능', '올해 GD(B)면 가능', '올해 VG(A) 필요', '고과 우수자', '주의 대상', '평균 고과(10점)'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr>
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
