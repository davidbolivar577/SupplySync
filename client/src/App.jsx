import { useEffect, useState } from 'react';
import AddItemForm from './AddItemForm';
import EditItemForm from './EditItemForm';
import AdminTools from './AdminTools';

function App() {
  // Define the base URL using the environment variable
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const [inventory, setInventory] = useState([]);
  const [history, setHistory] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [projects, setProjects] = useState([]);

  const [selectedContractor, setSelectedContractor] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [actionQueue, setActionQueue] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editingItem, setEditingItem] = useState(null);

  const [itemQuantities, setItemQuantities] = useState({});

  const fetchAllData = () => {
    fetch(`${API_BASE_URL}/inventory`).then(res => res.json()).then(setInventory);
    fetch(`${API_BASE_URL}/transactions`).then(res => res.json()).then(setHistory);
    fetch(`${API_BASE_URL}/contractors`).then(res => res.json()).then(setContractors);
    fetch(`${API_BASE_URL}/projects`).then(res => res.json()).then(setProjects);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const getAvailableQty = (item) => {
    const pendingCheckouts = actionQueue
      .filter(action => action.item.id === item.id && action.type === 'checkout')
      .reduce((total, action) => total + action.qty, 0); // Sum up the bulk quantities
    return item.quantity - pendingCheckouts;
  };

  const handleAddToQueue = (actionType, item) => {
    if (!selectedContractor || !selectedProject) {
      alert('⚠️ Please select a Contractor and a Project first!');
      return;
    }

    // Get the quantity they typed, or default to 1
    const qtyToProcess = parseInt(itemQuantities[item.id] || 1, 10);

    if (actionType === 'checkout' && getAvailableQty(item) < qtyToProcess) {
      alert(`⚠️ You cannot checkout ${qtyToProcess} of ${item.name}. Not enough available!`);
      return;
    }

    const contractorName = contractors.find(c => c.id == selectedContractor)?.first_name || 'Unknown';
    const projectName = projects.find(p => p.id == selectedProject)?.name || 'Unknown';

    const newAction = {
      id: Date.now(),
      type: actionType,
      item: item,
      contractorId: selectedContractor,
      contractorName: contractorName,
      projectId: selectedProject,
      projectName: projectName,
      qty: qtyToProcess // Save the quantity to the queue!
    };

    setActionQueue([...actionQueue, newAction]);

    // Optional: Reset the input box back to 1 after adding to queue
    setItemQuantities({ ...itemQuantities, [item.id]: 1 });
  };

  const handleRemoveFromQueue = (queueId) => {
    setActionQueue(actionQueue.filter(q => q.id !== queueId));
  };

  const handleSubmitQueue = async () => {
    if (actionQueue.length === 0) return;
    try {
      await Promise.all(actionQueue.map(async (action) => {
        const res = await fetch(`${API_BASE_URL}/${action.type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inventoryId: action.item.id,
            contractorId: action.contractorId,
            projectId: action.projectId,
            quantityChanged: action.qty // Send to backend!
          })
        });

        // If the backend sends an error status (like 500), force it to throw!
        if (!res.ok) {
          throw new Error(`Backend rejected the ${action.type} request.`);
        }
      }));

      // If we make it here, every single request was 100% successful
      alert('✅ All changes submitted successfully!');
      setActionQueue([]);
      fetchAllData();

    } catch (error) {
      console.error("Error processing queue:", error);
      alert('❌ Something went wrong submitting the queue. Check the database logs.');
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === '' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // UPDATED: Streamlined minute-based grouping for history
  const groupedHistory = Object.values(history.reduce((acc, log) => {
    const date = new Date(log.timestamp);
    const timeString = `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const actionName = log.action_type === 'CHECK_OUT' ? 'Checked Out' : 'Returned';
    const contractorName = `${log.first_name} ${log.last_name}`;

    // Unique key for the transaction session
    const groupKey = `${contractorName}-${actionName}-${timeString}`;

    if (!acc[groupKey]) {
      acc[groupKey] = {
        id: groupKey,
        contractor: contractorName,
        action: actionName,
        time: timeString,
        items: []
      };
    }

    acc[groupKey].items.push({
      id: log.id,
      name: log.item,
      qty: log.quantity_changed || 1
    });

    return acc;
  }, {}));

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

      {/* FLEXBOX TWO-COLUMN LAYOUT START */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

        {/* --- LEFT COLUMN --- */}
        <div style={{ flex: '7', minWidth: 0 }}>
          <h2>📦 Inventory</h2>

          {editingItem ? (
            <EditItemForm
              item={editingItem}
              onUpdateSuccess={() => { setEditingItem(null); fetchAllData(); }}
              onCancel={() => setEditingItem(null)}
            />
          ) : (
            <AddItemForm onAddSuccess={fetchAllData} />
          )}

          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="🔍 Search items by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '8px', flex: '1', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">All Categories</option>
              <option value="TOOL">Tools</option>
              <option value="PART">Parts</option>
              <option value="MATERIAL">Materials</option>
            </select>
          </div>

          <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f2f2f2' }}>
                <th>Item</th>
                <th>Qty (Available)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => {
                const available = getAvailableQty(item);
                const isOutOfStock = available <= 0;
                return (
                  <tr key={item.id} style={{ opacity: isOutOfStock ? 0.6 : 1 }}>
                    <td>{item.name}</td>
                    <td style={{ fontWeight: 'bold' }}>{item.quantity} <span style={{ color: '#007bff', fontWeight: 'normal' }}>(Avail: {available})</span></td>
                    <td>{item.status}</td>
                    <td>
                      <button
                        onClick={() => setEditingItem(item)}
                        style={{ backgroundColor: '#ffc107', color: 'black', marginRight: '10px', padding: '5px 10px', border: 'none', cursor: 'pointer' }}
                      >
                        Edit
                      </button>

                      <input
                        type="number"
                        min="1"
                        max={available}
                        value={itemQuantities[item.id] || 1}
                        onChange={(e) => setItemQuantities({ ...itemQuantities, [item.id]: e.target.value })}
                        style={{ width: '50px', padding: '4px', marginRight: '5px' }}
                      />

                      <button onClick={() => handleAddToQueue('checkout', item)} disabled={isOutOfStock} style={{ backgroundColor: isOutOfStock ? '#ccc' : '#ff4d4d', color: 'white', marginRight: '5px', padding: '5px 10px', border: 'none', cursor: isOutOfStock ? 'not-allowed' : 'pointer' }}>Out</button>
                      <button onClick={() => handleAddToQueue('return', item)} style={{ backgroundColor: '#28a745', color: 'white', padding: '5px 10px', border: 'none', cursor: 'pointer' }}>In</button>
                    </td>
                  </tr>
                );
              })}
              {filteredInventory.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: '#777' }}>No items found.</td></tr>
              )}
            </tbody>
          </table>

          {/* UPDATED: Clean Card-Based Recent Activity */}
          <h2>🕒 Recent Activity</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '40px' }}>
            {groupedHistory.length === 0 ? (
              <p style={{ color: '#777', fontStyle: 'italic' }}>No recent activity.</p>
            ) : (
              groupedHistory.map((group) => {
                const isCheckout = group.action === 'Checked Out';
                return (
                  <div key={group.id} style={{ 
                    borderLeft: `5px solid ${isCheckout ? '#ff4d4d' : '#28a745'}`, 
                    backgroundColor: '#fff', 
                    padding: '15px', 
                    borderRadius: '6px', 
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    border: '1px solid #eaeaea',
                    borderLeftWidth: '5px' 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
                      <span style={{ fontSize: '0.9em', color: '#666' }}>{group.time}</span>
                      <strong style={{ color: isCheckout ? '#d93025' : '#1e8e3e' }}>
                        {isCheckout ? '📉' : '📈'} {group.action}
                      </strong>
                    </div>
                    
                    <div style={{ marginBottom: '8px', fontSize: '1.05em' }}>
                      <strong>{group.contractor}</strong> processed:
                    </div>
                    
                    <ul style={{ listStyleType: 'none', paddingLeft: '10px', margin: 0 }}>
                      {group.items.map(item => (
                        <li key={item.id} style={{ padding: '4px 0', fontSize: '0.95em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ 
                            backgroundColor: '#f1f3f4', 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontSize: '0.85em', 
                            fontWeight: 'bold',
                            color: '#333'
                          }}>
                            {item.qty}x
                          </span> 
                          {item.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </div>
        {/* --- END LEFT COLUMN --- */}

        {/* --- RIGHT COLUMN --- */}
        <div style={{ flex: '3', minWidth: 0, border: '2px solid #333', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', position: 'sticky', top: '20px' }}>
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
                    <div>Item: {action.item.name} <strong style={{ color: '#007bff' }}>(Qty: {action.qty})</strong></div>
                    <div style={{ color: '#666' }}>For: {action.contractorName}</div>
                  </li>
                ))}
              </ul>
              <button onClick={handleSubmitQueue} style={{ width: '100%', padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontSize: '1em', fontWeight: 'bold', cursor: 'pointer' }}>
                Submit All Changes
              </button>
            </>
          )}
        </div>
        {/* --- END RIGHT COLUMN --- */}

      </div>
      {/* FLEXBOX TWO-COLUMN LAYOUT END */}

      {/* ADMIN TOOLS GOES HERE, BELOW EVERYTHING */}
      <AdminTools onAddSuccess={fetchAllData} />

    </div>
  );
}

export default App;