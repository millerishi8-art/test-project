import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Register from './pages/Register';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import Home from './pages/Home';
import BenefitDetail from './pages/BenefitDetail';
import CaseForm from './pages/CaseForm';
import Confirmation from './pages/Confirmation';
import CaseStatus from './pages/CaseStatus';
import AdminPanel from './pages/AdminPanel';
import AdminCaseDetail from './pages/AdminCaseDetail';
import AdminCaseProcessing from './pages/AdminCaseProcessing';
import WhatsAppButton from './components/WhatsAppButton';
import './App.css';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <div className="app">
        <Navbar />
        <WhatsAppButton />
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/benefit/:type"
            element={
              <ProtectedRoute>
                <BenefitDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/case-form/:type"
            element={
              <ProtectedRoute>
                <CaseForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/confirmation"
            element={
              <ProtectedRoute>
                <Confirmation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/case-status"
            element={
              <ProtectedRoute>
                <CaseStatus />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/cases/:caseId"
            element={
              <ProtectedRoute adminOnly>
                <AdminCaseDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/case-processing"
            element={
              <ProtectedRoute adminOnly>
                <AdminCaseProcessing />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
