// Utilitários para persistência de estado

const STORAGE_KEYS = {
  TEACHER: 'quiz_teacher_state',
  STUDENT: 'quiz_student_state'
}

export const saveTeacherState = (state) => {
  try {
    sessionStorage.setItem(STORAGE_KEYS.TEACHER, JSON.stringify({
      roomId: state.roomId,
      teacherName: state.teacherName,
      questions: state.questions,
      status: state.status,
      currentQuestion: state.currentQuestion,
      questionNumber: state.questionNumber,
      timestamp: Date.now()
    }))
  } catch (error) {
    console.error('Erro ao salvar estado do professor:', error)
  }
}

export const getTeacherState = () => {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEYS.TEACHER)
    if (saved) {
      const state = JSON.parse(saved)
      // Estado válido por 1 hora
      if (Date.now() - state.timestamp < 3600000) {
        return state
      }
    }
  } catch (error) {
    console.error('Erro ao recuperar estado do professor:', error)
  }
  return null
}

export const clearTeacherState = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.TEACHER)
  } catch (error) {
    console.error('Erro ao limpar estado do professor:', error)
  }
}

export const saveStudentState = (state) => {
  try {
    sessionStorage.setItem(STORAGE_KEYS.STUDENT, JSON.stringify({
      roomId: state.roomId,
      studentName: state.studentName,
      status: state.status,
      socketId: state.socketId,
      timestamp: Date.now()
    }))
  } catch (error) {
    console.error('Erro ao salvar estado do aluno:', error)
  }
}

export const getStudentState = () => {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEYS.STUDENT)
    if (saved) {
      const state = JSON.parse(saved)
      // Estado válido por 1 hora
      if (Date.now() - state.timestamp < 3600000) {
        return state
      }
    }
  } catch (error) {
    console.error('Erro ao recuperar estado do aluno:', error)
  }
  return null
}

export const clearStudentState = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.STUDENT)
  } catch (error) {
    console.error('Erro ao limpar estado do aluno:', error)
  }
}

