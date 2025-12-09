import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getSocketUrl } from '../utils/socketConfig'
import { FaBook, FaClock, FaTrash, FaFileAlt, FaUsers, FaCheckCircle, FaArrowLeft } from 'react-icons/fa'
import './AsyncTeacherRoom.css'

function AsyncTeacherRoom() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const teacherName = searchParams.get('name') || 'Professor'
  
  const [quizzes, setQuizzes] = useState([])
  const [showQuizForm, setShowQuizForm] = useState(false)
  const [newQuiz, setNewQuiz] = useState({
    title: '',
    description: '',
    questions: []
  })
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    time: 30
  })
  const [selectedQuiz, setSelectedQuiz] = useState(null)
  const [quizStats, setQuizStats] = useState({})

  useEffect(() => {
    loadQuizzes()
    loadQuizStats()
  }, [])

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

  const loadQuizStats = async () => {
    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/quiz-stats`)
      const data = await response.json()
      if (data.success) {
        setQuizStats(data.stats || {})
      }
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err)
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
          teacherName
        })
      })

      const data = await response.json()
      if (data.success) {
        alert('Quiz criado com sucesso!')
        setNewQuiz({ title: '', description: '', questions: [] })
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

  const handleToggleQuiz = async (quizId, isActive) => {
    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/toggle-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quizId, isActive: !isActive })
      })

      const data = await response.json()
      if (data.success) {
        loadQuizzes()
      }
    } catch (err) {
      console.error('Erro ao alterar status do quiz:', err)
    }
  }

  const handleDeleteQuiz = async (quizId) => {
    if (!confirm('Tem certeza que deseja excluir este quiz?')) return

    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/delete-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quizId })
      })

      const data = await response.json()
      if (data.success) {
        loadQuizzes()
        loadQuizStats()
      }
    } catch (err) {
      console.error('Erro ao excluir quiz:', err)
    }
  }

  return (
    <div className="async-teacher-room">
      <div className="teacher-header">
        <h1><FaBook /> Gerenciar Quizzes Assíncronos</h1>
        <p>Professor: {teacherName}</p>
        <button className="btn-back" onClick={() => navigate('/')}>
          <FaArrowLeft /> Voltar
        </button>
      </div>

      <div className="teacher-content">
        <div className="quizzes-section">
          <div className="section-header">
            <h2>Meus Quizzes</h2>
            <button 
              className="btn-primary" 
              onClick={() => {
                setShowQuizForm(!showQuizForm)
                setSelectedQuiz(null)
              }}
            >
              {showQuizForm ? 'Cancelar' : '+ Novo Quiz'}
            </button>
          </div>

          {showQuizForm && (
            <div className="quiz-form">
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

          <div className="quizzes-list">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="quiz-card">
                <div className="quiz-header">
                  <h3>{quiz.title}</h3>
                  <div className="quiz-actions">
                    <button
                      className={`btn-toggle ${quiz.isActive ? 'active' : ''}`}
                      onClick={() => handleToggleQuiz(quiz.id, quiz.isActive)}
                    >
                      {quiz.isActive ? 'Ativo' : 'Inativo'}
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteQuiz(quiz.id)}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
                <p className="quiz-description">{quiz.description || 'Sem descrição'}</p>
                <div className="quiz-info">
                  <span><FaFileAlt /> {quiz.questions.length} pergunta(s)</span>
                  <span><FaUsers /> {quizStats[quiz.id]?.totalStudents || 0} aluno(s) cadastrado(s)</span>
                  <span><FaCheckCircle /> {quizStats[quiz.id]?.completedStudents || 0} concluído(s)</span>
                </div>
                <p className="quiz-date">
                  Criado em: {new Date(quiz.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AsyncTeacherRoom

