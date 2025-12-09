import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getSocketUrl } from '../utils/socketConfig'
import { FaGraduationCap } from 'react-icons/fa'
import './StudentLogin.css'

function StudentLogin() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const urlName = searchParams.get('name')
    if (urlName) {
      setName(urlName)
    }
  }, [searchParams])

  const handleRegister = async () => {
    if (!name.trim()) {
      setError('Por favor, digite seu nome')
      return
    }

    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/register-student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: name.trim() })
      })

      const data = await response.json()

      if (data.success) {
        // Salvar ID do aluno no localStorage
        localStorage.setItem('asyncStudentId', data.studentId)
        localStorage.setItem('asyncStudentName', name.trim())
        navigate('/async-student')
      } else {
        setError(data.message || 'Erro ao cadastrar')
      }
    } catch (err) {
      setError('Erro de conexão. Tente novamente.')
      console.error('Erro ao cadastrar:', err)
    }
  }

  const handleLogin = async () => {
    if (!name.trim()) {
      setError('Por favor, digite seu nome')
      return
    }

    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/login-student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: name.trim() })
      })

      const data = await response.json()

      if (data.success) {
        localStorage.setItem('asyncStudentId', data.studentId)
        localStorage.setItem('asyncStudentName', name.trim())
        navigate('/async-student')
      } else {
        setError(data.message || 'Aluno não encontrado')
      }
    } catch (err) {
      setError('Erro de conexão. Tente novamente.')
      console.error('Erro ao fazer login:', err)
    }
  }

  return (
    <div className="student-login-container">
      <div className="student-login-card">
        <h1><FaGraduationCap /> Acesso de Aluno</h1>
        
        <div className="auth-toggle">
          <button
            className={!isRegistering ? 'active' : ''}
            onClick={() => {
              setIsRegistering(false)
              setError('')
            }}
          >
            Entrar
          </button>
          <button
            className={isRegistering ? 'active' : ''}
            onClick={() => {
              setIsRegistering(true)
              setError('')
            }}
          >
            Cadastrar
          </button>
        </div>

        <div className="form-group">
          <label>Seu Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            placeholder="Digite seu nome"
            maxLength={50}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                isRegistering ? handleRegister() : handleLogin()
              }
            }}
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button 
          className="btn-primary" 
          onClick={isRegistering ? handleRegister : handleLogin}
        >
          {isRegistering ? 'Cadastrar' : 'Entrar'}
        </button>

        <button 
          className="btn-back" 
          onClick={() => navigate('/')}
        >
          ← Voltar
        </button>
      </div>
    </div>
  )
}

export default StudentLogin

