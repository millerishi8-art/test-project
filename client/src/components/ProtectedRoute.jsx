import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false, creditDeskOnly = false, clientCasesOnly = false }) => {
  const { isAuthenticated, isAdmin, user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'white',
        fontSize: '1.5rem'
      }}>
        טוען...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (creditDeskOnly && user?.canAccessCreditClients !== true) {
    return <Navigate to={user?.canAccessClientCases ? '/admin' : '/dashboard'} replace />;
  }

  if (clientCasesOnly && user?.canAccessClientCases !== true) {
    if (user?.canAccessCreditClients === true) {
      return <Navigate to="/admin/credit-clients" replace />;
    }
    return <Navigate to={isAdmin ? '/admin/staff' : '/dashboard'} replace />;
  }

  return children;
};

export default ProtectedRoute;
