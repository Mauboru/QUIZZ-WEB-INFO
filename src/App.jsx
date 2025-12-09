import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import TeacherRoom from './pages/TeacherRoom'
import StudentRoom from './pages/StudentRoom'
import AsyncHome from './pages/AsyncHome'
import AsyncQuiz from './pages/AsyncQuiz'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/teacher/:roomId" element={<TeacherRoom />} />
      <Route path="/student/:roomId" element={<StudentRoom />} />
      <Route path="/async-home" element={<AsyncHome />} />
      <Route path="/async-quiz/:quizId" element={<AsyncQuiz />} />
    </Routes>
  )
}

export default App

