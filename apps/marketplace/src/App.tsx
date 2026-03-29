import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './pages/LandingPage';
import { HomePage } from './pages/HomePage';
import { DetailPage } from './pages/DetailPage';
import { PlayPage } from './pages/PlayPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/ProfilePage';
import { ClassroomPage } from './pages/ClassroomPage';
import { DocsPage } from './pages/DocsPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/explore" element={<HomePage />} />
          <Route path="/sim/:slug" element={<DetailPage />} />
          <Route path="/play/:slug" element={<PlayPage />} />
          <Route path="/user/:username" element={<ProfilePage />} />
          <Route path="/classrooms" element={<ClassroomPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
