import { useEffect, useState } from 'react';
import AddItemForm from './AddItemForm';
import EditItemForm from './EditItemForm';

function App() {
  const [inventory, setInventory] = useState([]);
  const [history, setHistory] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [projects, setProjects] = useState([]);

  const [selectedContractor, setSelectedContractor] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [actionQueue, setActionQueue] = useState([]);

  // NEW: Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // NEW: Track which item is currently being edited
  const [editingItem, setEditingItem] = useState(null);

  const fetchAllData = () => {
    fetch('http://localhost:5000/inventory').then(res => res.json()).then(setInventory);
    fetch('http://localhost:5000/transactions').then(res => res.json()).then(setHistory);
    fetch('http://localhost:5000/contractors').then(res => res.json()).then(setContractors);
    fetch('http://localhost:5000/projects').then(res => res.json()).then(setProjects);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const getAvailableQty = (item) => {
    const pendingCheckouts = actionQueue.filter(
      action => action.item.id === item.id && action.type === 'checkout'
    ).length;
    return item.quantity - pendingCheckouts;
  };

  const handleAddToQueue = (actionType, item) => {
    if (!selectedContractor || !selectedProject) {
      alert('⚠️ Please select a Contractor and a Project first!');
      return;
    }
    if (actionType === 'checkout' && getAvailableQty(item) <= 0) {
      alert(`⚠️ You cannot checkout ${item.name}. There are none left available!`);
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
      projectName: projectName
    };
    setActionQueue([...actionQueue, newAction]);
  };

  const handleRemoveFromQueue = (queueId) => {
    setActionQueue(actionQueue.filter(q => q.id !== queueId));
  };

  const handleSubmitQueue = async () => {
    if (actionQueue.length === 0) return;
    try {
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
      setActionQueue([]);
      fetchAllData();
    } catch (error) {
      console.error("Error processing queue:", error);
      alert('❌ Something went wrong submitting the queue.');
    }
  };

  // NEW: Filter the inventory before displaying it
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === '' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // NEW: Group the history by Timestamp and Action Type
  const groupedHistory = history.reduce((acc, log) => {
    // We format the time so items submitted in the same second share a key
    const timeString = new Date(log.timestamp).toLocaleString();
    const actionName = log.action_type === 'CHECK_OUT' ? 'Checkout' : 'Return';
    const groupKey = `${timeString} - ${actionName}`;

    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(log);
    return acc;
  }, {});

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>SupplySync Dashboard</h1>

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

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

        {/* LEFT COLUMN */}
        <div style={{ flex: '7' }}>
          <h2>📦 Inventory</h2>

          {/* NEW FIX: Show Edit Form if an item is selected, otherwise show Add Form */}
          {editingItem ? (
            <EditItemForm
              item={editingItem}
              onUpdateSuccess={() => { setEditingItem(null); fetchAllData(); }}
              onCancel={() => setEditingItem(null)}
            />
          ) : (
            <AddItemForm onAddSuccess={fetchAllData} />
          )}

          {/* NEW: Search and Filter UI */}
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
              {/* NEW: Map over filteredInventory instead of inventory */}
              {filteredInventory.map((item) => {
                const available = getAvailableQty(item);
                const isOutOfStock = available <= 0;
                return (
                  <tr key={item.id} style={{ opacity: isOutOfStock ? 0.6 : 1 }}>
                    <td>{item.name}</td>
                    <td style={{ fontWeight: 'bold' }}>{item.quantity} <span style={{ color: '#007bff', fontWeight: 'normal' }}>(Avail: {available})</span></td>
                    <td>{item.status}</td>
                    <td>
                      {/* NEW FIX: Edit Button */}
                      <button
                        onClick={() => setEditingItem(item)}
                        style={{ backgroundColor: '#ffc107', color: 'black', marginRight: '5px', padding: '5px 10px', border: 'none', cursor: 'pointer' }}
                      >
                        Edit
                      </button>

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

          <h2>🕒 Recent Activity</h2>

          <div style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
            {Object.keys(groupedHistory).length === 0 ? <p>No recent activity.</p> : null}

            {Object.entries(groupedHistory).map(([groupKey, logs]) => {

              // NEW FIX: If there is ONLY ONE action in this group, skip the dropdown entirely!
              if (logs.length === 1) {
                const log = logs[0];
                return (
                  <div key={groupKey} style={{ marginBottom: '5px', padding: '10px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
                    <span style={{ color: '#888', fontSize: '0.85em', display: 'block', marginBottom: '4px' }}>{groupKey}</span>
                    <span style={{ fontSize: '0.9em' }}>
                      <strong>{log.first_name} {log.last_name}</strong> {log.action_type === 'CHECK_OUT' ? 'took' : 'returned'} <strong>{log.item}</strong>
                    </span>
                  </div>
                );
              }

              // OTHERWISE: If there are multiple actions, proceed with the folder logic
              const subGroupedByItem = logs.reduce((acc, log) => {
                if (!acc[log.item]) acc[log.item] = [];
                acc[log.item].push(log);
                return acc;
              }, {});

              const itemTypesCount = Object.keys(subGroupedByItem).length;

              return (
                <details key={groupKey} style={{ marginBottom: '5px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <summary style={{ cursor: 'pointer', padding: '10px', fontWeight: 'bold', outline: 'none' }}>
                    {groupKey} <span style={{ fontWeight: 'normal', color: '#666' }}>({logs.length} actions)</span>
                  </summary>

                  <div style={{ padding: '0 15px 10px 15px' }}>
                    {itemTypesCount > 1 ? (
                      // Multiple item types -> Show nested dropdowns
                      Object.entries(subGroupedByItem).map(([itemName, itemLogs]) => (
                        <details key={itemName} style={{ marginTop: '5px', backgroundColor: '#fdfdfd', border: '1px solid #eee', borderRadius: '4px' }}>
                          <summary style={{ cursor: 'pointer', padding: '5px', fontSize: '0.95em', fontWeight: 'bold' }}>
                            {itemName} <span style={{ fontWeight: 'normal', color: '#666' }}>({itemLogs.length})</span>
                          </summary>
                          <ul style={{ listStyle: 'none', padding: '5px 15px', margin: 0, borderTop: '1px solid #eee' }}>
                            {itemLogs.map(log => (
                              <li key={log.id} style={{ padding: '3px 0', borderBottom: '1px dotted #ccc', fontSize: '0.9em' }}>
                                {log.first_name} {log.last_name} {log.action_type === 'CHECK_OUT' ? 'took this' : 'returned this'}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ))
                    ) : (
                      // Only one item type -> Show flat list inside the folder
                      <ul style={{ listStyle: 'none', padding: '0', margin: 0 }}>
                        {logs.map(log => (
                          <li key={log.id} style={{ padding: '5px 0', borderBottom: '1px dotted #ccc', fontSize: '0.9em' }}>
                            <strong>{log.first_name} {log.last_name}</strong> {log.action_type === 'CHECK_OUT' ? 'took' : 'returned'} <strong>{log.item}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN */}
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
              <button onClick={handleSubmitQueue} style={{ width: '100%', padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontSize: '1em', fontWeight: 'bold', cursor: 'pointer' }}>
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