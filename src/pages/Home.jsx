import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import './Home.css'

function Home() {
  const [searchParams] = useSearchParams()
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [isTeacher, setIsTeacher] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const navigate = useNavigate()

  // Ler parâmetros da URL ao carregar
  useEffect(() => {
    const urlRoomId = searchParams.get('roomId')
    const mode = searchParams.get('mode')
    
    if (urlRoomId) {
      setRoomId(urlRoomId.toUpperCase())
    }
    
    if (mode === 'student') {
      setIsTeacher(false)
    } else if (mode === 'teacher') {
      setIsTeacher(true)
    }
  }, [searchParams])

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const handleCreateRoom = () => {
    if (!name.trim()) {
      alert('Por favor, digite seu nome')
      return
    }

    const newRoomId = generateRoomId()
    navigate(`/teacher/${newRoomId}?name=${encodeURIComponent(name)}`)
  }

  const handleJoinRoom = () => {
    if (!name.trim() || !roomId.trim()) {
      alert('Por favor, preencha todos os campos')
      return
    }

    navigate(`/student/${roomId}?name=${encodeURIComponent(name)}`)
  }

  const toggleMode = () => {
    setIsTeacher(!isTeacher)
    setRoomId('')
    setShowQR(false)
  }

  const currentUrl = window.location.origin
  const studentUrl = roomId ? `${currentUrl}/student/${roomId}` : ''

  return (
    <div className="home-container">
      <div className="home-card">
        <h1>🎯 Quiz Online</h1>
        
        <div className="mode-toggle">
          <button
            className={isTeacher ? 'active' : ''}
            onClick={() => setIsTeacher(true)}
          >
            Professor
          </button>
          <button
            className={!isTeacher ? 'active' : ''}
            onClick={() => setIsTeacher(false)}
          >
            Aluno
          </button>
        </div>

        <div className="form-group">
          <label>Seu Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Digite seu nome"
            maxLength={20}
          />
        </div>

        {isTeacher ? (
          <>
            <button className="btn-primary" onClick={handleCreateRoom}>
              Criar Sala
            </button>
            {roomId && (
              <div className="room-info">
                <p>Código da Sala: <strong>{roomId}</strong></p>
                <button
                  className="btn-secondary"
                  onClick={() => setShowQR(!showQR)}
                >
                  {showQR ? 'Ocultar' : 'Mostrar'} QR Code
                </button>
                {showQR && studentUrl && (
                  <div className="qr-container">
                    <QRCodeSVG value={studentUrl} size={200} />
                    <p className="qr-url">{studentUrl}</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="form-group">
              <label>Código da Sala</label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="Digite o código"
                maxLength={6}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <button className="btn-primary" onClick={handleJoinRoom}>
              Entrar na Sala
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default Home

