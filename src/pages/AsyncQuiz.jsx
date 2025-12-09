import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSocketUrl } from '../utils/socketConfig'
import { FaCheckCircle, FaClock, FaArrowLeft, FaArrowRight } from 'react-icons/fa'
import './AsyncQuiz.css'

function AsyncQuiz() {
  const { quizId } = useParams()
  const navigate = useNavigate()
  const userId = localStorage.getItem('asyncUserId')
  const userName = localStorage.getItem('asyncUserName') || 'Usuário'
  
  const [quiz, setQuiz] = useState(null)
  const [shuffledQuiz, setShuffledQuiz] = useState(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [answers, setAnswers] = useState(new Map()) // Usar Map para permitir atualização
  const [timeLeft, setTimeLeft] = useState(0)
  const [quizFinished, setQuizFinished] = useState(false)
  const [score, setScore] = useState(0)

  useEffect(() => {
    if (!userId) {
      navigate('/async-home')
      return
    }
    loadQuiz()
  }, [quizId, userId, navigate])

  useEffect(() => {
    if (quiz && !shuffledQuiz) {
      startQuiz(quiz)
    }
  }, [quiz])

  // Carregar resposta salva quando mudar de pergunta
  useEffect(() => {
    if (shuffledQuiz && shuffledQuiz.questions[currentQuestionIndex]) {
      const savedAnswer = answers.get(currentQuestionIndex)
      if (savedAnswer !== undefined) {
        setSelectedAnswer(savedAnswer)
      } else {
        setSelectedAnswer(null)
      }
    }
  }, [currentQuestionIndex, shuffledQuiz, answers])

  // Timer apenas se o quiz tiver tempo limitado
  useEffect(() => {
    if (shuffledQuiz && shuffledQuiz.questions[currentQuestionIndex] && shuffledQuiz.hasTimeLimit) {
      const question = shuffledQuiz.questions[currentQuestionIndex]
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
    } else {
      setTimeLeft(0) // Sem timer
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, shuffledQuiz])

  const loadQuiz = async () => {
    try {
      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/quiz/${quizId}`)
      const data = await response.json()
      if (data.success) {
        // Verificar se o usuário é o criador do quiz
        if (data.quiz.creatorId === userId) {
          alert('Você não pode fazer seu próprio quiz! Use a opção "Ver Resultados" para gerenciar seu quiz.')
          navigate('/async-home')
          return
        }
        setQuiz(data.quiz)
      } else {
        alert('Quiz não encontrado')
        navigate('/async-home')
      }
    } catch (err) {
      console.error('Erro ao carregar quiz:', err)
      alert('Erro ao carregar quiz')
      navigate('/async-home')
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

  const startQuiz = (quizData) => {
    // Embaralhar perguntas
    const shuffledQuestions = shuffleArray(quizData.questions.map((q, originalIndex) => ({ ...q, originalIndex })))
    
    // Para cada pergunta, embaralhar as opções e criar mapeamento
    const shuffledQuizData = {
      ...quizData,
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

    setShuffledQuiz(shuffledQuizData)
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setAnswers(new Map())
    setQuizFinished(false)
    setScore(0)
  }

  const saveAnswer = (answerIndex) => {
    if (!shuffledQuiz || answerIndex === null) return

    const question = shuffledQuiz.questions[currentQuestionIndex]
    
    // Salvar resposta no Map
    const newAnswers = new Map(answers)
    newAnswers.set(currentQuestionIndex, answerIndex)
    setAnswers(newAnswers)
  }

  const handleAnswerSubmit = async (answerIndex) => {
    if (!shuffledQuiz) return

    // Salvar resposta
    if (answerIndex !== null) {
      saveAnswer(answerIndex)
    }

    // Se tiver tempo limitado, avançar automaticamente
    if (shuffledQuiz.hasTimeLimit) {
      if (currentQuestionIndex < shuffledQuiz.questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1)
      } else {
        // Finalizar quiz
        await finishQuiz()
      }
    }
    // Se não tiver tempo, apenas salva a resposta (usuário navega manualmente)
  }

  const handleNextQuestion = () => {
    if (shuffledQuiz && currentQuestionIndex < shuffledQuiz.questions.length - 1) {
      // Salvar resposta atual antes de avançar
      if (selectedAnswer !== null) {
        saveAnswer(selectedAnswer)
      }
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      // Salvar resposta atual antes de voltar
      if (selectedAnswer !== null) {
        saveAnswer(selectedAnswer)
      }
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const handleFinalizeQuiz = async () => {
    // Salvar última resposta
    if (selectedAnswer !== null) {
      saveAnswer(selectedAnswer)
    }
    // Aguardar um pouco para garantir que a resposta foi salva
    setTimeout(async () => {
      await finishQuiz()
    }, 100)
  }

  const finishQuiz = async () => {
    try {
      // Converter Map de respostas para array
      const finalAnswers = []
      let finalScore = 0

      shuffledQuiz.questions.forEach((question, index) => {
        const answerIndex = answers.get(index)
        if (answerIndex !== undefined && answerIndex !== null) {
          // Converter resposta escolhida (índice embaralhado) para índice original
          const originalAnswerIndex = question.reverseMapping[answerIndex]
          
          // Validar contra a resposta correta original
          const isCorrect = originalAnswerIndex === question.originalCorrectAnswer

          finalAnswers.push({
            questionIndex: question.originalIndex !== undefined ? question.originalIndex : index,
            answerIndex: originalAnswerIndex,
            shuffledAnswerIndex: answerIndex,
            correct: isCorrect,
            questionId: question.id || index
          })

          if (isCorrect) {
            finalScore++
          }
        }
      })

      const socketUrl = getSocketUrl()
      const response = await fetch(`${socketUrl.replace('/socket.io', '')}/api/async/submit-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quizId: quiz.id,
          userId: userId,
          answers: finalAnswers,
          score: finalScore,
          totalQuestions: shuffledQuiz.questions.length
        })
      })

      const data = await response.json()
      if (data.success) {
        setQuizFinished(true)
        setScore(finalScore)
      }
    } catch (err) {
      console.error('Erro ao enviar quiz:', err)
      alert('Erro ao salvar resultado. Tente novamente.')
    }
  }

  if (!userId) {
    return null
  }

  if (!shuffledQuiz) {
    return (
      <div className="async-quiz-container">
        <div className="loading">Carregando quiz...</div>
      </div>
    )
  }

  if (quizFinished) {
    return (
      <div className="async-quiz-container">
        <div className="quiz-container">
          <div className="quiz-finished">
            <h1><FaCheckCircle /> Quiz Concluído!</h1>
            <div className="score-display">
              <h2>Você acertou {score} de {shuffledQuiz.questions.length} perguntas</h2>
              <p className="score-percentage">
                {Math.round((score / shuffledQuiz.questions.length) * 100)}%
              </p>
            </div>
            <button className="btn-primary" onClick={() => navigate('/async-home')}>
              Voltar para Lista de Quizzes
            </button>
          </div>
        </div>
      </div>
    )
  }

  const question = shuffledQuiz.questions[currentQuestionIndex]
  
  if (!question) {
    return null
  }

  return (
    <div className="async-quiz-container">
      <div className="quiz-container">
        <div className="quiz-header">
          <h2>{quiz.title}</h2>
          <div className="quiz-progress">
            <span>Pergunta {currentQuestionIndex + 1} de {shuffledQuiz.questions.length}</span>
            {shuffledQuiz.hasTimeLimit && (
              <span className="timer"><FaClock /> {timeLeft}s</span>
            )}
          </div>
        </div>

        {!shuffledQuiz.hasTimeLimit && (
          <div className="question-navigation">
            {shuffledQuiz.questions.map((_, index) => (
              <button
                key={index}
                className={`question-nav-btn ${index === currentQuestionIndex ? 'active' : ''} ${answers.has(index) ? 'answered' : ''}`}
                onClick={() => {
                  if (selectedAnswer !== null) {
                    saveAnswer(selectedAnswer)
                  }
                  setCurrentQuestionIndex(index)
                }}
                title={answers.has(index) ? 'Pergunta respondida' : 'Pergunta não respondida'}
              >
                {index + 1}
              </button>
            ))}
          </div>
        )}

        <div className="question-container">
          <h3>{question.text}</h3>
          <div className="options-list">
            {question.options.map((option, index) => (
              <button
                key={index}
                className={`option-button ${selectedAnswer === index ? 'selected' : ''}`}
                onClick={() => setSelectedAnswer(index)}
                disabled={shuffledQuiz.hasTimeLimit && timeLeft === 0}
              >
                {String.fromCharCode(65 + index)}. {option}
              </button>
            ))}
          </div>

          <div className="quiz-actions">
            {!shuffledQuiz.hasTimeLimit && (
              <button
                className="btn-secondary"
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0}
              >
                <FaArrowLeft /> Anterior
              </button>
            )}

            {shuffledQuiz.hasTimeLimit ? (
              <button
                className="btn-primary"
                onClick={() => handleAnswerSubmit(selectedAnswer)}
                disabled={selectedAnswer === null || timeLeft === 0}
              >
                {currentQuestionIndex < shuffledQuiz.questions.length - 1 ? 'Próxima' : 'Finalizar'}
              </button>
            ) : (
              <>
                {currentQuestionIndex < shuffledQuiz.questions.length - 1 ? (
                  <button
                    className="btn-primary"
                    onClick={handleNextQuestion}
                  >
                    Próxima <FaArrowRight />
                  </button>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={handleFinalizeQuiz}
                  >
                    Finalizar Quiz
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AsyncQuiz

