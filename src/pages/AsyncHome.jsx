import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSocketUrl, getApiUrl } from '../utils/socketConfig'
import { FaGraduationCap, FaLock, FaBook, FaCheckCircle, FaFileAlt, FaChartBar, FaTrash, FaTimes, FaTrashAlt, FaClock } from 'react-icons/fa'
import { MdArrowBack } from 'react-icons/md'
import './AsyncHome.css'

function AsyncHome() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userId, setUserId] = useState(null)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    // Verificar se já está logado
    const savedUserId = localStorage.getItem('asyncUserId')
    const savedUserName = localStorage.getItem('asyncUserName')
    
    if (savedUserId && savedUserName) {
      setUserId(savedUserId)
      setUserName(savedUserName)
      setIsLoggedIn(true)
    }
  }, [])

  const handleRegister = async () => {
    if (!name.trim()) {
      setError('Por favor, digite seu nome')
      return
    }

    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/register-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: name.trim() })
      })

      const data = await response.json()

      if (data.success) {
        localStorage.setItem('asyncUserId', data.userId)
        localStorage.setItem('asyncUserName', name.trim())
        setUserId(data.userId)
        setUserName(name.trim())
        setIsLoggedIn(true)
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
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/login-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: name.trim() })
      })

      const data = await response.json()

      if (data.success) {
        localStorage.setItem('asyncUserId', data.userId)
        localStorage.setItem('asyncUserName', name.trim())
        setUserId(data.userId)
        setUserName(name.trim())
        setIsLoggedIn(true)
      } else {
        setError(data.message || 'Usuário não encontrado')
      }
    } catch (err) {
      setError('Erro de conexão. Tente novamente.')
      console.error('Erro ao fazer login:', err)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('asyncUserId')
    localStorage.removeItem('asyncUserName')
    setUserId(null)
    setUserName('')
    setIsLoggedIn(false)
    setName('')
    setError('')
  }

  if (isLoggedIn) {
    return (
      <div className="async-home-container">
        <div className="async-home-card">
          <div className="user-header">
            <h1><FaGraduationCap /> Bem-vindo, {userName}!</h1>
            <button className="btn-logout" onClick={handleLogout}>
              Sair
            </button>
          </div>
          
          <AsyncDashboard userId={userId} userName={userName} />
        </div>
      </div>
    )
  }

  return (
    <div className="async-home-container">
      <div className="async-home-card">
        <h1><FaLock /> Faça Login</h1>
        <p className="subtitle">Acesse seus quizzes e atividades</p>
        
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
          <MdArrowBack /> Voltar
        </button>
      </div>
    </div>
  )
}

