import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './AdminPanel.css';

export default function AdminStaff() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPrimary = user?.isPrimaryAdmin === true;

  return (
    <div className="admin-panel-container">
      <div className="admin-header">
        <h1>עובדים</h1>
        <p className="admin-welcome">
          {isPrimary
            ? 'הסכמי העבודה, ומעקב הכייסים והתשלומים, של כל העובדים. הנתונים המלאים של כולם פתוחים רק למנהל הראשי.'
            : 'כאן מופיעים רק ההסכם שלך מול נעם, והכייסים והתשלומים שלך.'}
        </p>
        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-employee-cases-nav-btn"
            onClick={() => navigate('/admin/employee-cases')}
          >
            מעקב כייסים ותשלומים
          </button>
          <button
            type="button"
            className="admin-staff-agreements-btn"
            onClick={() => navigate('/admin/staff-agreements')}
          >
            הסכם עובדים
          </button>
          <button type="button" className="admin-section-back" onClick={() => navigate('/admin')}>
            חזרה לניהול תיקי לקוחות
          </button>
        </div>
      </div>
    </div>
  );
}
