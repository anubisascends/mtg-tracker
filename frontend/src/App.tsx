import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import EventListPage from './pages/player/EventListPage';
import EventDetailPage from './pages/player/EventDetailPage';
import MyStatsPage from './pages/player/MyStatsPage';
import ChangePasswordPage from './pages/player/ChangePasswordPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageEventsPage from './pages/admin/ManageEventsPage';
import EventFormPage from './pages/admin/EventFormPage';
import ManagePlayersPage from './pages/admin/ManagePlayersPage';
import EventStatusListPage from './pages/public/EventStatusListPage';
import EventStatusPage from './pages/public/EventStatusPage';
import DeckSubmissionPage from './pages/player/DeckSubmissionPage';
import MyDecksPage from './pages/player/MyDecksPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes — no login required */}
          <Route path="/status" element={<EventStatusListPage />} />
          <Route path="/status/:id" element={<EventStatusPage />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Player routes */}
          <Route path="/events" element={<PrivateRoute><Layout><EventListPage /></Layout></PrivateRoute>} />
          <Route path="/events/:id" element={<PrivateRoute><Layout><EventDetailPage /></Layout></PrivateRoute>} />
          <Route path="/events/:id/deck" element={<PrivateRoute><Layout><DeckSubmissionPage /></Layout></PrivateRoute>} />
          <Route path="/my-decks" element={<PrivateRoute><Layout><MyDecksPage /></Layout></PrivateRoute>} />
          <Route path="/stats" element={<PrivateRoute><Layout><MyStatsPage /></Layout></PrivateRoute>} />
          <Route path="/change-password" element={<PrivateRoute><Layout><ChangePasswordPage /></Layout></PrivateRoute>} />

          {/* Admin routes */}
          <Route path="/admin" element={<AdminRoute><Layout><AdminDashboard /></Layout></AdminRoute>} />
          <Route path="/admin/events" element={<AdminRoute><Layout><ManageEventsPage /></Layout></AdminRoute>} />
          <Route path="/admin/events/new" element={<AdminRoute><Layout><EventFormPage /></Layout></AdminRoute>} />
          <Route path="/admin/events/:id/edit" element={<AdminRoute><Layout><EventFormPage /></Layout></AdminRoute>} />
          <Route path="/admin/players" element={<AdminRoute><Layout><ManagePlayersPage /></Layout></AdminRoute>} />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
