import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import CalendarPage from './pages/Calendar'
import Dashboard from './pages/Dashboard'
import ExercisePage from './pages/Exercise'
import ProfilePage from './pages/Profile'
import Recognize from './pages/Recognize'
import Trends from './pages/Trends'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="recognize" element={<Recognize />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="trends" element={<Trends />} />
        <Route path="exercise" element={<ExercisePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
