import { useState, useEffect } from 'react';

function EditItemForm({ item, onUpdateSuccess, onCancel }) {
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const [name, setName] = useState('');
  const [category, setCategory] = useState('TOOL');
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');

  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setCategory(item.category || 'TOOL');
      setQuantity(item.quantity || 0);
      setLocation(item.location || '');
      setCost(item.unit_cost !== null ? item.unit_cost : '');
    }
  }, [item]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedCost = cost ? parseFloat(cost) : null;
    const parsedQty = quantity ? parseInt(quantity, 10) : 0;

    const updatedItem = { name, category, quantity: parsedQty, location, unit_cost: parsedCost };

    fetch(`${API_BASE_URL}/inventory/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedItem)
    })
    .then(res => {
      if (res.ok) onUpdateSuccess();
      else alert('Failed to update item.');
    })
    .catch(err => console.error("Error updating:", err));
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
      <div style={{ flex: '1', minWidth: '150px' }}>
        <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: '5px' }}>Name:</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%' }} />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: '5px' }}>Category:</label>
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="TOOL">Tool</option>
          <option value="PART">Part</option>
          <option value="MATERIAL">Material</option>
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: '5px' }}>Total Qty:</label>
        <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="0" style={{ width: '70px' }} />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: '5px' }}>Location:</label>
        <input type="text" value={location} onChange={e => setLocation(e.target.value)} style={{ width: '90px' }} />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: '5px' }}>Unit Cost ($):</label>
        <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} style={{ width: '90px' }} />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="submit" className="btn-warning">Save</button>
        <button type="button" onClick={onCancel} className="btn-outline">Cancel</button>
      </div>
    </form>
  );
}

export default EditItemForm;