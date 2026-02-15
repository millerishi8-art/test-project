import { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminPanel.css';

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, casesRes] = await Promise.all([
        axios.get('/api/admin/users'),
        axios.get('/api/admin/cases')
      ]);
      setUsers(usersRes.data);
      setCases(casesRes.data);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">טוען נתונים...</div>
      </div>
    );
  }

  return (
    <div className="admin-panel-container">
      <div className="admin-header">
        <h1>פאנל ניהול</h1>
        <p>ניהול משתמשים וקייסים במערכת</p>
      </div>

      <div className="admin-tabs">
        <button
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          משתמשים ({users.length})
        </button>
        <button
          className={activeTab === 'cases' ? 'active' : ''}
          onClick={() => setActiveTab('cases')}
        >
          קייסים ({cases.length})
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>שם</th>
                <th>אימייל</th>
                <th>טלפון</th>
                <th>תאריך הרשמה</th>
                <th>מספר קייסים</th>
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    אין משתמשים במערכת
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.phone}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>{user.casesCount}</td>
                    <td>
                      <span className={`status-badge ${user.role}`}>
                        {user.role === 'admin' ? 'מנהל' : 'משתמש'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'cases' && (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>שם משתמש</th>
                <th>אימייל</th>
                <th>טלפון</th>
                <th>סוג הטבה</th>
                <th>תאריך יצירה</th>
                <th>תאריך חידוש</th>
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    אין קייסים במערכת
                  </td>
                </tr>
              ) : (
                cases.map((caseItem) => (
                  <tr key={caseItem.id}>
                    <td>{caseItem.userName}</td>
                    <td>{caseItem.userEmail}</td>
                    <td>{caseItem.userPhone}</td>
                    <td>{getBenefitTitle(caseItem.benefitType)}</td>
                    <td>{formatDate(caseItem.createdAt)}</td>
                    <td>{formatDate(caseItem.renewalDate)}</td>
                    <td>
                      <span className={`status-badge ${caseItem.status}`}>
                        {caseItem.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-stats">
        <div className="stat-card">
          <h3>סה"כ משתמשים</h3>
          <p className="stat-number">{users.length}</p>
        </div>
        <div className="stat-card">
          <h3>סה"כ קייסים</h3>
          <p className="stat-number">{cases.length}</p>
        </div>
        <div className="stat-card">
          <h3>קייסים פעילים</h3>
          <p className="stat-number">
            {cases.filter((c) => c.status === 'submitted').length}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
