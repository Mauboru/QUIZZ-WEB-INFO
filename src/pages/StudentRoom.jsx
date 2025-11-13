import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { getStudentState, saveStudentState, clearStudentState } from '../utils/storage'
import { getSocketUrl } from '../utils/socketConfig'
import './StudentRoom.css'

function StudentRoom() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const nameParam = searchParams.get('name')
  
  // Verificar se tem nome, se não tiver, redirecionar para Home
  useEffect(() => {
    if (!nameParam || !nameParam.trim()) {
      // Verificar se há estado salvo com nome
      const savedState = getStudentState()
      if (!savedState || !savedState.studentName || savedState.roomId !== roomId) {
        // Redirecionar para Home com o roomId preenchido
        navigate(`/?roomId=${roomId}&mode=student`)
        return
      }
    }
  }, [nameParam, roomId, navigate])
  
  const studentName = nameParam || getStudentState()?.studentName || 'Aluno'
  
  const [socket, setSocket] = useState(null)
  const [status, setStatus] = useState('waiting') // waiting, countdown, question, results, finished
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [questionNumber, setQuestionNumber] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [result, setResult] = useState(null)
  const [ranking, setRanking] = useState([])
  const [students, setStudents] = useState([])
  const timerRef = useRef(null)

  useEffect(() => {
    // Verificar se há estado salvo (reconexão)
    const savedState = getStudentState()
    const isReconnect = savedState && savedState.roomId === roomId
    const oldSocketId = savedState?.socketId || null

    const newSocket = io(getSocketUrl())
    setSocket(newSocket)

    // Se for reconexão, tentar reconectar
    if (isReconnect) {
      setStatus(savedState.status || 'waiting')
      newSocket.emit('join-room', { 
        roomId, 
        studentName, 
        reconnect: true,
        oldSocketId 
      })
    } else {
      newSocket.emit('join-room', { roomId, studentName, reconnect: false })
    }

    newSocket.on('joined-room', ({ reconnected, roomId: joinedRoomId, studentName: joinedName }) => {
      console.log('Evento joined-room recebido:', { reconnected, roomId: joinedRoomId, studentName: joinedName })
      if (!reconnected) {
        setStatus('waiting')
      }
      console.log('Aluno entrou na sala:', roomId)
    })

    newSocket.on('room-state', ({ status: serverStatus, currentQuestion: serverQuestion, questionIndex, questionNumber: serverQNum, students: serverStudents }) => {
      if (serverStatus) {
        setStatus(serverStatus)
      }
      if (serverQuestion) {
        setCurrentQuestion(serverQuestion)
        setQuestionNumber(serverQNum || questionIndex + 1)
      }
      if (serverStudents) {
        setStudents(serverStudents)
      }
    })

    newSocket.on('room-error', ({ message }) => {
      console.error('Erro ao entrar na sala:', message)
      alert(`Erro: ${message}`)
      clearStudentState()
      // Não redirecionar imediatamente, dar chance de tentar novamente
    })

    newSocket.on('room-not-found', () => {
      console.error('Sala não encontrada:', roomId)
      alert('Sala não encontrada. Verifique o código da sala.')
      clearStudentState()
      // Redirecionar para home após 2 segundos
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    })

    newSocket.on('students-updated', ({ students }) => {
      setStudents(students)
    })

    newSocket.on('quiz-starting', ({ countdown }) => {
      setStatus('countdown')
      setCountdown(countdown)
    })

    newSocket.on('countdown-update', ({ countdown }) => {
      setCountdown(countdown)
    })

    newSocket.on('question-started', ({ question, questionNumber: qNum, totalQuestions: total, time }) => {
      // Limpar timer anterior se existir
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      
      setCurrentQuestion(question)
      setQuestionNumber(qNum)
      setTotalQuestions(total)
      setTimeLeft(time)
      setSelectedAnswer(null)
      setResult(null)
      setStatus('question')
      
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current)
              timerRef.current = null
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    })

    newSocket.on('question-ended', ({ correctAnswer, results }) => {
      // Limpar timer quando a pergunta termina
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      const myResult = results.find(r => r.studentId === newSocket.id)
      setResult({
        isCorrect: myResult?.isCorrect || false,
        correctAnswer: correctAnswer,
        myAnswer: myResult?.answerIndex
      })
      setStatus('results')
    })

    newSocket.on('quiz-ended', ({ ranking }) => {
      setStatus('finished')
      setRanking(ranking)
    })

    newSocket.on('room-closed', () => {
      alert('A sala foi encerrada pelo professor')
      clearStudentState()
      window.location.href = '/'
    })

    // Salvar estado periodicamente
    const saveInterval = setInterval(() => {
      saveStudentState({
        roomId,
        studentName,
        status,
        socketId: newSocket.id
      })
    }, 2000)

    return () => {
      clearInterval(saveInterval)
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      newSocket.close()
    }
  }, [roomId, studentName])

  // Salvar estado quando mudanças importantes ocorrem
  useEffect(() => {
    if (socket) {
      saveStudentState({
        roomId,
        studentName,
        status,
        socketId: socket.id
      })
    }
  }, [status, roomId, studentName, socket])

  const handleSelectAnswer = (answerIndex) => {
    if (status !== 'question' || timeLeft === 0) return
    
    setSelectedAnswer(answerIndex)
    socket.emit('submit-answer', { roomId, answerIndex })
  }

  return (
    <div className="student-room">
      <div className="student-header">
        <h1>👤 {studentName}</h1>
        <p className="room-code">Sala: {roomId}</p>
      </div>

      {status === 'waiting' && (
        <div className="waiting-screen">
          <div className="waiting-content">
            <div className="spinner"></div>
            <h2>Aguardando o professor iniciar o quiz...</h2>
            <p>Alunos na sala: {students.length}</p>
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
            <span>Pergunta {questionNumber} de {totalQuestions || '?'}</span>
            <span className="timer">⏱️ {timeLeft}s</span>
          </div>
          <div className="question-content">
            <h2>{currentQuestion.text}</h2>
            <div className="options-list">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  className={`option-button ${selectedAnswer === index ? 'selected' : ''}`}
                  onClick={() => handleSelectAnswer(index)}
                  disabled={timeLeft === 0}
                >
                  <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                  <span className="option-text">{option}</span>
                </button>
              ))}
            </div>
            {selectedAnswer !== null && (
              <p className="answer-hint">Você pode alterar sua resposta antes do tempo acabar</p>
            )}
          </div>
        </div>
      )}

      {status === 'results' && result && currentQuestion && (
        <div className="results-screen">
          <div className={`result-icon ${result.isCorrect ? 'correct' : 'incorrect'}`}>
            {result.isCorrect ? '✅' : '❌'}
          </div>
          <h2>{result.isCorrect ? 'Parabéns! Você acertou!' : 'Que pena! Você errou'}</h2>
          <div className="result-details">
            <p>Sua resposta: <strong>{String.fromCharCode(65 + (result.myAnswer ?? -1))}</strong></p>
            <p>Resposta correta: <strong>{String.fromCharCode(65 + result.correctAnswer)}</strong></p>
            <div className="correct-answer-box">
              <p><strong>Resposta Correta:</strong></p>
              <p>{currentQuestion.options[result.correctAnswer]}</p>
            </div>
          </div>
          <p className="next-question">Aguarde a próxima pergunta...</p>
        </div>
      )}

      {status === 'finished' && (
        <div className="ranking-screen">
          <h2>🏆 Quiz Finalizado!</h2>
          <div className="ranking-list">
            {ranking.map((student, index) => (
              <div
                key={index}
                className={`ranking-item ${index === 0 ? 'first' : index === 1 ? 'second' : index === 2 ? 'third' : ''} ${student.name === studentName ? 'my-rank' : ''}`}
              >
                <div className="rank-position">
                  {index === 0 && '🥇'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                  {index > 2 && `#${index + 1}`}
                </div>
                <div className="rank-info">
                  <p className="rank-name">
                    {student.name}
                    {student.name === studentName && ' (Você)'}
                  </p>
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

export default StudentRoom

