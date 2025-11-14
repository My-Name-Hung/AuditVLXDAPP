import { useEffect, useState } from 'react';
import api from '../services/api';
import './Audits.css';

interface Audit {
  id: number;
  userId: number;
  storeId: number;
  result: string;
  notes: string;
  auditDate: string;
  userName?: string;
  userCode?: string;
  storeName?: string;
  storeCode?: string;
}

export default function Audits() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    userId: '',
    storeId: '',
    result: '',
  });

  useEffect(() => {
    fetchAudits();
  }, [filters]);

  const fetchAudits = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.storeId) params.append('storeId', filters.storeId);
      if (filters.result) params.append('result', filters.result);

      const response = await api.get(`/audits?${params.toString()}`);
      setAudits(response.data);
    } catch (error) {
      console.error('Error fetching audits:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading audits...</div>;
  }

  return (
    <div className="audits-page">
      <div className="page-header">
        <h2>Audits Management</h2>
      </div>

      <div className="filters">
        <div className="form-group">
          <label>Result</label>
          <select
            value={filters.result}
            onChange={(e) => setFilters({ ...filters, result: e.target.value })}
          >
            <option value="">All</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Store</th>
              <th>Result</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {audits.map((audit) => (
              <tr key={audit.id}>
                <td>{new Date(audit.auditDate).toLocaleDateString()}</td>
                <td>
                  {audit.userName || audit.userCode || `User #${audit.userId}`}
                </td>
                <td>
                  {audit.storeName || audit.storeCode || `Store #${audit.storeId}`}
                </td>
                <td>
                  <span className={`badge badge-${audit.result}`}>
                    {audit.result.toUpperCase()}
                  </span>
                </td>
                <td>{audit.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

