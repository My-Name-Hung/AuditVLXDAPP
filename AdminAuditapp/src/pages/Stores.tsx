import { useEffect, useState } from 'react';
import api from '../services/api';
import './Stores.css';

interface Store {
  id: number;
  storeCode: string;
  storeName: string;
  address: string;
  phone: string;
  email: string;
  latitude: number;
  longitude: number;
}

export default function Stores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState({
    storeName: '',
    address: '',
    phone: '',
    email: '',
    latitude: '',
    longitude: '',
  });

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const response = await api.get('/stores');
      setStores(response.data);
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      };

      if (editingStore) {
        await api.put(`/stores/${editingStore.id}`, payload);
      } else {
        await api.post('/stores', payload);
      }
      setShowModal(false);
      setEditingStore(null);
      setFormData({
        storeName: '',
        address: '',
        phone: '',
        email: '',
        latitude: '',
        longitude: '',
      });
      fetchStores();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error saving store');
    }
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setFormData({
      storeName: store.storeName,
      address: store.address || '',
      phone: store.phone || '',
      email: store.email || '',
      latitude: store.latitude?.toString() || '',
      longitude: store.longitude?.toString() || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this store?')) return;
    try {
      await api.delete(`/stores/${id}`);
      fetchStores();
    } catch (error) {
      alert('Error deleting store');
    }
  };

  if (loading) {
    return <div className="loading">Loading stores...</div>;
  }

  return (
    <div className="stores-page">
      <div className="page-header">
        <h2>Stores Management</h2>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          + Add Store
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Store Code</th>
              <th>Store Name</th>
              <th>Address</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <tr key={store.id}>
                <td>{store.storeCode}</td>
                <td>{store.storeName}</td>
                <td>{store.address || '-'}</td>
                <td>{store.phone || '-'}</td>
                <td>{store.email || '-'}</td>
                <td>
                  <button onClick={() => handleEdit(store)} className="btn-edit">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(store.id)} className="btn-delete">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingStore ? 'Edit Store' : 'Add New Store'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Store Name *</label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Address *</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingStore ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

