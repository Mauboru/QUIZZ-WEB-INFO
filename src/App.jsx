import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import TeacherRoom from './pages/TeacherRoom'
import StudentRoom from './pages/StudentRoom'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/teacher/:roomId" element={<TeacherRoom />} />
      <Route path="/student/:roomId" element={<StudentRoom />} />
    </Routes>
  )
}

export default App

