import { useState } from 'react';

function AddItemForm({ onAddSuccess }) {
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const [name, setName] = useState('');
  const [category, setCategory] = useState('TOOL');
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault(); 
    const parsedCost = cost ? parseFloat(cost) : null;
    const parsedQty = quantity ? parseInt(quantity, 10) : 0;

    const newItem = { name, category, quantity: parsedQty, location, unit_cost: parsedCost };

    fetch(`${API_BASE_URL}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem)
    })
    .then(res => {
      if (res.ok) {
        setName(''); setQuantity(1); setLocation(''); setCost('');
        onAddSuccess(); 
      } else {
        alert('Backend rejected the data. Check your server terminal!');
      }
    })
    .catch(err => console.error("Error adding item:", err));
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end', marginBottom: '25px', backgroundColor: 'var(--bg-surface)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      <div style={{ flex: '1', minWidth: '150px' }}>
        <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: '5px' }}>Item Name:</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Hammer" required style={{ width: '100%' }} />
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
        <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: '5px' }}>Qty:</label>
        <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" style={{ width: '70px' }} />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: '5px' }}>Location:</label>
        <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Bin A1" style={{ width: '90px' }} />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: '5px' }}>Unit Cost ($):</label>
        <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" style={{ width: '90px' }} />
      </div>

      <button type="submit" className="btn-success">+ Add</button>
    </form>
  );
}

export default AddItemForm;