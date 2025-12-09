import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSocketUrl } from '../utils/socketConfig'
import { FaGraduationCap, FaCheckCircle, FaFileAlt, FaClock, FaArrowLeft } from 'react-icons/fa'
import './AsyncStudentRoom.css'

function AsyncStudentRoom() {
  const navigate = useNavigate()
  const studentId = localStorage.getItem('asyncStudentId')
  const studentName = localStorage.getItem('asyncStudentName') || 'Aluno'
  
  const [quizzes, setQuizzes] = useState([])
  const [studentProgress, setStudentProgress] = useState({})
  const [currentQuiz, setCurrentQuiz] = useState(null)
  const [shuffledQuiz, setShuffledQuiz] = useState(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [answers, setAnswers] = useState([])
  const [timeLeft, setTimeLeft] = useState(0)
  const [quizFinished, setQuizFinished] = useState(false)
  const [score, setScore] = useState(0)

  useEffect(() => {
    if (!studentId) {
      navigate('/student-login')
      return
    }
    loadQuizzes()
    loadStudentProgress()
  }, [studentId, navigate])

  useEffect(() => {
    if (currentQuiz && shuffledQuiz) {
      const question = shuffledQuiz.questions[currentQuestionIndex]
      if (question) {
        setTimeLeft(question.time)
        const timer = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              handleAnswerSubmit(null) // Timeout
              return 0
            }
            return prev - 1
          })
        }, 1000)
        return () => clearInterval(timer)
      }
    }
  }, [currentQuestionIndex, shuffledQuiz])

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

  const loadStudentProgress = async () => {
    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/student-progress?studentId=${studentId}`)
      const data = await response.json()
      if (data.success) {
        setStudentProgress(data.progress || {})
      }
    } catch (err) {
      console.error('Erro ao carregar progresso:', err)
    }
  }

  // Função para embaralhar array (Fisher-Yates)
  const shuffleArray = (array) => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const startQuiz = async (quiz) => {
    // Verificar se já fez
    if (studentProgress[quiz.id]?.completed) {
      alert('Você já completou este quiz!')
      return
    }

    // Embaralhar perguntas
    const shuffledQuestions = shuffleArray(quiz.questions.map((q, originalIndex) => ({ ...q, originalIndex })))
    
    // Para cada pergunta, embaralhar as opções e criar mapeamento
    const shuffledQuizData = {
      ...quiz,
      questions: shuffledQuestions.map(q => {
        // Criar array de índices das opções
        const optionIndices = q.options.map((_, i) => i)
        const shuffledIndices = shuffleArray(optionIndices)
        
        // Criar mapeamento reverso: índice embaralhado -> índice original
        const reverseMapping = {}
        shuffledIndices.forEach((originalIdx, shuffledIdx) => {
          reverseMapping[shuffledIdx] = originalIdx
        })
        
        return {
          ...q,
          options: shuffledIndices.map(i => q.options[i]),
          originalCorrectAnswer: q.correctAnswer, // Guardar resposta correta original
          reverseMapping: reverseMapping, // Mapeamento para converter resposta escolhida
          shuffledCorrectAnswer: shuffledIndices.indexOf(q.correctAnswer) // Para validação no frontend
        }
      })
    }

    setCurrentQuiz(quiz)
    setShuffledQuiz(shuffledQuizData)
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setAnswers([])
    setQuizFinished(false)
    setScore(0)
  }

  const handleAnswerSubmit = async (answerIndex) => {
    if (!shuffledQuiz) return

    const question = shuffledQuiz.questions[currentQuestionIndex]
    
    // Converter resposta escolhida (índice embaralhado) para índice original
    const originalAnswerIndex = question.reverseMapping[answerIndex]
    
    // Validar contra a resposta correta original
    const isCorrect = originalAnswerIndex === question.originalCorrectAnswer

    const newAnswers = [...answers, {
      questionIndex: question.originalIndex !== undefined ? question.originalIndex : currentQuestionIndex,
      answerIndex: originalAnswerIndex, // Enviar índice original para o servidor
      shuffledAnswerIndex: answerIndex, // Guardar índice embaralhado para referência
      correct: isCorrect,
      questionId: question.id || currentQuestionIndex
    }]

    setAnswers(newAnswers)

    if (isCorrect) {
      setScore(prev => prev + 1)
    }

    // Próxima pergunta ou finalizar
    if (currentQuestionIndex < shuffledQuiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setSelectedAnswer(null)
    } else {
      // Finalizar quiz
      await finishQuiz(newAnswers)
    }
  }

  const finishQuiz = async (finalAnswers) => {
    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/submit-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quizId: currentQuiz.id,
          studentId: studentId,
          answers: finalAnswers,
          score: score + (finalAnswers[finalAnswers.length - 1]?.correct ? 1 : 0),
          totalQuestions: shuffledQuiz.questions.length
        })
      })

      const data = await response.json()
      if (data.success) {
        setQuizFinished(true)
        setScore(prev => prev + (finalAnswers[finalAnswers.length - 1]?.correct ? 1 : 0))
        loadStudentProgress()
      }
    } catch (err) {
      console.error('Erro ao enviar quiz:', err)
      alert('Erro ao salvar resultado. Tente novamente.')
    }
  }

  const resetQuiz = () => {
    setCurrentQuiz(null)
    setShuffledQuiz(null)
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setAnswers([])
    setQuizFinished(false)
    setScore(0)
    setTimeLeft(0)
  }

  if (!studentId) {
    return null
  }

  if (currentQuiz && shuffledQuiz) {
    const question = shuffledQuiz.questions[currentQuestionIndex]
    
    if (quizFinished) {
      return (
        <div className="async-student-room">
          <div className="quiz-container">
            <div className="quiz-finished">
              <h1><FaCheckCircle /> Quiz Concluído!</h1>
              <div className="score-display">
                <h2>Você acertou {score} de {shuffledQuiz.questions.length} perguntas</h2>
                <p className="score-percentage">
                  {Math.round((score / shuffledQuiz.questions.length) * 100)}%
                </p>
              </div>
              <button className="btn-primary" onClick={resetQuiz}>
                Voltar para Lista de Quizzes
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (!question) {
      return null
    }

    return (
      <div className="async-student-room">
        <div className="quiz-container">
          <div className="quiz-header">
            <h2>{currentQuiz.title}</h2>
            <div className="quiz-progress">
              <span>Pergunta {currentQuestionIndex + 1} de {shuffledQuiz.questions.length}</span>
              <span className="timer"><FaClock /> {timeLeft}s</span>
            </div>
          </div>

          <div className="question-container">
            <h3>{question.text}</h3>
            <div className="options-list">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  className={`option-button ${selectedAnswer === index ? 'selected' : ''}`}
                  onClick={() => setSelectedAnswer(index)}
                  disabled={timeLeft === 0}
                >
                  {String.fromCharCode(65 + index)}. {option}
                </button>
              ))}
            </div>

            <button
              className="btn-primary"
              onClick={() => handleAnswerSubmit(selectedAnswer)}
              disabled={selectedAnswer === null || timeLeft === 0}
            >
              {currentQuestionIndex < shuffledQuiz.questions.length - 1 ? 'Próxima' : 'Finalizar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="async-student-room">
      <div className="student-header">
        <h1><FaGraduationCap /> Quizzes Disponíveis</h1>
        <p>Aluno: {studentName}</p>
        <button className="btn-back" onClick={() => navigate('/')}>
          <FaArrowLeft /> Voltar
        </button>
      </div>

      <div className="quizzes-list">
        {quizzes.filter(q => q.isActive).map((quiz) => {
          const isCompleted = studentProgress[quiz.id]?.completed
          const studentScore = studentProgress[quiz.id]?.score || 0
          const totalQuestions = studentProgress[quiz.id]?.totalQuestions || quiz.questions.length

          return (
            <div key={quiz.id} className={`quiz-card ${isCompleted ? 'completed' : ''}`}>
              <div className="quiz-card-header">
                <h3>{quiz.title}</h3>
                {isCompleted && <span className="badge-completed"><FaCheckCircle /> Concluído</span>}
              </div>
              <p className="quiz-description">{quiz.description || 'Sem descrição'}</p>
              <div className="quiz-info">
                <span><FaFileAlt /> {quiz.questions.length} pergunta(s)</span>
                {isCompleted && (
                  <span className="quiz-score">
                    Nota: {studentScore}/{totalQuestions}
                  </span>
                )}
              </div>
              {isCompleted ? (
                <div className="quiz-completed-message">
                  <p>Você já completou este quiz!</p>
                  <p className="quiz-score-display">
                    Acertos: {studentScore}/{totalQuestions} ({Math.round((studentScore / totalQuestions) * 100)}%)
                  </p>
                </div>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => startQuiz(quiz)}
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
          </div>
        )}
      </div>
    </div>
  )
}

export default AsyncStudentRoom

