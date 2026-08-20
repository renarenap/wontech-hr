import { useEffect, useMemo, useState } from 'react'
import { callAdminUsers } from '../lib/adminApi'
import { O, P, G } from '../lib/constants'
import { Bd, crd, thS, tdS, inp, Loading, ErrorBox, EmptyState } from '../components/ui'

const ROLES = ['관리자', '팀장', '팀원']
const ROLE_COLOR = { 관리자: { c: O, bg: '#fff7ed' }, 팀장: { c: P, bg: '#f3e8ff' }, 팀원: { c: '#475569', bg: '#f1f5f9' } }

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 380, background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 12px 40px rgba(0,0,0,.18)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

const field = { width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', marginBottom: 10 }
const label = { display: 'block', fontSize: 11, color: '#64748b', marginBottom: 5, fontWeight: 600 }
const btnPrimary = { background: O, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 16px', fontSize: 12, color: '#64748b', cursor: 'pointer' }

export default function AccountManage() {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [roleF, setRoleF] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [pwFor, setPwFor] = useState(null) // user row for password reset modal
  const [notice, setNotice] = useState(null)

  const load = async () => {
    setError(null)
    try {
      const { users } = await callAdminUsers({ action: 'list' })
      setUsers(users)
    } catch (e) {
      setError(e)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!users) return []
    return users.filter((u) => {
      if (roleF !== 'all' && u.role !== roleF) return false
      if (search) {
        const s = search.toLowerCase()
        const hay = `${u.name} ${u.email} ${u.dept} ${u.rank}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [users, search, roleF])

  const grouped = useMemo(() => {
    const g = {}
    filtered.forEach((u) => {
      const key = u.dept || '미배정'
      if (!g[key]) g[key] = []
      g[key].push(u)
    })
    return g
  }, [filtered])

  const changeRole = async (u, role) => {
    setBusy(true)
    try {
      await callAdminUsers({ action: 'update', id: u.id, name: u.name, dept: u.dept, rank: u.rank, role })
      setUsers(users.map((x) => (x.id === u.id ? { ...x, role } : x)))
    } catch (e) {
      setError(e)
    }
    setBusy(false)
  }

  const removeUser = async (u) => {
    if (!window.confirm(`${u.email} 계정을 삭제할까요? 되돌릴 수 없습니다.`)) return
    setBusy(true)
    try {
      await callAdminUsers({ action: 'delete', id: u.id })
      setUsers(users.filter((x) => x.id !== u.id))
    } catch (e) {
      setError(e)
    }
    setBusy(false)
  }

  if (error) return <ErrorBox error={error} />
  if (!users) return <Loading />

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inp, minWidth: 220 }} placeholder="🔍  이름 · 이메일 · 부서 · 직급" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select style={{ ...inp, cursor: 'pointer' }} value={roleF} onChange={(e) => setRoleF(e.target.value)}>
            <option value="all">전체 역할</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{filtered.length}명</span>
        </div>
        <button style={btnPrimary} onClick={() => setShowAdd(true)}>+ 사용자 추가</button>
      </div>

      {notice && <div style={{ ...crd, borderColor: '#bbf7d0', background: '#f0fdf4', color: '#166534', fontSize: 12 }}>{notice}</div>}

      {Object.keys(grouped).length === 0 ? (
        <div style={crd}><EmptyState label="조건에 맞는 계정이 없습니다" /></div>
      ) : (
        Object.entries(grouped).map(([dept, list]) => (
          <div key={dept} style={crd}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#64748b' }}>{dept} <span style={{ fontWeight: 400, color: '#94a3b8' }}>{list.length}명</span></div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['이메일', '이름', '직급', '역할', '작업'].map((h) => <th key={h} style={thS}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id}>
                    <td style={{ ...tdS, fontWeight: 600 }}>{u.email}</td>
                    <td style={tdS}>{u.name || '—'}</td>
                    <td style={tdS}>{u.rank || '—'}</td>
                    <td style={tdS}>
                      <select
                        style={{ ...inp, padding: '5px 10px', cursor: 'pointer', color: (ROLE_COLOR[u.role] || ROLE_COLOR['팀원']).c }}
                        value={u.role} disabled={busy}
                        onChange={(e) => changeRole(u, e.target.value)}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td style={tdS}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ ...btnGhost, padding: '5px 10px' }} onClick={() => setPwFor(u)}>비번 설정</button>
                        <button style={{ ...btnGhost, padding: '5px 10px', color: '#dc2626', borderColor: '#fecaca' }} onClick={() => removeUser(u)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {showAdd && (
        <AddUserModal
          onClose={() => setShowAdd(false)}
          onCreated={(u, tempPassword) => {
            setUsers([u, ...users])
            setShowAdd(false)
            setNotice(`${u.email} 계정이 생성되었습니다. 임시 비밀번호: ${tempPassword}`)
          }}
        />
      )}

      {pwFor && (
        <ResetPasswordModal
          user={pwFor}
          onClose={() => setPwFor(null)}
          onDone={(pw) => { setNotice(`${pwFor.email} 새 비밀번호: ${pw}`); setPwFor(null) }}
        />
      )}
    </div>
  )
}

function AddUserModal({ onClose, onCreated }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [dept, setDept] = useState('')
  const [rank, setRank] = useState('')
  const [role, setRole] = useState('팀원')
  const [password, setPassword] = useState(genPassword())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { user } = await callAdminUsers({ action: 'create', email, password, name, dept, rank, role })
      onCreated(user, password)
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  return (
    <Modal title="사용자 추가" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={label}>이메일</label>
        <input style={field} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@wontech.co.kr" />
        <label style={label}>이름</label>
        <input style={field} value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>부서</label>
            <input style={field} value={dept} onChange={(e) => setDept(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>직급</label>
            <input style={field} value={rank} onChange={(e) => setRank(e.target.value)} />
          </div>
        </div>
        <label style={label}>역할</label>
        <select style={field} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <label style={label}>임시 비밀번호</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input style={{ ...field, marginBottom: 0, fontFamily: 'monospace' }} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" style={btnGhost} onClick={() => setPassword(genPassword())}>재생성</button>
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" style={btnGhost} onClick={onClose}>취소</button>
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? '생성 중…' : '생성'}</button>
        </div>
      </form>
    </Modal>
  )
}

function ResetPasswordModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState(genPassword())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await callAdminUsers({ action: 'reset_password', id: user.id, password })
      onDone(password)
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  return (
    <Modal title={`비밀번호 재설정 — ${user.email}`} onClose={onClose}>
      <form onSubmit={submit}>
        <label style={label}>새 비밀번호</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input style={{ ...field, marginBottom: 0, fontFamily: 'monospace' }} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" style={btnGhost} onClick={() => setPassword(genPassword())}>재생성</button>
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" style={btnGhost} onClick={onClose}>취소</button>
          <button type="submit" style={btnPrimary} disabled={saving}>{saving ? '적용 중…' : '적용'}</button>
        </div>
      </form>
    </Modal>
  )
}
