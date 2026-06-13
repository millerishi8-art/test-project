import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import WhatsAppButton from './components/WhatsAppButton';
import TestimonialTicker from './components/TestimonialTicker';
import './App.css';

// Lazy loaded pages
const Register = lazy(() => import('./pages/Register'));
const Login = lazy(() => import('./pages/Login'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Landing = lazy(() => import('./pages/Landing'));
const Home = lazy(() => import('./pages/Home'));
const BenefitDetail = lazy(() => import('./pages/BenefitDetail'));
const CaseForm = lazy(() => import('./pages/CaseForm'));
const Confirmation = lazy(() => import('./pages/Confirmation'));
const CaseStatus = lazy(() => import('./pages/CaseStatus'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AdminCaseDetail = lazy(() => import('./pages/AdminCaseDetail'));
const AdminCaseProcessing = lazy(() => import('./pages/AdminCaseProcessing'));
const AdminPayouts = lazy(() => import('./pages/AdminPayouts'));

const LoadingFallback = () => (
  <div className="loading-container" style={{ minHeight: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
    <div className="loading-spinner">טוען...</div>
  </div>
);

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <div className="app">
          <Navbar />
          <WhatsAppButton />
          <TestimonialTicker />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/" element={<Landing />} />
              <Route
                path="/dashboard"
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
              <Route
                path="/admin/payouts"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminPayouts />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
