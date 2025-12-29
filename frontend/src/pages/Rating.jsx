import { useNavigate } from 'react-router-dom'
import StubPage from './StubPage'

export default function Rating() {
  const navigate = useNavigate()
  return <StubPage title="Рейтинг" onBack={() => navigate('/')} />
}
