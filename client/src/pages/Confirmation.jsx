import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import './Confirmation.css';

const Confirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [cases, setCases] = useState([]);
  const benefitType = location.state?.benefitType || '';

  useEffect(() => {
    fetchUserCases();
  }, []);

  const fetchUserCases = async () => {
    try {
      const response = await axios.get('/cases');
      setCases(response.data);
    } catch (error) {
      console.error('Failed to fetch cases:', error);
    }
  };

  const getBenefitTitle = (type) => {
    const titles = {
      family: 'משפחה',
      individual: 'בן אדם יחיד',
      minor: 'קטין מתחת לגיל 21'
    };
    return titles[type] || type;
  };

  const latestCase = cases.length > 0 ? cases[cases.length - 1] : null;
  const renewalDate = latestCase
    ? new Date(latestCase.renewalDate).toLocaleDateString('he-IL')
    : '';

  return (
    <div className="confirmation-container">
      <div className="confirmation-card">
        <div className="success-icon">✅</div>
        <h1>הקייס נסגר בהצלחה!</h1>
        <p className="confirmation-message">
          כל הפרטים נשמרו במערכת. תודה על השימוש בשירותינו.
        </p>

        {latestCase && (
          <div className="case-summary">
            <h2>סיכום הקייס</h2>
            <div className="summary-item">
              <span className="summary-label">סוג הטבה:</span>
              <span className="summary-value">{getBenefitTitle(latestCase.benefitType)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">תאריך יצירה:</span>
              <span className="summary-value">
                {new Date(latestCase.createdAt).toLocaleDateString('he-IL')}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">תאריך חידוש מומלץ:</span>
              <span className="summary-value renewal-date">{renewalDate}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">סטטוס:</span>
              <span className="summary-value status">{latestCase.status}</span>
            </div>
          </div>
        )}

        <div className="alert-box">
          <h3>⚠️ תזכורת חשובה</h3>
          <p>
            אל תשכח לחדש את הקייס עד התאריך: <strong>{renewalDate}</strong>
          </p>
          <p>
            במידה ולא תחדש את הקייס בזמן, הקייס עלול להיסגר ויהיו עלויות נוספות
            לפתיחת קייס מחדש.
          </p>
        </div>

        <div className="confirmation-actions">
          <button onClick={() => navigate('/')} className="home-button">
            חזור לדף הבית
          </button>
        </div>
      </div>
    </div>
  );
};

export default Confirmation;
