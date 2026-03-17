import { useEffect, useState } from 'react';
import AdminTools from './AdminTools';
import DetailedSearch from './DetailedSearch';

function App() {
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const [inventory, setInventory] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [projects, setProjects] = useState([]);

  const [selectedContractor, setSelectedContractor] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [actionQueue, setActionQueue] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [itemQuantities, setItemQuantities] = useState({});

  const [currentView, setCurrentView] = useState('dashboard'); 

  // Load saved theme from localStorage, or default to dark mode
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const fetchAllData = () => {
    fetch(`${API_BASE_URL}/inventory`).then(res => res.json()).then(setInventory).catch(console.error);
    fetch(`${API_BASE_URL}/contractors`).then(res => res.json()).then(setContractors).catch(console.error);
    fetch(`${API_BASE_URL}/projects`).then(res => res.json()).then(setProjects).catch(console.error);
  };

  useEffect(() => {
    fetchAllData();
  }, [API_BASE_URL]);

  const handleQueueAction = (item, type) => {
    if (!selectedContractor || !selectedProject) {
      alert("Please select both a Contractor and a Project first!");
      return;
    }
    const qtyInput = itemQuantities[item.id] || 1;
    if (qtyInput <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }
    if (type === 'checkout' && qtyInput > item.quantity) {
      alert(`Cannot checkout! Only ${item.quantity} available.`);
      return;
    }

    const contractorName = contractors.find(c => `${c.first_name} ${c.last_name}` === selectedContractor)
      ? selectedContractor : "Unknown Contractor";

    const newAction = {
      id: Date.now(), 
      item,
      type,
      qty: parseInt(qtyInput, 10),
      contractorName,
      projectName: selectedProject
    };

    setActionQueue([...actionQueue, newAction]);
    setItemQuantities(prev => ({ ...prev, [item.id]: '' })); 
  };

  const handleRemoveFromQueue = (actionId) => {
    setActionQueue(actionQueue.filter(a => a.id !== actionId));
  };

  const handleSubmitQueue = async () => {
    if (actionQueue.length === 0) return;

    try {
      for (const action of actionQueue) {
        const payload = {
          item_id: action.item.id,
          contractor_name: action.contractorName,
          project_name: action.projectName,
          quantity: action.qty,
          action_type: action.type === 'checkout' ? 'CHECK_OUT' : 'RETURN'
        };

        await fetch(`${API_BASE_URL}/transaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      setActionQueue([]);
      fetchAllData();
      alert("All actions processed successfully!");
    } catch (error) {
      console.error("Error processing queue:", error);
      alert("An error occurred while processing the queue. Check console.");
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === '' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="app-container">
      
      {/* TOP NAVIGATION BAR */}
      <div className="app-header">
        <h1 className="m-0 text-primary">SupplySync</h1>
        
        <div className="header-actions">
          <button onClick={toggleTheme} className="btn-outline" title="Toggle Light/Dark Mode">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <div style={{ display: 'flex' }}>
            <button 
              onClick={() => setCurrentView('dashboard')} 
              className={currentView === 'dashboard' ? 'btn-primary' : 'btn-outline'}
              style={{ borderRadius: '6px 0 0 6px', borderRight: 'none' }}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setCurrentView('reports')} 
              className={currentView === 'reports' ? 'btn-primary' : 'btn-outline'}
              style={{ borderRadius: '0 6px 6px 0' }}
            >
              Reports
            </button>
          </div>
        </div>
      </div>

      {currentView === 'dashboard' ? (
        <>
          {/* SELECTION BAR */}
          <div className="card selection-bar">
            <h3 className="m-0 w-full">1. Select Job Details:</h3>
            <select value={selectedContractor} onChange={(e) => setSelectedContractor(e.target.value)}>
              <option value="">-- Select Contractor --</option>
              {contractors.map(c => <option key={c.id} value={`${c.first_name} ${c.last_name}`}>{c.first_name} {c.last_name}</option>)}
            </select>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
              <option value="">-- Select Project --</option>
              {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>

          {/* TWO-COLUMN LAYOUT */}
          <div className="layout-grid">
            
            {/* LEFT COLUMN: INVENTORY */}
            <div className="card col-main">
              <h2 className="m-0 mb-15">2. Find Items</h2>
              
              <div className="controls-bar">
                <input 
                  type="text" 
                  placeholder="🔍 Search items..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="">All Categories</option>
                  <option value="TOOL">Tools</option>
                  <option value="PART">Parts</option>
                  <option value="MATERIAL">Materials</option>
                </select>
              </div>

              {/* Responsive Wrapper for Table */}
              <div className="table-responsive">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Available</th>
                      <th>Loc</th>
                      <th>Action Qty</th>
                      <th>Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map(item => (
                      <tr key={item.id}>
                        <td className="font-bold">{item.name}</td>
                        <td className="text-muted">{item.category}</td>
                        <td>
                          <span className={item.quantity > 5 ? 'text-success font-bold' : 'text-danger font-bold'}>
                            {item.quantity}
                          </span>
                        </td>
                        <td className="text-muted">{item.location}</td>
                        <td>
                          <input 
                            type="number" 
                            min="1" 
                            value={itemQuantities[item.id] || ''} 
                            onChange={(e) => setItemQuantities({...itemQuantities, [item.id]: e.target.value})}
                            placeholder="1"
                            style={{ width: '60px', padding: '6px' }} 
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => handleQueueAction(item, 'checkout')} className="btn-danger">
                              Out
                            </button>
                            <button onClick={() => handleQueueAction(item, 'return')} className="btn-success">
                              In
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredInventory.length === 0 && (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }} className="text-muted">No items found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIGHT COLUMN: PENDING ACTIONS CART */}
            <div className="card col-sidebar">
              <h2 className="m-0 mb-15">3. Pending Actions</h2>
              
              {actionQueue.length === 0 ? (
                <p className="text-muted" style={{ fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                  Queue is empty. Select items to check out or return.
                </p>
              ) : (
                <>
                  <ul className="pending-list mb-15">
                    {actionQueue.map(action => (
                      <li key={action.id} className="pending-item">
                        <div className="pending-item-header">
                          <strong className={action.type === 'checkout' ? 'text-danger' : 'text-success'}>
                            {action.type === 'checkout' ? '📉 Checkout' : '📈 Return'}
                          </strong>
                          <button onClick={() => handleRemoveFromQueue(action.id)} className="btn-icon-only text-danger" title="Remove">
                            ✕
                          </button>
                        </div>
                        <div>
                          Item: <span className="font-bold">{action.item.name}</span> <strong className="text-primary">(Qty: {action.qty})</strong>
                        </div>
                        <div className="text-muted">For: {action.contractorName}</div>
                      </li>
                    ))}
                  </ul>
                  <button onClick={handleSubmitQueue} className="btn-primary w-full" style={{ padding: '12px', fontSize: '1.1rem' }}>
                    Submit All Changes
                  </button>
                </>
              )}
            </div>

          </div>
        </>
      ) : (
        <DetailedSearch 
          API_BASE_URL={API_BASE_URL} 
          inventory={inventory}
          contractors={contractors} 
          projects={projects} 
        />
      )}

      {/* Admin controls render below everything */}
      <AdminTools 
        API_BASE_URL={API_BASE_URL} 
        inventory={inventory}
        contractors={contractors} 
        projects={projects} 
        onAddSuccess={fetchAllData} 
      />

    </div>
  );
}

export default App;