// Componente do Dashboard (onde usuários veem e criam quizzes)
function AsyncDashboard({ userId, userName }) {
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState([])
  const [showQuizForm, setShowQuizForm] = useState(false)
  const [newQuiz, setNewQuiz] = useState({
    title: '',
    description: '',
    questions: [],
    hasTimeLimit: true
  })
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    time: 30
  })
  const [userProgress, setUserProgress] = useState({})
  const [selectedQuizForResults, setSelectedQuizForResults] = useState(null)
  const [quizResults, setQuizResults] = useState([])

  useEffect(() => {
    loadQuizzes()
    loadUserProgress()
  }, [userId])

  const loadQuizzes = async () => {
    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/quizzes`)
      const data = await response.json()
      if (data.success) {
        setQuizzes(data.quizzes || [])
      }
    } catch (err) {
      console.error('Erro ao carregar quizzes:', err)
    }
  }

  const loadUserProgress = async () => {
    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/user-progress?userId=${userId}`)
      const data = await response.json()
      if (data.success) {
        setUserProgress(data.progress || {})
      }
    } catch (err) {
      console.error('Erro ao carregar progresso:', err)
    }
  }

  const loadQuizResults = async (quizId) => {
    try {
      const apiUrl = getApiUrl(`/api/async/quiz-results/${quizId}?creatorId=${userId}`)
      console.log('Carregando resultados de:', apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      // Verificar se a resposta é OK
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Erro HTTP:', response.status, errorText.substring(0, 200))
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      // Verificar se o conteúdo é JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Resposta não é JSON. Content-Type:', contentType)
        console.error('Primeiros 500 caracteres da resposta:', text.substring(0, 500))
        throw new Error('Resposta do servidor não é JSON. Verifique se o servidor está rodando.')
      }
      
      const data = await response.json()
      if (data.success) {
        setQuizResults(data.results || [])
      } else {
        alert(data.message || 'Erro ao carregar resultados')
        setQuizResults([])
      }
    } catch (err) {
      console.error('Erro ao carregar resultados:', err)
      alert(`Erro ao carregar resultados: ${err.message}\n\nVerifique se o servidor está rodando na porta 3001.`)
      setQuizResults([])
    }
  }

  const handleViewResults = (quiz) => {
    setSelectedQuizForResults(quiz)
    loadQuizResults(quiz.id)
  }

  const handleCancelStudentResult = async (quizId, studentId) => {
    if (!confirm('Tem certeza que deseja cancelar o resultado deste aluno?')) {
      return
    }

    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/cancel-student-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quizId,
          studentId,
          creatorId: userId
        })
      })

      const data = await response.json()
      if (data.success) {
        alert('Resultado cancelado com sucesso!')
        loadQuizResults(quizId)
        loadUserProgress() // Recarregar progresso geral
      } else {
        alert(data.message || 'Erro ao cancelar resultado')
      }
    } catch (err) {
      console.error('Erro ao cancelar resultado:', err)
      alert('Erro ao cancelar resultado')
    }
  }

  const handleDeleteQuiz = async (quizId) => {
    if (!confirm('Tem certeza que deseja deletar este quiz? Esta ação não pode ser desfeita e todos os resultados serão perdidos.')) {
      return
    }

    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/delete-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quizId,
          creatorId: userId
        })
      })

      const data = await response.json()
      if (data.success) {
        alert('Quiz deletado com sucesso!')
        // Fechar modal de resultados se estiver aberto
        if (selectedQuizForResults?.id === quizId) {
          setSelectedQuizForResults(null)
          setQuizResults([])
        }
        loadQuizzes() // Recarregar lista de quizzes
        loadUserProgress() // Recarregar progresso
      } else {
        alert(data.message || 'Erro ao deletar quiz')
      }
    } catch (err) {
      console.error('Erro ao deletar quiz:', err)
      alert('Erro ao deletar quiz')
    }
  }


  const handleAddQuestion = () => {
    if (!newQuestion.text.trim() || newQuestion.options.some(opt => !opt.trim())) {
      alert('Preencha todos os campos da pergunta')
      return
    }

    setNewQuiz({
      ...newQuiz,
      questions: [...newQuiz.questions, { ...newQuestion }]
    })

    setNewQuestion({
      text: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      time: 30
    })
    setShowQuestionForm(false)
  }

  const handleImportJSON = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result)
        const importedQuestions = Array.isArray(json) ? json : json.questions || []
        
        if (importedQuestions.length === 0) {
          alert('Nenhuma pergunta encontrada no arquivo')
          return
        }

        setNewQuiz({
          ...newQuiz,
          questions: [...newQuiz.questions, ...importedQuestions]
        })
        alert(`${importedQuestions.length} pergunta(s) importada(s) com sucesso!`)
        event.target.value = ''
      } catch (error) {
        alert(`Erro ao importar JSON: ${error.message}`)
        event.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  const handleCreateQuiz = async () => {
    if (!newQuiz.title.trim()) {
      alert('Digite um título para o quiz')
      return
    }

    if (newQuiz.questions.length === 0) {
      alert('Adicione pelo menos uma pergunta')
      return
    }

    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/create-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newQuiz.title,
          description: newQuiz.description,
          questions: newQuiz.questions,
          hasTimeLimit: newQuiz.hasTimeLimit,
          creatorName: userName,
          creatorId: userId
        })
      })

      const data = await response.json()
      if (data.success) {
        alert('Quiz criado com sucesso!')
        setNewQuiz({ title: '', description: '', questions: [], hasTimeLimit: true })
        setShowQuizForm(false)
        loadQuizzes()
      } else {
        alert(data.message || 'Erro ao criar quiz')
      }
    } catch (err) {
      alert('Erro de conexão. Tente novamente.')
      console.error('Erro ao criar quiz:', err)
    }
  }

  const handleStartQuiz = (quiz) => {
    // Verificar se é o criador
    if (quiz.creatorId === userId) {
      alert('Você não pode fazer seu próprio quiz! Use a opção "Ver Resultados" para gerenciar seu quiz.')
      return
    }

    // Verificar se já fez
    if (userProgress[quiz.id]?.completed) {
      alert('Você já completou este quiz!')
      return
    }

    // Navegar para a página de fazer quiz
    navigate(`/async-quiz/${quiz.id}`)
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2><FaBook /> Quizzes Disponíveis</h2>
        <button 
          className="btn-primary" 
          onClick={() => {
            setShowQuizForm(!showQuizForm)
          }}
        >
          {showQuizForm ? 'Cancelar' : '+ Criar Quiz'}
        </button>
      </div>

      {showQuizForm && (
        <div className="quiz-form">
          <h3>Criar Novo Quiz</h3>
          <div className="form-group">
            <label>Título do Quiz</label>
            <input
              type="text"
              value={newQuiz.title}
              onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
              placeholder="Ex: Quiz de Matemática"
            />
          </div>

          <div className="form-group">
            <label>Descrição (opcional)</label>
            <textarea
              value={newQuiz.description}
              onChange={(e) => setNewQuiz({ ...newQuiz, description: e.target.value })}
              placeholder="Descreva o quiz..."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={newQuiz.hasTimeLimit}
                onChange={(e) => setNewQuiz({ ...newQuiz, hasTimeLimit: e.target.checked })}
              />
              <span>Quiz com tempo limitado por pergunta</span>
            </label>
            <p className="form-hint">
              {newQuiz.hasTimeLimit 
                ? 'Cada pergunta terá um tempo limite. O aluno não poderá voltar às perguntas anteriores.'
                : 'Sem tempo limite. O aluno poderá navegar entre as perguntas e revisar suas respostas.'}
            </p>
          </div>

          <div className="questions-section">
            <h3>Perguntas ({newQuiz.questions.length})</h3>
            
            <button
              className="btn-secondary"
              onClick={() => setShowQuestionForm(!showQuestionForm)}
            >
              {showQuestionForm ? 'Cancelar' : '+ Adicionar Pergunta'}
            </button>

            {showQuestionForm && (
              <div className="question-form">
                <div className="form-group">
                  <label>Texto da Pergunta</label>
                  <input
                    type="text"
                    value={newQuestion.text}
                    onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                    placeholder="Digite a pergunta"
                  />
                </div>

                <div className="form-group">
                  <label>Opções de Resposta</label>
                  {newQuestion.options.map((option, index) => (
                    <div key={index} className="option-input">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...newQuestion.options]
                          newOptions[index] = e.target.value
                          setNewQuestion({ ...newQuestion, options: newOptions })
                        }}
                        placeholder={`Opção ${String.fromCharCode(65 + index)}`}
                      />
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={newQuestion.correctAnswer === index}
                        onChange={() => setNewQuestion({ ...newQuestion, correctAnswer: index })}
                      />
                      <label>Correta</label>
                    </div>
                  ))}
                </div>

                <div className="form-group">
                  <label>Tempo (segundos)</label>
                  <input
                    type="number"
                    value={newQuestion.time}
                    onChange={(e) => setNewQuestion({ ...newQuestion, time: parseInt(e.target.value) || 30 })}
                    min="10"
                    max="300"
                  />
                </div>

                <button className="btn-primary" onClick={handleAddQuestion}>
                  Adicionar Pergunta
                </button>
              </div>
            )}

            <div className="form-group">
              <label>Importar JSON</label>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
              />
            </div>

            <div className="questions-list">
              {newQuiz.questions.map((q, index) => (
                <div key={index} className="question-item">
                  <p><strong>{index + 1}.</strong> {q.text}</p>
                  <p className="question-time"><FaClock /> {q.time}s</p>
                </div>
              ))}
            </div>
          </div>

          <button 
            className="btn-primary" 
            onClick={handleCreateQuiz}
            disabled={newQuiz.questions.length === 0}
          >
            Criar Quiz
          </button>
        </div>
      )}

      {selectedQuizForResults && (
        <div className="quiz-results-modal">
          <div className="quiz-results-content">
            <div className="results-header">
              <h2><FaChartBar /> Resultados: {selectedQuizForResults.title}</h2>
              <button 
                className="btn-close" 
                onClick={() => {
                  setSelectedQuizForResults(null)
                  setQuizResults([])
                }}
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="results-actions">
              <button 
                className="btn-danger"
                onClick={() => handleDeleteQuiz(selectedQuizForResults.id)}
                title="Deletar este quiz permanentemente"
              >
                <FaTrash /> Deletar Quiz
              </button>
            </div>

            {quizResults.length === 0 ? (
              <div className="no-results">
                <p>Nenhum aluno completou este quiz ainda.</p>
              </div>
            ) : (
              <div className="results-list">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Posição</th>
                      <th>Aluno</th>
                      <th>Nota</th>
                      <th>Percentual</th>
                      <th>Data/Hora</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizResults.map((result, index) => (
                      <tr key={result.studentId}>
                        <td>#{index + 1}</td>
                        <td>{result.studentName}</td>
                        <td>{result.score}/{result.totalQuestions}</td>
                        <td>{Math.round((result.score / result.totalQuestions) * 100)}%</td>
                        <td>{new Date(result.submittedAt).toLocaleString('pt-BR')}</td>
                        <td>
                          <button
                            className="btn-cancel-result"
                            onClick={() => handleCancelStudentResult(selectedQuizForResults.id, result.studentId)}
                            title="Cancelar resultado deste aluno"
                          >
                            <FaTrash /> Cancelar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="quizzes-list">
        {quizzes.filter(q => q.isActive).map((quiz) => {
          const isCompleted = userProgress[quiz.id]?.completed
          const userScore = userProgress[quiz.id]?.score || 0
          const totalQuestions = userProgress[quiz.id]?.totalQuestions || quiz.questions.length
          const isCreator = quiz.creatorId === userId

          return (
            <div key={quiz.id} className={`quiz-card ${isCompleted ? 'completed' : ''}`}>
              <div className="quiz-card-header">
                <div>
                  <h3>{quiz.title}</h3>
                  <p className="quiz-creator">Criado por: {quiz.creatorName || 'Desconhecido'}</p>
                </div>
                <div className="quiz-header-actions">
                  {isCompleted && <span className="badge-completed"><FaCheckCircle /> Concluído</span>}
                  {isCreator && (
                    <button
                      className="btn-delete-small"
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      title="Deletar este quiz"
                    >
                      <FaTrashAlt />
                    </button>
                  )}
                </div>
              </div>
              <p className="quiz-description">{quiz.description || 'Sem descrição'}</p>
              <div className="quiz-info">
                <span><FaFileAlt /> {quiz.questions.length} pergunta(s)</span>
                {isCompleted && !isCreator && (
                  <span className="quiz-score">
                    Sua nota: {userScore}/{totalQuestions}
                  </span>
                )}
              </div>
              {isCreator ? (
                <div className="quiz-creator-actions">
                  <button
                    className="btn-primary"
                    onClick={() => handleViewResults(quiz)}
                  >
                    <FaChartBar /> Ver Resultados
                  </button>
                </div>
              ) : isCompleted ? (
                <div className="quiz-completed-message">
                  <p>Você já completou este quiz!</p>
                  <p className="quiz-score-display">
                    Acertos: {userScore}/{totalQuestions} ({Math.round((userScore / totalQuestions) * 100)}%)
                  </p>
                </div>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => handleStartQuiz(quiz)}
                >
                  Iniciar Quiz
                </button>
              )}
            </div>
          )
        })}

        {quizzes.filter(q => q.isActive).length === 0 && (
          <div className="no-quizzes">
            <p>Nenhum quiz disponível no momento.</p>
            <p>Crie o primeiro quiz!</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AsyncHome

