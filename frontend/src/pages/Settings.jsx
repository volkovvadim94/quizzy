import { useNavigate } from 'react-router-dom'
import StubPage from './StubPage'

export default function Settings() {
  const navigate = useNavigate()
  return <StubPage title="Настройки" onBack={() => navigate('/')} />
}
