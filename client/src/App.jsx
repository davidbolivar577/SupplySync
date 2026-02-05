import { useEffect, useState } from 'react';

function App() {
  const [inventory, setInventory] = useState([]);

  const fetchInventory = () => {
    fetch('http://localhost:5000/inventory')
      .then(response => response.json())
      .then(data => setInventory(data))
      .catch(error => console.error('Error fetching data:', error));
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // CHECKOUT (-1)
  const handleCheckout = (itemId) => {
    fetch('http://localhost:5000/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventoryId: itemId, contractorId: 1, projectId: 1 })
    }).then(res => {
      if (res.ok) fetchInventory();
    });
  };

  // RETURN (+1)
  const handleReturn = (itemId) => {
    fetch('http://localhost:5000/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventoryId: itemId, contractorId: 1, projectId: 1 })
    }).then(res => {
      if (res.ok) fetchInventory();
    });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>SupplySync Inventory</h1>
      
      <table border="1" cellPadding="10" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th>ID</th>
            <th>Name</th>
            <th>Qty</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>{item.status}</td>
              <td>
                <button 
                  onClick={() => handleCheckout(item.id)}
                  style={{
                    backgroundColor: '#ff4d4d', color: 'white', marginRight: '10px',
                    padding: '5px 10px', border: 'none', cursor: 'pointer'
                  }}
                >
                  Checkout
                </button>
                <button 
                  onClick={() => handleReturn(item.id)}
                  style={{
                    backgroundColor: '#28a745', color: 'white', 
                    padding: '5px 10px', border: 'none', cursor: 'pointer'
                  }}
                >
                  Return
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;