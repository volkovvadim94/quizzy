import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Welcome from './Welcome'
import Home from './Home'

/**
 * Landing page:
 * - not authenticated => Welcome (login)
 * - authenticated => Home (topics + create/join game)
 */
export default function Landing() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center flex-1 text-white/70">Загрузка…</div>
  }

  return user ? <Home /> : <Welcome />
}
