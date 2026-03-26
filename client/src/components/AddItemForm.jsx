import { useState } from 'react';

function AddItemForm({ onAddSuccess, userRole }) {
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const [name, setName] = useState('');
  const [category, setCategory] = useState('TOOL');
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault(); 
    const parsedCost = cost ? parseFloat(cost) : null;
    
    // Force quantity to 0 if they are not an admin
    const parsedQty = userRole === 'admin' ? (quantity ? parseInt(quantity, 10) : 0) : 0;

    const newItem = { name, category, quantity: parsedQty, location, unit_cost: parsedCost };

    const token = localStorage.getItem('inventory_token');
    fetch(`${API_BASE_URL}/inventory`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
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
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div>
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

      {/* ONLY SHOW QTY FIELD IF USER IS AN ADMIN */}
      {userRole === 'admin' && (
        <div>
          <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: '5px' }}>Qty:</label>
          <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" style={{ width: '70px' }} />
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: '5px' }}>Location:</label>
        <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Bin A1" style={{ width: '90px' }} />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: '5px' }}>Unit Cost ($):</label>
        <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} style={{ width: '90px' }} />
      </div>

      <button type="submit" className="btn-success" style={{ padding: '8px 16px', height: 'fit-content' }}>
        Submit
      </button>
    </form>
  );
}

export default AddItemForm;