import { useState, useEffect } from 'react';

function EditItemForm({ item, onUpdateSuccess, onCancel }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('TOOL');
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');

  // When the component loads, or the 'item' changes, pre-fill the form!
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

    const updatedItem = { 
      name, 
      category, 
      quantity: parsedQty, 
      location, 
      unit_cost: parsedCost 
    };

    fetch(`http://localhost:5000/inventory/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedItem)
    })
    .then(res => {
      if (res.ok) {
        alert('Item Updated Successfully!');
        onUpdateSuccess(); // Refresh table and close edit mode
      } else {
        alert('Backend rejected the update.');
      }
    });
  };

  return (
    <div style={{ border: '2px solid #ffc107', padding: '15px', borderRadius: '8px', marginBottom: '20px', backgroundColor: '#fffdf6' }}>
      <h3>✏️ Edit Item: {item.name}</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        
        <div>
          <label style={{ display: 'block', fontSize: '0.8em' }}>Name:</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required style={{ padding: '5px' }} />
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
          <label style={{ display: 'block', fontSize: '0.8em' }}>Total Qty:</label>
          <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="0" style={{ width: '60px', padding: '5px' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8em' }}>Location:</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)} style={{ width: '80px', padding: '5px' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8em' }}>Unit Cost ($):</label>
          <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} style={{ width: '80px', padding: '5px' }} />
        </div>

        <button type="submit" style={{ backgroundColor: '#ffc107', color: 'black', padding: '6px 15px', border: 'none', cursor: 'pointer', height: '30px', fontWeight: 'bold' }}>
          Save Changes
        </button>
        <button type="button" onClick={onCancel} style={{ backgroundColor: '#6c757d', color: 'white', padding: '6px 15px', border: 'none', cursor: 'pointer', height: '30px' }}>
          Cancel
        </button>
      </form>
    </div>
  );
}

export default EditItemForm;