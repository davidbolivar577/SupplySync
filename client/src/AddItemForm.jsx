import { useState } from 'react';

function AddItemForm({ onAddSuccess }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('TOOL');
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault(); 

    // FIX: Convert cost to a number, or send null if left blank
    const parsedCost = cost ? parseFloat(cost) : null;
    const parsedQty = quantity ? parseInt(quantity, 10) : 0;

    const newItem = { 
      name, 
      category, 
      quantity: parsedQty, 
      location, 
      unit_cost: parsedCost 
    };

    fetch('http://localhost:5000/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem)
    })
    .then(res => {
      if (res.ok) {
        alert('Item Added Successfully!');
        setName('');
        setQuantity(1);
        setLocation('');
        setCost('');
        onAddSuccess(); 
      } else {
        alert('Backend rejected the data. Check your server terminal!');
      }
    });
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px', marginBottom: '20px', backgroundColor: '#f9f9f9' }}>
      <h3>➕ Add New Item</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        
        <div>
          <label style={{ display: 'block', fontSize: '0.8em' }}>Name:</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Hammer" required style={{ padding: '5px' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8em' }}>Category:</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: '5px' }}>
            <option value="TOOL">Tool</option>
            <option value="PART">Part</option>
            <option value="MATERIAL">Material</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8em' }}>Qty:</label>
          <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" style={{ width: '60px', padding: '5px' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8em' }}>Location:</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Bin A1" style={{ width: '80px', padding: '5px' }} />
        </div>

        {/* FIX: Added the missing Cost input */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8em' }}>Unit Cost ($):</label>
          <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" style={{ width: '80px', padding: '5px' }} />
        </div>

        <button type="submit" style={{ backgroundColor: '#007bff', color: 'white', padding: '6px 15px', border: 'none', cursor: 'pointer', height: '30px' }}>
          Add Item
        </button>
      </form>
    </div>
  );
}

export default AddItemForm;