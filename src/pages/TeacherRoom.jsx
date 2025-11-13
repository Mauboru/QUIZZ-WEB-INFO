import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { QRCodeSVG } from 'qrcode.react'
import { getTeacherState, saveTeacherState, clearTeacherState } from '../utils/storage'
import { getSocketUrl } from '../utils/socketConfig'
import './TeacherRoom.css'

function TeacherRoom() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const teacherName = searchParams.get('name') || 'Professor'
  
  const [socket, setSocket] = useState(null)
  const [students, setStudents] = useState([])
  const [status, setStatus] = useState('waiting') // waiting, countdown, question, results, finished
  const [questions, setQuestions] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [questionNumber, setQuestionNumber] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [answersReceived, setAnswersReceived] = useState(0)
  const [ranking, setRanking] = useState([])
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    time: 30
  })

  useEffect(() => {
    // Verificar se há estado salvo (reconexão)
    const savedState = getTeacherState()
    const isReconnect = savedState && savedState.roomId === roomId

    const newSocket = io(getSocketUrl())
    setSocket(newSocket)

    // Sempre tentar reconectar primeiro (verificar se sala existe no servidor)
    // Usar estado salvo apenas como fallback temporário
    const tempQuestions = savedState?.questions || []
    if (savedState) {
      setQuestions(tempQuestions)
      setStatus(savedState.status || 'waiting')
      setCurrentQuestion(savedState.currentQuestion)
      setQuestionNumber(savedState.questionNumber || 0)
    }
    
    newSocket.emit('create-room', { roomId, teacherName, reconnect: true })
    
    newSocket.on('room-reconnected', ({ students, questions: serverQuestions, status: serverStatus, currentQuestion: serverQuestion, questionNumber: serverQNum }) => {
      setStudents(students || [])
      // SEMPRE usar dados do servidor - se tiver perguntas no servidor, usar elas
      // Se não tiver no servidor mas tiver localmente, manter local até salvar
      if (serverQuestions !== undefined && serverQuestions !== null && Array.isArray(serverQuestions)) {
        // Se servidor tem perguntas, usar elas (mesmo que vazio)
        setQuestions(serverQuestions)
        // Se servidor não tem mas local tem, salvar local no servidor
        if (serverQuestions.length === 0 && tempQuestions.length > 0) {
          newSocket.emit('save-questions', { roomId, questions: tempQuestions })
        }
      } else if (tempQuestions.length > 0) {
        // Se servidor não tem perguntas mas local tem, manter local e salvar
        setQuestions(tempQuestions)
        newSocket.emit('save-questions', { roomId, questions: tempQuestions })
      }
      if (serverStatus !== undefined) {
        setStatus(serverStatus)
      }
      if (serverQuestion !== undefined) {
        setCurrentQuestion(serverQuestion)
      }
      if (serverQNum !== undefined) {
        setQuestionNumber(serverQNum)
      }
    })
    
    // Se não houver sala no servidor, criar nova mas manter perguntas locais
    newSocket.on('room-created', ({ roomId: createdRoomId }) => {
      if (createdRoomId === roomId) {
        // Sala foi criada nova, mas manter perguntas locais se existirem
        if (tempQuestions.length > 0) {
          setQuestions(tempQuestions)
          // Salvar perguntas locais no servidor
          newSocket.emit('save-questions', { roomId, questions: tempQuestions })
        }
        console.log('Nova sala criada')
      }
    })

    newSocket.on('student-joined', ({ students }) => {
      setStudents(students)
    })

    newSocket.on('students-updated', ({ students }) => {
      setStudents(students)
    })

    newSocket.on('answer-received', () => {
      setAnswersReceived(prev => prev + 1)
    })

    // Salvar estado periodicamente
    const saveInterval = setInterval(() => {
      saveTeacherState({
        roomId,
        teacherName,
        questions,
        status,
        currentQuestion,
        questionNumber
      })
    }, 2000)

    return () => {
      clearInterval(saveInterval)
      newSocket.close()
    }
  }, [roomId, teacherName])

  // Salvar estado quando mudanças importantes ocorrem
  useEffect(() => {
    saveTeacherState({
      roomId,
      teacherName,
      questions,
      status,
      currentQuestion,
      questionNumber
    })
  }, [questions, status, currentQuestion, questionNumber])

  const handleAddQuestion = () => {
    if (!newQuestion.text.trim() || newQuestion.options.some(opt => !opt.trim())) {
      alert('Preencha todos os campos da pergunta')
      return
    }

    const updatedQuestions = [...questions, { ...newQuestion }]
    setQuestions(updatedQuestions)
    
    // Enviar perguntas ao servidor
    if (socket) {
      socket.emit('save-questions', { roomId, questions: updatedQuestions })
    }
    
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
        const jsonData = JSON.parse(e.target.result)
        
        // Validar formato do JSON
        if (!Array.isArray(jsonData)) {
          alert('O JSON deve ser um array de perguntas')
          return
        }

        const importedQuestions = jsonData.map((q, index) => {
          // Validar estrutura de cada pergunta
          if (!q.text || !Array.isArray(q.options) || q.options.length !== 4) {
            throw new Error(`Pergunta ${index + 1} está com formato inválido`)
          }

          if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
            throw new Error(`Pergunta ${index + 1} tem resposta correta inválida (deve ser 0-3)`)
          }

          return {
            text: q.text,
            options: q.options,
            correctAnswer: q.correctAnswer,
            time: q.time || 30 // Tempo padrão de 30 segundos se não especificado
          }
        })

        const updatedQuestions = [...questions, ...importedQuestions]
        setQuestions(updatedQuestions)
        
        // Enviar perguntas ao servidor
        if (socket) {
          socket.emit('save-questions', { roomId, questions: updatedQuestions })
        }
        
        alert(`${importedQuestions.length} pergunta(s) importada(s) com sucesso!`)
        
        // Limpar o input
        event.target.value = ''
      } catch (error) {
        alert(`Erro ao importar JSON: ${error.message}`)
        event.target.value = ''
      }
    }

    reader.onerror = () => {
      alert('Erro ao ler o arquivo')
      event.target.value = ''
    }

    reader.readAsText(file)
  }

  const handleStartQuiz = () => {
    if (questions.length === 0) {
      alert('Adicione pelo menos uma pergunta')
      return
    }

    if (students.length === 0) {
      alert('Aguarde pelo menos um aluno entrar na sala')
      return
    }

    socket.emit('start-quiz', { roomId, questions })
    setStatus('countdown')
    clearTeacherState() // Limpar estado salvo ao iniciar quiz
  }

  useEffect(() => {
    if (!socket) return

    socket.on('countdown-update', ({ countdown }) => {
      setCountdown(countdown)
    })

    socket.on('question-started', ({ question, questionNumber: qNum, time }) => {
      setCurrentQuestion(question)
      setQuestionNumber(qNum)
      setTimeLeft(time)
      setStatus('question')
      setAnswersReceived(0)
      
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    })

    socket.on('question-ended', () => {
      setStatus('results')
    })

    socket.on('quiz-ended', ({ ranking }) => {
      setStatus('finished')
      setRanking(ranking)
    })
  }, [socket])

  const studentUrl = `${window.location.origin}/student/${roomId}`

  return (
    <div className="teacher-room">
      <div className="teacher-header">
        <h1>🎓 Sala do Professor</h1>
        <div className="room-code">
          <p>Código: <strong>{roomId}</strong></p>
          <p className="room-url">{studentUrl}</p>
          <button
            className="btn-qr"
            onClick={() => setShowQR(!showQR)}
          >
            {showQR ? 'Ocultar' : 'Mostrar'} QR Code
          </button>
          {showQR && (
            <div className="qr-container">
              <QRCodeSVG value={studentUrl} size={200} />
            </div>
          )}
        </div>
      </div>

      {status === 'waiting' && (
        <div className="waiting-section">
          <div className="students-list">
            <h2>Alunos na Sala ({students.length})</h2>
            {students.length === 0 ? (
              <p className="no-students">Aguardando alunos...</p>
            ) : (
              <ul>
                {students.map((student, index) => (
                  <li key={index}>{student.name}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="questions-section">
            <div className="questions-header">
              <h2>Perguntas ({questions.length})</h2>
              <div className="questions-actions">
                <label className="btn-import">
                  📁 Importar JSON
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    style={{ display: 'none' }}
                  />
                </label>
                <button
                  className="btn-add"
                  onClick={() => setShowQuestionForm(!showQuestionForm)}
                >
                  {showQuestionForm ? 'Cancelar' : '+ Adicionar Pergunta'}
                </button>
              </div>
            </div>

            {showQuestionForm && (
              <div className="question-form">
                <input
                  type="text"
                  placeholder="Digite a pergunta"
                  value={newQuestion.text}
                  onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                />
                {newQuestion.options.map((option, index) => (
                  <div key={index} className="option-input">
                    <input
                      type="radio"
                      name="correct"
                      checked={newQuestion.correctAnswer === index}
                      onChange={() => setNewQuestion({ ...newQuestion, correctAnswer: index })}
                    />
                    <input
                      type="text"
                      placeholder={`Opção ${index + 1}`}
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...newQuestion.options]
                        newOptions[index] = e.target.value
                        setNewQuestion({ ...newQuestion, options: newOptions })
                      }}
                    />
                  </div>
                ))}
                <div className="time-input">
                  <label>Tempo (segundos):</label>
                  <input
                    type="number"
                    min="10"
                    max="120"
                    value={newQuestion.time}
                    onChange={(e) => setNewQuestion({ ...newQuestion, time: parseInt(e.target.value) || 30 })}
                  />
                </div>
                <button className="btn-save" onClick={handleAddQuestion}>
                  Salvar Pergunta
                </button>
              </div>
            )}

            <div className="questions-list">
              {questions.map((q, index) => (
                <div key={index} className="question-item">
                  <p><strong>{index + 1}.</strong> {q.text}</p>
                  <p className="question-time">⏱️ {q.time}s</p>
                </div>
              ))}
            </div>

            {questions.length > 0 && students.length > 0 && (
              <button className="btn-start" onClick={handleStartQuiz}>
                Iniciar Quiz
              </button>
            )}
          </div>
        </div>
      )}

      {status === 'countdown' && (
        <div className="countdown-screen">
          <div className="countdown-number">{countdown}</div>
          <p>O quiz vai começar em...</p>
        </div>
      )}

      {status === 'question' && currentQuestion && (
        <div className="question-screen">
          <div className="question-header">
            <span>Pergunta {questionNumber} de {questions.length}</span>
            <span className="timer">⏱️ {timeLeft}s</span>
            <span>Respostas: {answersReceived}/{students.length}</span>
          </div>
          <div className="question-display">
            <h2>{currentQuestion.text}</h2>
            <div className="options-display">
              {currentQuestion.options.map((option, index) => (
                <div
                  key={index}
                  className="option-display"
                >
                  {String.fromCharCode(65 + index)}. {option}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {status === 'results' && (
        <div className="results-screen">
          <h2>Resultado da Pergunta</h2>
          <p>Aguarde a próxima pergunta...</p>
        </div>
      )}

      {status === 'finished' && (
        <div className="ranking-screen">
          <h2>🏆 Ranking Final</h2>
          <div className="ranking-list">
            {ranking.map((student, index) => (
              <div
                key={index}
                className={`ranking-item ${index === 0 ? 'first' : index === 1 ? 'second' : index === 2 ? 'third' : ''}`}
              >
                <div className="rank-position">
                  {index === 0 && '🥇'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                  {index > 2 && `#${index + 1}`}
                </div>
                <div className="rank-info">
                  <p className="rank-name">{student.name}</p>
                  <p className="rank-score">{student.score}/{student.total} acertos</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TeacherRoom

