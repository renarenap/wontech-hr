import { useEffect, useState } from 'react'
import { GB, Tip, crd, thS, tdS, Loading, ErrorBox } from '../components/ui'
import { O, B, P } from '../lib/constants'
import { fetchRankCriteria } from '../lib/promotion'

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
function RankTable({ title, subtitle, color, rows, criteriaMap, note }) {
  return (
    <div style={crd}>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, marginBottom: 10 }}>{subtitle}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: subtitle ? 0 : 14 }}>
        <thead>
          <tr>{['직급', '체류연한', 'Fast Track', '기본P', '진급P'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr>
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
                  </>
                ) : (
                  <td style={{ ...tdS, color: '#94a3b8' }} colSpan={4}>해당없음 — 별도 승진 기준을 두지 않는 직급</td>
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

function GradeMiniTable({ rows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
      <tbody>
        {rows.map(([n, p]) => (
          <tr key={n}>
            <td style={{ padding: '3px 8px 3px 0', color: '#cbd5e1' }}>{n}</td>
            <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 700, color: '#fff' }}>{p}P</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const ENG_TIP = (
  <div>
    영어 OPIc 등급별 포인트
    <GradeMiniTable rows={ENG_GRADES.map((g) => [g.n, g.p])} />
    <div style={{ marginTop: 6, color: '#94a3b8' }}>* AL·IH 등급은 한 번 취득 시 평생 인정 (승진 후에도 유지)</div>
  </div>
)

const CHN_TIP = (
  <div>
    중국어 (HSK Speaking / BCT)
    <GradeMiniTable rows={[['고급 / A급', 4], ['중급 / B급', 3], ['초급 / C급', 2]]} />
    <div style={{ marginTop: 6, color: '#94a3b8' }}>* 고급 등급은 영어 1등급과 동일하게 평생 인정</div>
  </div>
)

const JPN_TIP = (
  <div>
    일본어 (SJPT / JPT)
    <GradeMiniTable rows={[['AL', 4], ['IH / 700점 이상', 3], ['Im3 / 600점 이상', 2], ['Im2 / 500점 이상', 1], ['Im1 / 500점 미만', 0.5]]} />
    <div style={{ marginTop: 6, color: '#94a3b8' }}>* AL 등급은 영어 1등급과 동일하게 평생 인정</div>
  </div>
)

export default function Criteria() {
  const [criteriaMap, setCriteriaMap] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchRankCriteria().then(setCriteriaMap).catch(setError)
  }, [])

  if (error) return <ErrorBox error={error} />
  if (!criteriaMap) return <Loading />

  return (
    <div>
      <div style={crd}>
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
              * AL·IH 등급은 한 번 취득 시 평생 인정. 승진포인트 합산에는 들어가지 않고, 사무직(영어필수) 과장·차장 승진의 별도 필수요건으로만 사용됩니다.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <RankTable
          title="② 사무직 (일반)" color={P} criteriaMap={criteriaMap}
          rows={[['사원', 3, 24], ['대리', 3, 24], ['과장', 4, 30], ['차장', 4, 30], ['부장', 4, 30]]}
        />
        <RankTable
          title="③ 사무직 (영어필수)"
          subtitle="마케팅 · 미래전략 · 해외CS · 해외영업"
          color={'#0284c7'} criteriaMap={criteriaMap}
          rows={[['사원', 3, 24], ['대리', 3, 24], ['과장', 4, 33], ['차장', 4, 33], ['부장', 4, 33]]}
          note="* 과장·차장 승진 시 포인트·체류연한을 채워도 영어 필수등급(3등급 · Im3) 이상이 아니면 '영어 미충족'으로 표시됩니다."
        />
      </div>

      <RankTable
        title="④ 연구직" color={B} criteriaMap={criteriaMap}
        rows={[['연구원', 3, 24], ['전임연구원', 3, 24], ['선임연구원', 5, 36], ['책임연구원', 6, 42], ['수석연구원', 3, 24]]}
      />

      <div style={crd}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#14b8a6' }}>⑤ 가점 (자격증 · 기술성과 · 포상)</div>
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

      <div style={crd}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#0284c7' }}>⑥ 어학 (별도 필수요건 — 가점 풀에 포함되지 않음)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['구분', '세부항목', '건당', '최대'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>
            {[
              ['어학', '영어 (OPIc 1~5등급)', '0.5~4P', '4P', ENG_TIP],
              ['어학', '중국어 (HSK Speaking·BCT)', '2~4P', '4P', CHN_TIP],
              ['어학', '일본어 (SJPT·JPT)', '0.5~4P', '4P', JPN_TIP],
            ].map(([a, b, c, d, note], i) => (
              <tr key={i}>
                <td style={{ ...tdS, fontWeight: 600 }}>{a}</td>
                <td style={tdS}><Tip content={note}>{b}</Tip></td>
                <td style={{ ...tdS, color: '#0284c7', fontWeight: 600 }}>{c}</td><td style={tdS}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, lineHeight: 1.6 }}>
          * 영어 점수는 승진포인트 합계에 더해지지 않고, 사무직(영어필수) 과장·차장 승진 시 필수요건(Im3 이상) 충족 여부만 판단하는 데 쓰입니다.<br />
          * 제2외국어 고급/AL 등급은 영어 1등급과 동일하게 평생 인정됩니다.
        </div>
      </div>
    </div>
  )
}
