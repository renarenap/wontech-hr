import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import EmployeeList from './pages/EmployeeList'
import EmployeeDetail from './pages/EmployeeDetail'
import Criteria from './pages/Criteria'
import HireResign from './pages/HireResign'
import Transfer from './pages/Transfer'
import Recruit from './pages/Recruit'
import AccountManage from './pages/AccountManage'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
        불러오는 중…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <RedirectIfAuthed>
                <Login />
              </RedirectIfAuthed>
            }
          />
          <Route
            path="/signup"
            element={
              <RedirectIfAuthed>
                <Signup />
              </RedirectIfAuthed>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <RedirectIfAuthed>
                <ForgotPassword />
              </RedirectIfAuthed>
            }
          />
          {/* 세션이 없는 상태에서 복구 코드를 교환해야 하므로 인증 가드를 걸지 않음 */}
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees" element={<EmployeeList />} />
            <Route path="/employees/:id" element={<EmployeeDetail />} />
            <Route path="/criteria" element={<Criteria />} />
            <Route path="/hire-resign" element={<HireResign />} />
            {/* 예전 주소 호환용 리다이렉트 */}
            <Route path="/hire" element={<Navigate to="/hire-resign" replace />} />
            <Route path="/resign" element={<Navigate to="/hire-resign" replace />} />
            <Route path="/onboarding" element={<Navigate to="/hire-resign" replace />} />
            <Route path="/transfer" element={<Transfer />} />
            <Route path="/recruit" element={<Recruit />} />
            <Route path="/accounts" element={<AccountManage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
