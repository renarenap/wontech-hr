import { GB, Tip, crd, thS, tdS } from '../components/ui'
import { O, B, P } from '../lib/constants'

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

function RankTable({ title, subtitle, color, data, note }) {
  return (
    <div style={crd}>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, marginBottom: 10 }}>{subtitle}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: subtitle ? 0 : 14 }}>
        <thead>
          <tr>{['직급', '체류연한', 'Fast Track', '기본P', '진급P'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r[0]}>
              <td style={{ ...tdS, fontWeight: 600 }}>{r[0]}</td>
              <td style={tdS}>{r[1]}년</td>
              <td style={tdS}>{r[2]}년</td>
              <td style={tdS}>{r[3]}P</td>
              <td style={{ ...tdS, color: O, fontWeight: 700 }}>{r[4]}P</td>
            </tr>
          ))}
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
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 8, lineHeight: 1.5 }}>* AL·IH 등급은 한 번 취득 시 평생 인정</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <RankTable title="② 사무직 (일반)" color={P} data={[
          ['사원', 4, 3, 24, 24], ['대리', 4, 3, 24, 24], ['과장', 5, 4, 30, 35],
          ['차장', 5, 4, 30, 36], ['부장', 5, 4, 30, 40],
        ]} />
        <RankTable
          title="③ 사무직 (영어필수)"
          subtitle="마케팅 · 미래전략 · 해외CS · 해외영업"
          color={'#0284c7'}
          data={[
            ['사원', 4, 3, 24, 24], ['대리', 4, 3, 24, 24], ['과장', 5, 4, 33, 35],
            ['차장', 5, 4, 33, 36], ['부장', 5, 4, 33, 40],
          ]}
          note="* 과장 이상 승진 시 영어 필수등급(3등급 · Im3) 이상 취득 필수"
        />
      </div>

      <RankTable title="④ 연구직" color={B} data={[
        ['연구원', 4, 3, 24, 24], ['전임연구원', 4, 3, 24, 24], ['선임연구원', 6, 5, 36, 40],
        ['책임연구원', 7, 6, 42, 48], ['수석연구원', 4, 3, 24, 32],
      ]} />

      <div style={crd}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#14b8a6' }}>⑤ 가점 (어학 · 자격증 · 기술성과)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['구분', '세부항목', '건당', '최대'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>
            {[
              ['어학', '영어 (OPIc 1~5등급)', '0.5~4P', '4P', ENG_TIP],
              ['어학', '중국어 (HSK Speaking·BCT)', '2~4P', '4P', CHN_TIP],
              ['어학', '일본어 (SJPT·JPT)', '0.5~4P', '4P', JPN_TIP],
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
          * 유효기간 있는 자격·어학은 포인트 인정을 위해 승진 후 재입증 필요
        </div>
      </div>
    </div>
  )
}
