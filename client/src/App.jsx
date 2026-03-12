import { useEffect, useState } from 'react';
import AddItemForm from './AddItemForm';
import AdminTools from './AdminTools';
import DetailedSearch from './DetailedSearch';

function App() {
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
  const [itemQuantities, setItemQuantities] = useState({});

  const [currentView, setCurrentView] = useState('dashboard'); 

  // --- NEW: THEME SYSTEM ---
  // Load saved theme from localStorage, or default to dark mode
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    // This applies the theme to the entire HTML document
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };
  // -------------------------

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
    const queuedCheckouts = actionQueue.filter(a => a.item.id === item.id && a.type === 'checkout').reduce((sum, a) => sum + a.qty, 0);
    const queuedReturns = actionQueue.filter(a => a.item.id === item.id && a.type === 'return').reduce((sum, a) => sum + a.qty, 0);
    return item.quantity - queuedCheckouts + queuedReturns;
  };

  const handleAddToQueue = (type, item) => {
    if (!selectedContractor || !selectedProject) {
      alert("Please select a Contractor and Project first!");
      return;
    }
    const qtyInput = parseInt(itemQuantities[item.id]) || 1;
    const available = getAvailableQty(item);

    if (type === 'checkout' && qtyInput > available) {
      alert(`Cannot checkout ${qtyInput}. Only ${available} available.`);
      return;
    }

    const newAction = {
      id: Date.now(),
      type,
      item,
      qty: qtyInput,
      contractorName: selectedContractor,
      projectName: selectedProject
    };

    setActionQueue([...actionQueue, newAction]);
    setItemQuantities({ ...itemQuantities, [item.id]: 1 });
  };

  const handleRemoveFromQueue = (actionId) => {
    setActionQueue(actionQueue.filter(a => a.id !== actionId));
  };

  const handleSubmitQueue = async () => {
    if (actionQueue.length === 0) return;
    try {
      for (const action of actionQueue) {
        const contractorId = contractors.find(c => `${c.first_name} ${c.last_name}` === action.contractorName)?.id;
        const projectId = projects.find(p => p.name === action.projectName)?.id;
        
        await fetch(`${API_BASE_URL}/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inventory_id: action.item.id,
            contractor_id: contractorId,
            project_id: projectId,
            action_type: action.type === 'checkout' ? 'CHECK_OUT' : 'RETURN',
            quantity: action.qty
          })
        });
      }
      alert("All actions recorded successfully!");
      setActionQueue([]);
      fetchAllData();
    } catch (error) {
      console.error("Error submitting queue:", error);
      alert("An error occurred. Please check the console.");
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border-color)', paddingBottom: '15px', marginBottom: '25px' }}>
        <h1 style={{ margin: 0, color: 'var(--primary)' }}>SupplySync</h1>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {/* THEME TOGGLE BUTTON */}
          <button onClick={toggleTheme} className="btn-outline" style={{ padding: '8px 12px', fontSize: '1.2rem' }} title="Toggle Light/Dark Mode">
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
              Detailed Reports
            </button>
          </div>
        </div>
      </div>

      {currentView === 'dashboard' ? (
        <>
          {/* SELECTION BAR */}
          <div className="card" style={{ marginBottom: '25px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
            <h3 style={{ margin: 0, border: 'none', padding: 0 }}>1. Select Job Details:</h3>
            <select value={selectedContractor} onChange={(e) => setSelectedContractor(e.target.value)} style={{ flex: 1, minWidth: '200px' }}>
              <option value="">-- Select Contractor --</option>
              {contractors.map(c => <option key={c.id} value={`${c.first_name} ${c.last_name}`}>{c.first_name} {c.last_name}</option>)}
            </select>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} style={{ flex: 1, minWidth: '200px' }}>
              <option value="">-- Select Project --</option>
              {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>

          {/* TWO-COLUMN LAYOUT */}
          <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            
            {/* LEFT COLUMN */}
            <div className="card" style={{ flex: '7', minWidth: '400px' }}>
              <h2>📦 Inventory</h2>

              <AddItemForm onAddSuccess={fetchAllData} />

              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input 
                  type="text" 
                  placeholder="🔍 Search items..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  style={{ flex: '1' }}
                />
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="">All Categories</option>
                  <option value="TOOL">Tools</option>
                  <option value="PART">Parts</option>
                  <option value="MATERIAL">Materials</option>
                </select>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Quantity</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item) => {
                      const available = getAvailableQty(item);
                      const isOutOfStock = available <= 0;
                      return (
                        <tr key={item.id} style={{ opacity: isOutOfStock ? 0.6 : 1 }}>
                          <td>{item.name}</td>
                          <td style={{ fontWeight: 'bold' }}>{item.quantity} <span style={{ color: 'var(--primary)', fontWeight: 'normal' }}>(Avail: {available})</span></td>
                          <td>{item.status}</td>
                          <td style={{ display: 'flex', gap: '5px' }}>
                            <input
                              type="number"
                              min="1"
                              max={available}
                              value={itemQuantities[item.id] || 1}
                              onChange={(e) => setItemQuantities({ ...itemQuantities, [item.id]: e.target.value })}
                              style={{ width: '60px' }}
                            />
                            <button onClick={() => handleAddToQueue('checkout', item)} disabled={isOutOfStock} className={isOutOfStock ? 'btn-outline' : 'btn-danger'}>Out</button>
                            <button onClick={() => handleAddToQueue('return', item)} className="btn-success">In</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="card" style={{ flex: '3', minWidth: '300px' }}>
              <h2>🛒 Pending Actions</h2>
              {actionQueue.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No items queued. Select a contractor and project, then check items in/out.</p>
              ) : (
                <>
                  <ul style={{ listStyle: 'none', padding: 0, marginBottom: '20px' }}>
                    {actionQueue.map(action => (
                      <li key={action.id} style={{ padding: '15px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', borderRadius: '6px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <strong style={{ color: action.type === 'checkout' ? 'var(--danger)' : 'var(--success)' }}>
                            {action.type === 'checkout' ? '📉 Checkout' : '📈 Return'}
                          </strong>
                          <button onClick={() => handleRemoveFromQueue(action.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '1.2rem', padding: 0 }}>×</button>
                        </div>
                        <div>Item: {action.item.name} <strong style={{ color: 'var(--primary)' }}>(Qty: {action.qty})</strong></div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9em', marginTop: '5px' }}>For: {action.contractorName}</div>
                      </li>
                    ))}
                  </ul>
                  <button onClick={handleSubmitQueue} className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}>
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