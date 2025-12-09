import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { FaBullseye, FaBolt, FaLock, FaArrowLeft } from 'react-icons/fa'
import './Home.css'

function Home() {
  const [searchParams] = useSearchParams()
  const [selectedMode, setSelectedMode] = useState(null) // null, 'quiz-online', 'login'
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
      setSelectedMode('quiz-online')
    }
    
    if (mode === 'student') {
      setIsTeacher(false)
      setSelectedMode('quiz-online')
    } else if (mode === 'teacher') {
      setIsTeacher(true)
      setSelectedMode('quiz-online')
    }
  }, [searchParams])

  // Modo Login/Recuperação (Assíncrono) - redireciona direto
  useEffect(() => {
    if (selectedMode === 'login') {
      navigate('/async-home')
    }
  }, [selectedMode, navigate])

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

  const handleLoginMode = () => {
    navigate('/async-home')
  }

  const toggleMode = () => {
    setIsTeacher(!isTeacher)
    setRoomId('')
    setShowQR(false)
  }

  const currentUrl = window.location.origin
  const studentUrl = roomId ? `${currentUrl}/student/${roomId}` : ''

  // Tela inicial - escolher modo
  if (!selectedMode) {
    return (
      <div className="home-container">
        <div className="home-card">
          <h1><FaBullseye /> Sistema de Quiz</h1>
          <p className="subtitle">Escolha uma opção para continuar</p>
          
          <div className="main-options">
            <button 
              className="main-option-btn quiz-online"
              onClick={() => setSelectedMode('quiz-online')}
            >
              <div className="option-icon"><FaBolt /></div>
              <div className="option-content">
                <h2>Quiz Online</h2>
                <p>Participe de quizzes em tempo real com outros alunos</p>
              </div>
            </button>

            <button 
              className="main-option-btn login-recovery"
              onClick={() => setSelectedMode('login')}
            >
              <div className="option-icon"><FaLock /></div>
              <div className="option-content">
                <h2>Faça Login (Recuperação)</h2>
                <p>Acesse seus quizzes salvos e continue de onde parou</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Modo Quiz Online (Síncrono)
  if (selectedMode === 'quiz-online') {
    return (
      <div className="home-container">
        <div className="home-card">
          <div className="header-with-back">
            <button className="btn-back-small" onClick={() => setSelectedMode(null)}>
              <FaArrowLeft /> Voltar
            </button>
            <h1><FaBolt /> Quiz Online</h1>
            <p className="mode-description">Todos fazem o quiz juntos em tempo real</p>
          </div>
          
          <div className="role-toggle">
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

  // Retornar null enquanto redireciona para login
  if (selectedMode === 'login') {
    return null
  }

  // Fallback (não deveria chegar aqui)
  return null
}

export default Home

