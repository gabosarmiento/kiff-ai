import { useNavigate } from 'react-router-dom'

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-black flex items-center justify-center cursor-pointer" onClick={() => navigate('/login')}>
      <div className="text-center">
        <h1 className="text-9xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          kiff
        </h1>
      </div>
    </div>
  )
}