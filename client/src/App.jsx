import { useEffect, useState } from 'react';

function App() {
  const [inventory, setInventory] = useState([]);
  const [history, setHistory] = useState([]);
  const [contractors, setContractors] = useState([]); // New!
  const [projects, setProjects] = useState([]);       // New!
  
  // Selection State (New!)
  const [selectedContractor, setSelectedContractor] = useState('');
  const [selectedProject, setSelectedProject] = useState('');

  // FETCH ALL DATA
  const fetchAllData = () => {
    fetch('http://localhost:5000/inventory').then(res => res.json()).then(setInventory);
    fetch('http://localhost:5000/transactions').then(res => res.json()).then(setHistory);
    fetch('http://localhost:5000/contractors').then(res => res.json()).then(setContractors);
    fetch('http://localhost:5000/projects').then(res => res.json()).then(setProjects);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // ACTIONS
  const handleAction = (endpoint, itemId) => {
    // Validation: Make sure they picked someone!
    if (!selectedContractor || !selectedProject) {
      alert('⚠️ Please select a Contractor and a Project first!');
      return;
    }

    fetch(`http://localhost:5000/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inventoryId: itemId,
        contractorId: selectedContractor, // Uses the dropdown value
        projectId: selectedProject        // Uses the dropdown value
      })
    }).then(res => {
      if (res.ok) {
        fetchAllData(); // Refresh everything
        // Optional: Reset selections if you want, or keep them for multiple items
      } else {
        alert('Action failed. Check console.');
      }
    });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>SupplySync Dashboard</h1>
      
      {/* SECTION 1: INVENTORY */}
      <h2>📦 Inventory</h2>
      {/* SELECTION BAR */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '5px' }}>
        <h3>1. Select Who & Where:</h3>
        
        <label style={{ marginRight: '10px' }}>Contractor:</label>
        <select 
          value={selectedContractor} 
          onChange={(e) => setSelectedContractor(e.target.value)}
          style={{ padding: '5px', marginRight: '20px' }}
        >
          <option value="">-- Select Person --</option>
          {contractors.map(c => (
            <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
          ))}
        </select>

        <label style={{ marginRight: '10px' }}>Project:</label>
        <select 
          value={selectedProject} 
          onChange={(e) => setSelectedProject(e.target.value)}
          style={{ padding: '5px', marginRight: '20px' }}
        >
          <option value="">-- Select Project --</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <h3>2. Select Action:</h3>
      {/* Table goes here... */}
      <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th>Item</th>
            <th>Qty</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td style={{ fontWeight: 'bold' }}>{item.quantity}</td>
              <td>{item.status}</td>
              <td>
                <button 
                  onClick={() => handleAction('checkout', item.id)}
                  style={{ backgroundColor: '#ff4d4d', color: 'white', marginRight: '5px', padding: '5px 10px', border: 'none', cursor: 'pointer' }}
                >
                  Out
                </button>
                <button 
                  onClick={() => handleAction('return', item.id)}
                  style={{ backgroundColor: '#28a745', color: 'white', padding: '5px 10px', border: 'none', cursor: 'pointer' }}
                >
                  In
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* SECTION 2: RECENT ACTIVITY LOG */}
      <h2>🕒 Recent Activity</h2>
      <ul style={{ listStyle: 'none', padding: 0, border: '1px solid #ccc' }}>
        {history.map((log) => (
          <li key={log.id} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <strong>{log.first_name} {log.last_name}</strong> 
              {log.action_type === 'CHECK_OUT' ? ' took ' : ' returned '} 
              <strong>{log.item}</strong>
            </span>
            <span style={{ color: '#888', fontSize: '0.9em' }}>
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;