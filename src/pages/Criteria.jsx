import { useEffect, useState } from 'react'
import { GB, Tip, crd, thS, tdS, Loading, ErrorBox } from '../components/ui'
import { O, B, P, G } from '../lib/constants'
import { fetchRankCriteria, fetchLeaveRate } from '../lib/promotion'

// 참고: 등급 환산표는 회사 규정에 맞춰 수정하세요. 아래는 원안 구조를 유지한 예시 값입니다.
const NEW_GRADES = [
  { n: 'EX', np: 10, p: '10%' }, { n: 'VG', np: 8, p: '30%' }, { n: 'GD', np: 6, p: '50%' },
  { n: 'NI', np: 4, p: '5%' }, { n: 'UN', np: 2, p: '5%' },
]

// 영어등급 포인트 (①표 부속) — 1등급(AL)~5등급(Im1)
const ENG_GRADES = [
  { n: '1등급 (AL)', p: 4 }, { n: '2등급 (IH)', p: 3 }, { n: '3등급 (Im3)', p: 2 },
  { n: '4등급 (Im2)', p: 1 }, { n: '5등급 (Im1)', p: 0.5 },
]

// 체류연한/진급포인트는 "기준값 설정"(rank_criteria)에서 실시간으로 가져옵니다.
// Fast Track 체류연한·기본P는 계산에는 안 쓰이는 참고용 수치라 여기서만 관리합니다.
function RankTable({ id, title, subtitle, color, rows, criteriaMap, note }) {
  return (
    <div id={id} style={{ ...crd, scrollMarginTop: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, marginBottom: 10 }}>{subtitle}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: subtitle ? 0 : 14 }}>
        <thead>
          <tr>{['직급', '체류연한', 'Fast Track', '기본P', '진급P', '인정포인트 기준(연차당)'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(([rank, fast, basePts]) => {
            const rc = criteriaMap[rank]
            const hasCriteria = !!rc && (rc.req_tenure > 0 || rc.threshold > 0)
            return (
              <tr key={rank}>
                <td style={{ ...tdS, fontWeight: 600 }}>{rank}</td>
                {hasCriteria ? (
                  <>
                    <td style={tdS}>{rc.req_tenure}년</td>
                    <td style={tdS}>{fast}년</td>
                    <td style={tdS}>{basePts}P</td>
                    <td style={{ ...tdS, color: O, fontWeight: 700 }}>{rc.threshold}P</td>
                    <td style={tdS}>{rc.backfill_rate || 0}P/연차</td>
                  </>
                ) : (
                  <td style={{ ...tdS, color: '#94a3b8' }} colSpan={5}>해당없음 — 별도 승진 기준을 두지 않는 직급</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      {note && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, lineHeight: 1.5 }}>{note}</div>}
    </div>
  )
}

// 자격증 세부항목 hover 시 보여줄 예시/부연설명 (실제 규정 비고란 기준)
const CERT_NOTE = '변리사·노무사·세무사 등 직무와 직접 연관된 국가전문·기술자격에 한함'
const PATENT_NOTE = '제1발명자 100%, 공동발명자 50% 인정'

// 어학 등급별 배점표 — 영어/중국어/일본어 각각 별도 점수로 입력받고(상세화면 "어학" 카드),
// 이 표는 등급→점수 환산 기준을 보여주는 참고용일 뿐 계산 로직과는 연결돼 있지 않음
const LANG_GRADE_ROWS = [
  { p: '4P', grade: 'AL', eng: '9~10급 · 고급', cn: '9~10급 · 고급', jp: '9~10급' },
  { p: '3P', grade: 'IH', eng: '7~8급 · 중급', cn: '7~8급 · 중급', jp: '7~8급' },
  { p: '2P', grade: 'IM3', eng: '5~6급 · 초급', cn: '5~6급 · 초급', jp: '5~6급' },
  { p: '1P', grade: 'IM2', eng: '4급', cn: '4급', jp: '4급' },
  { p: '0.5P', grade: 'IM1', eng: '3급', cn: '3급', jp: '3급' },
]

export default function Criteria() {
  const [criteriaMap, setCriteriaMap] = useState(null)
  const [leaveRate, setLeaveRate] = useState(6)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([fetchRankCriteria(), fetchLeaveRate()])
      .then(([cm, lr]) => { setCriteriaMap(cm); setLeaveRate(lr) })
      .catch(setError)
  }, [])

  if (error) return <ErrorBox error={error} />
  if (!criteriaMap) return <Loading />

  const NAV = [
    { id: 'sec-1', label: '① 평가등급 포인트' },
    { id: 'sec-2', label: '② 인정포인트 산출방식' },
    { id: 'sec-3', label: '③ 사무직(일반)' },
    { id: 'sec-4', label: '④ 사무직(외국어필수)' },
    { id: 'sec-5', label: '⑤ 연구직' },
    { id: 'sec-6', label: '⑥ 가점' },
    { id: 'sec-7', label: '⑦ 어학' },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, padding: '10px 12px',
          background: '#fff', border: '1px solid var(--border)', borderRadius: 10, position: 'sticky', top: 0, zIndex: 5,
        }}
      >
        {NAV.map((n) => (
          <a
            key={n.id} href={`#${n.id}`}
            style={{
              fontSize: 11, fontWeight: 600, color: '#64748b', textDecoration: 'none',
              padding: '5px 10px', borderRadius: 20, background: '#f1f5f9', whiteSpace: 'nowrap',
            }}
          >
            {n.label}
          </a>
        ))}
      </div>

      <div id="sec-1" style={{ ...crd, scrollMarginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: O }}>① 평가등급별 포인트</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr', gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>'23~'25 반기</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thS}>등급</th><th style={thS}>반기</th><th style={thS}>연간</th></tr></thead>
              <tbody>
                {[{ o: 'S', op: 5 }, { o: 'A+', op: 4.5 }, { o: 'A', op: 4 }, { o: 'B+', op: 3.5 }, { o: 'B', op: 3 }, { o: 'C', op: 2 }, { o: 'D', op: 1 }].map((r) => (
                  <tr key={r.o}><td style={tdS}><GB grade={r.o} /></td><td style={tdS}>{r.op}</td><td style={tdS}>{r.op * 2}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>2026년~ 연간</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thS}>등급</th><th style={thS}>포인트</th><th style={thS}>배분율</th></tr></thead>
              <tbody>
                {NEW_GRADES.map((r) => (
                  <tr key={r.n}><td style={{ ...tdS, fontWeight: 700, color: P }}>{r.n}</td><td style={tdS}>{r.np}P</td><td style={tdS}>{r.p}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>영어 등급 포인트</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thS}>등급</th><th style={thS}>포인트</th></tr></thead>
              <tbody>
                {ENG_GRADES.map((r) => (
                  <tr key={r.n}><td style={{ ...tdS, fontWeight: 700, color: '#0284c7' }}>{r.n}</td><td style={tdS}>{r.p}P</td></tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 8, lineHeight: 1.5 }}>
              * AL·IH 등급은 한 번 취득 시 평생 인정. 승진포인트 합산에 포함되고, 동시에 사무직(외국어필수) 과장·차장 승진의 별도 필수요건(영어·중국어·일본어 중 하나)으로도 쓰입니다.
            </div>
          </div>
        </div>
      </div>

      <div id="sec-2" style={{ ...crd, scrollMarginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: '#0284c7' }}>② 실제 평가 없이 포인트가 채워지는 3가지 경우</div>
        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
          목록·상세 화면의 <b>"경력인정P"</b> 하나로 묶여서 보이지만, 실제로는 서로 다른 조건에서 계산되는 별개 항목이에요 — 헷갈리기 쉬워서 여기 정리해둡니다. 세 항목은 서로 중복 없이 각자 조건에서만 계산됩니다.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
          <thead><tr>{['이름', '대상', '계산식'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>
            <tr>
              <td style={{ ...tdS, fontWeight: 700, color: P }}>경력직 인정포인트</td>
              <td style={tdS}>경력직 입사 등 이 회사에서 평가받은 이력이 아예 없는 사람 (CSV "경력직인정포인트 적용" = TRUE)</td>
              <td style={tdS}>연차 × 직급별 기준점수 (아래 ③~⑤표 "인정포인트 기준")</td>
            </tr>
            <tr>
              <td style={{ ...tdS, fontWeight: 700, color: '#0284c7' }}>평가 인정포인트</td>
              <td style={tdS}>재직 중인데 평가 이력에 일부 공백이 있는 사람 (위 TRUE가 아닌 나머지 전원)</td>
              <td style={tdS}>(예상평가건수 − 실제평가건수) × 기준점수 ÷ 2</td>
            </tr>
            <tr>
              <td style={{ ...tdS, fontWeight: 700, color: G }}>휴직 포인트</td>
              <td style={tdS}>휴직 기간이 있는 사람 (직급·기준점수와 무관)</td>
              <td style={tdS}>휴직 개월수 × {(leaveRate / 12).toFixed(2)}P (1년 기준 {leaveRate}P) — 체류연한에도 그대로 합산됨</td>
            </tr>
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, lineHeight: 1.6 }}>
          * "평가 인정포인트"의 예상평가건수·실제평가건수는 반기 평가 1건 = 1건, 2026년~ 연간(통합) 평가 1건 = 2건으로 자동 환산해서 계산해요.
          그래서 내년부터 평가가 반기제 → 연 1회 통합으로 바뀌어도 계산 방식은 그대로 적용되고, 별도로 손볼 부분이 없습니다.
        </div>
      </div>

      {/* 아래 3개 표 색은 목록/상세 화면의 직군 뱃지 색과 맞춤(사무=회색, 외국어필수=파랑, 연구=보라) — 색만 보고도 어느 표인지 바로 알아보게 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <RankTable
          id="sec-3"
          title="③ 사무직 (일반)" color="#475569" criteriaMap={criteriaMap}
          rows={[['사원', 3, 24], ['대리', 3, 24], ['과장', 4, 30], ['차장', 4, 30], ['부장', 4, 30]]}
        />
        <RankTable
          id="sec-4"
          title="④ 사무직 (외국어필수)"
          subtitle="마케팅 · 미래전략 · 해외CS · 해외영업"
          color={B} criteriaMap={criteriaMap}
          rows={[['사원', 3, 24], ['대리', 3, 24], ['과장', 4, 33], ['차장', 4, 33], ['부장', 4, 33]]}
          note="* 과장·차장 승진 시 포인트·체류연한을 채워도 영어 또는 제2외국어 필수등급(3등급 · Im3) 이상이 아니면 '외국어 미충족'으로 표시됩니다."
        />
      </div>

      <RankTable
        id="sec-5"
        title="⑤ 연구직" color={P} criteriaMap={criteriaMap}
        rows={[['연구원', 3, 24], ['전임연구원', 3, 24], ['선임연구원', 5, 36], ['책임연구원', 6, 42], ['수석연구원', 3, 24]]}
      />

      <div id="sec-6" style={{ ...crd, scrollMarginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#14b8a6' }}>⑥ 가점 (자격증 · 기술성과 · 포상)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['구분', '세부항목', '건당', '최대'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>
            {[
              ['전문 자격', '기술사·기능장·기사', '3P', '6P', CERT_NOTE],
              ['기술 성과', '해외 특허/국제논문', '3P', '6P', null],
              ['기술 성과', '국내 특허 등록', '2P', '6P', PATENT_NOTE],
              ['직무 자격', '산업기사, 민간자격', '1P', '3P', null],
              ['포상', '대외 포상', '2P', '4P', null],
              ['포상', '사내 포상', '1P', '2P', null],
            ].map(([a, b, c, d, note], i) => (
              <tr key={i}>
                <td style={{ ...tdS, fontWeight: 600 }}>{a}</td>
                <td style={tdS}><Tip content={note}>{b}</Tip></td>
                <td style={{ ...tdS, color: '#14b8a6', fontWeight: 600 }}>{c}</td><td style={tdS}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, lineHeight: 1.6 }}>
          * 동일분야 상위자격 취득 시 상위 1개만 인정 · 직무 유관성은 조직장 및 인사파트 승인 필요<br />
          * 유효기간 있는 자격은 포인트 인정을 위해 승진 후 재입증 필요
        </div>
      </div>

      <div id="sec-7" style={{ ...crd, scrollMarginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: '#0284c7' }}>⑦ 어학 (가점 풀에 포함 + 별도 필수요건 겸용)</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
          영어·중국어·일본어 각각 별도 점수로 관리돼요(상세화면 "어학" 카드에서 등록·수정). 아래는 등급→점수 환산 참고표이고,
          이 표 자체가 계산에 자동으로 연결되진 않으니 등급을 보고 해당 점수를 직접 입력해주세요.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thS}>배점</th>
              <th style={thS}>영어<br /><span style={{ fontWeight: 400, color: '#94a3b8' }}>OPIc · TOEIC Speaking</span></th>
              <th style={thS}>중국어<br /><span style={{ fontWeight: 400, color: '#94a3b8' }}>TSC · OPIc Chinese · HSKK</span></th>
              <th style={thS}>일본어<br /><span style={{ fontWeight: 400, color: '#94a3b8' }}>SJPT · OPIc Japanese</span></th>
            </tr>
          </thead>
          <tbody>
            {LANG_GRADE_ROWS.map((r) => (
              <tr key={r.grade}>
                <td style={{ ...tdS, fontWeight: 700, color: '#0284c7' }}>{r.p}</td>
                <td style={tdS}>{r.grade} · {r.eng}</td>
                <td style={tdS}>{r.grade} · {r.cn}</td>
                <td style={tdS}>{r.grade} · {r.jp}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, lineHeight: 1.6 }}>
          * 세 언어 점수 모두 승진포인트 합계에 그대로 더해지고, 동시에 사무직(외국어필수) 과장·차장 승진 시 필수요건(셋 중 하나라도 IM3 이상) 충족 여부도 판단합니다.<br />
          * AL 등급은 취득 언어와 무관하게 평생 인정됩니다.<br />
          * 여기 없는 기타 외국어 시험(말하기 외 시험 등)은 "자격증" 카드에 직무자격(건당 1P, 최대 3P)으로 등록해주세요.
        </div>
      </div>
    </div>
  )
}
