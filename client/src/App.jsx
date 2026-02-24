import { useEffect, useState } from 'react';
import AddItemForm from './AddItemForm';

function App() {
  const [inventory, setInventory] = useState([]);
  const [history, setHistory] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [projects, setProjects] = useState([]);
  
  const [selectedContractor, setSelectedContractor] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  
  // NEW: The Queue State
  const [actionQueue, setActionQueue] = useState([]);

  const fetchAllData = () => {
    fetch('http://localhost:5000/inventory').then(res => res.json()).then(setInventory);
    fetch('http://localhost:5000/transactions').then(res => res.json()).then(setHistory);
    fetch('http://localhost:5000/contractors').then(res => res.json()).then(setContractors);
    fetch('http://localhost:5000/projects').then(res => res.json()).then(setProjects);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // NEW: Add to Queue instead of immediate Fetch
  const handleAddToQueue = (actionType, item) => {
    if (!selectedContractor || !selectedProject) {
      alert('⚠️ Please select a Contractor and a Project first!');
      return;
    }

    // Find the names for display purposes in the queue
    const contractorName = contractors.find(c => c.id == selectedContractor)?.first_name || 'Unknown';
    const projectName = projects.find(p => p.id == selectedProject)?.name || 'Unknown';

    const newAction = {
      id: Date.now(), // Temporary unique ID for the queue
      type: actionType, // 'checkout' or 'return'
      item: item,
      contractorId: selectedContractor,
      contractorName: contractorName,
      projectId: selectedProject,
      projectName: projectName
    };

    setActionQueue([...actionQueue, newAction]);
  };

  // NEW: Remove item from Queue (if they made a mistake)
  const handleRemoveFromQueue = (queueId) => {
    setActionQueue(actionQueue.filter(q => q.id !== queueId));
  };

  // NEW: Submit the entire Queue to the Backend
  const handleSubmitQueue = async () => {
    if (actionQueue.length === 0) return;

    try {
      // Loop through the queue and send each request
      // (Using Promise.all to do them all in parallel for speed)
      await Promise.all(actionQueue.map(action => 
        fetch(`http://localhost:5000/${action.type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inventoryId: action.item.id,
            contractorId: action.contractorId,
            projectId: action.projectId
          })
        })
      ));

      alert('✅ All changes submitted successfully!');
      setActionQueue([]); // Clear the queue
      fetchAllData();     // Refresh UI with new database values

    } catch (error) {
      console.error("Error processing queue:", error);
      alert('❌ Something went wrong submitting the queue.');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>SupplySync Dashboard</h1>
      
      {/* SELECTION BAR */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '5px' }}>
        <h3>1. Select Who & Where:</h3>
        <label style={{ marginRight: '10px' }}>Contractor:</label>
        <select value={selectedContractor} onChange={(e) => setSelectedContractor(e.target.value)} style={{ padding: '5px', marginRight: '20px' }}>
          <option value="">-- Select Person --</option>
          {contractors.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
        </select>

        <label style={{ marginRight: '10px' }}>Project:</label>
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} style={{ padding: '5px', marginRight: '20px' }}>
          <option value="">-- Select Project --</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* TWO-COLUMN LAYOUT */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        
        {/* LEFT COLUMN: Main Inventory Area (70% width) */}
        <div style={{ flex: '7' }}>
          <h2>📦 Inventory</h2>
          <AddItemForm onAddSuccess={fetchAllData} />

          <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f2f2f2' }}>
                <th>Item</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Actions (Add to Queue)</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td style={{ fontWeight: 'bold' }}>{item.quantity}</td>
                  <td>{item.status}</td>
                  <td>
                    <button onClick={() => handleAddToQueue('checkout', item)} style={{ backgroundColor: '#ff4d4d', color: 'white', marginRight: '5px', padding: '5px 10px', border: 'none', cursor: 'pointer' }}>Out</button>
                    <button onClick={() => handleAddToQueue('return', item)} style={{ backgroundColor: '#28a745', color: 'white', padding: '5px 10px', border: 'none', cursor: 'pointer' }}>In</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>🕒 Recent Activity</h2>
          <ul style={{ listStyle: 'none', padding: 0, border: '1px solid #ccc' }}>
            {history.map((log) => (
              <li key={log.id} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>{log.first_name} {log.last_name}</strong> {log.action_type === 'CHECK_OUT' ? ' took ' : ' returned '} <strong>{log.item}</strong></span>
                <span style={{ color: '#888', fontSize: '0.9em' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT COLUMN: The Queue (30% width) */}
        <div style={{ flex: '3', border: '2px solid #333', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', position: 'sticky', top: '20px' }}>
          <h2 style={{ marginTop: 0 }}>🛒 Pending Changes</h2>
          
          {actionQueue.length === 0 ? (
            <p style={{ color: '#777', fontStyle: 'italic' }}>Your queue is empty. Click 'Out' or 'In' on an item to stage it here.</p>
          ) : (
            <>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '20px' }}>
                {actionQueue.map(action => (
                  <li key={action.id} style={{ padding: '10px', borderBottom: '1px solid #eee', fontSize: '0.9em' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{action.type === 'checkout' ? '📉 Checkout' : '📈 Return'}</strong>
                      <button onClick={() => handleRemoveFromQueue(action.id)} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontSize: '1.2em' }}>×</button>
                    </div>
                    <div>Item: {action.item.name}</div>
                    <div style={{ color: '#666' }}>For: {action.contractorName}</div>
                  </li>
                ))}
              </ul>
              <button 
                onClick={handleSubmitQueue} 
                style={{ width: '100%', padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontSize: '1em', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Submit All Changes
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;