import { useAuth } from '../hooks/useAuth'
import Welcome from './Welcome'
import Home from './Home'

/**
 * Landing page:
 * - not authenticated => Welcome (login)
 * - authenticated => Home (homepage)
 */
export default function Landing() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center flex-1 text-base-content/70">Загрузка…</div>
  }

  return user ? <Home /> : <Welcome />
}
