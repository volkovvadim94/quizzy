import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { SocketProvider } from './hooks/useSocket'
import Layout from './components/layout/Layout'
import Landing from './pages/Landing'
import Home from './pages/Home'
import HomeLegacy from './pages/HomeLegacy'
import Welcome from './pages/Welcome'
import JoinRoom from './pages/JoinRoom'
import Room from './pages/Room'
import Game from './pages/Game'
import Spectate from './pages/Spectate'
import Profile from './pages/Profile'
import Rating from './pages/Rating'
import Settings from './pages/Settings'
import NewGameTheme from './pages/NewGameTheme'
import NewGamePacks from './pages/NewGamePacks'
import SessionSwitched from './pages/SessionSwitched'
import ThemeLab from './pages/ThemeLab'
import { useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'

const RoomEntry = () => {
  const { gameId } = useParams()
  const navigate = useNavigate()
  useEffect(() => {
    if (gameId) navigate(`/room/${String(gameId).toUpperCase()}`, { replace: true })
  }, [gameId, navigate])
  return null
}

const FallbackRedirect = () => {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (location.pathname !== '/') navigate('/', { replace: true })
  }, [location.pathname, navigate])
  return null
}

export default function App() {
  return (
    <Router>
      <SocketProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Home />} />
            <Route path="/home-legacy" element={<HomeLegacy />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/join" element={<JoinRoom />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/rating" element={<Rating />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/new-game/theme" element={<NewGameTheme />} />
            <Route path="/new-game/packs" element={<NewGamePacks />} />
            <Route path="/session-switched" element={<SessionSwitched />} />
            <Route path="/themelab" element={<ThemeLab />} />
            <Route path="/:gameId([A-Za-z0-9]{6})" element={<RoomEntry />} />
            <Route path="/room/:gameId" element={<Room />} />
            <Route path="/game/:gameId" element={<Game />} />
            <Route path="/spectate/:spectateToken" element={<Spectate />} />
            <Route path="*" element={<FallbackRedirect />} />
          </Routes>
        </Layout>
      </SocketProvider>
    </Router>
  )
}
