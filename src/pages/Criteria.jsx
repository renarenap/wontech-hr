import { GB, crd, thS, tdS } from '../components/ui'
import { O, B, P } from '../lib/constants'

// 참고: 등급 환산표는 회사 규정에 맞춰 수정하세요. 아래는 원안 구조를 유지한 예시 값입니다.
const NEW_GRADES = [
  { n: 'EX', np: 10, p: '10%' }, { n: 'VG', np: 8, p: '30%' }, { n: 'GD', np: 6, p: '50%' },
  { n: 'NI', np: 4, p: '5%' }, { n: 'UN', np: 2, p: '5%' },
]

function RankTable({ title, color, data }) {
  return (
    <div style={crd}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
    </div>
  )
}

export default function Criteria() {
  return (
    <div>
      <div style={crd}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: O }}>① 평가등급별 포인트</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
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
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <RankTable title="② 사무직" color={P} data={[
          ['사원', 4, 3, 24, 24], ['대리', 4, 3, 24, 24], ['과장', 5, 4, 30, 34],
          ['차장', 5, 4, 30, 35], ['부장', 5, 4, 30, 40],
        ]} />
        <RankTable title="③ 연구직" color={B} data={[
          ['연구원', 4, 3, 24, 24], ['전임연구원', 4, 3, 24, 24], ['선임연구원', 6, 5, 36, 40],
          ['책임연구원', 7, 6, 42, 48], ['수석연구원', 4, 3, 24, 32],
        ]} />
      </div>

      <div style={crd}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#14b8a6' }}>④ 가점</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['구분', '세부항목', '건당', '최대'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>
            {[
              ['전문 자격', '기술사·기능장·기사', '3P', '6P'],
              ['기술 성과', '해외 특허/국제논문', '3P', '6P'],
              ['기술 성과', '국내 특허 등록', '2P', '6P'],
              ['직무 자격', '산업기사, 민간자격', '1P', '3P'],
              ['포상', '대외 포상', '2P', '4P'],
              ['포상', '사내 포상', '1P', '2P'],
            ].map(([a, b, c, d], i) => (
              <tr key={i}>
                <td style={{ ...tdS, fontWeight: 600 }}>{a}</td><td style={tdS}>{b}</td>
                <td style={{ ...tdS, color: '#14b8a6', fontWeight: 600 }}>{c}</td><td style={tdS}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
