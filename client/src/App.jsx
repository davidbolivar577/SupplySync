import { useEffect, useState } from 'react';
import AdminTools from './components/AdminTools';
import DetailedSearch from './components/DetailedSearch';
import Login from './components/Login';
import AddItemForm from './components/AddItemForm';

function App() {
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const [inventory, setInventory] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [projects, setProjects] = useState([]);

  const [selectedContractor, setSelectedContractor] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [actionQueue, setActionQueue] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('inventory_token'));
  const [userRole, setUserRole] = useState(localStorage.getItem('user_role') || '');

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [itemQuantities, setItemQuantities] = useState({});

  const [showAddForm, setShowAddForm] = useState(false);

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

  const handleLogout = () => {
    localStorage.removeItem('inventory_token');
    localStorage.removeItem('user_role');

    setIsAuthenticated(false);
    setUserRole('');
  };

  const fetchAllData = () => {
    const token = localStorage.getItem('inventory_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    // We added a check here: "res.ok ? res.json() : []" 
    // If the server rejects us, default to an empty array so the app doesn't crash!
    fetch(`${API_BASE_URL}/inventory`, { headers })
      .then(res => res.ok ? res.json() : [])
      .then(setInventory)
      .catch(console.error);

    fetch(`${API_BASE_URL}/contractors`, { headers })
      .then(res => res.ok ? res.json() : [])
      .then(setContractors)
      .catch(console.error);

    fetch(`${API_BASE_URL}/projects`, { headers })
      .then(res => res.ok ? res.json() : [])
      .then(setProjects)
      .catch(console.error);
  };

  // Only run the fetch when isAuthenticated changes to TRUE
  useEffect(() => {
    // Only attempt to fetch data if we are actually authenticated
    if (isAuthenticated) {
      fetchAllData();
    }
  }, [isAuthenticated]);

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

    // Find the actual names for the UI display based on the selected IDs
    const foundContractor = contractors.find(c => c.id.toString() === selectedContractor);
    const contractorName = foundContractor ? `${foundContractor.first_name} ${foundContractor.last_name}` : "Unknown Contractor";

    const foundProject = projects.find(p => p.id.toString() === selectedProject);
    const projectName = foundProject ? foundProject.name : "Unknown Project";

    const newAction = {
      id: Date.now(),
      item,
      type,
      qty: parseInt(qtyInput, 10),
      contractorId: selectedContractor, // Explicitly save the ID
      projectId: selectedProject,       // Explicitly save the ID
      contractorName,
      projectName
    };

    setActionQueue([...actionQueue, newAction]);
    setItemQuantities(prev => ({ ...prev, [item.id]: '' }));
  };

  const handleRemoveFromQueue = (actionId) => {
    setActionQueue(actionQueue.filter(a => a.id !== actionId));
  };

  const handleSubmitQueue = async () => {
    if (actionQueue.length === 0) return;

    const token = localStorage.getItem('inventory_token');
    let allSuccessful = true;

    // Process each item in the queue
    for (const action of actionQueue) {
      // 1. Dynamically pick the correct backend route
      const endpoint = action.type === 'checkout' ? '/checkout' : '/return';

      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          // 2. Format the payload exactly how server.js expects it
          body: JSON.stringify({
            items: [{ id: action.item.id, quantity: action.qty }],
            contractor_id: action.contractorId,
            project_id: action.projectId
          })
        });

        if (!response.ok) {
          console.error(`Failed to process ${action.type} for ${action.item.name}`);
          allSuccessful = false;
        }
      } catch (error) {
        console.error("Error submitting transaction:", error);
        allSuccessful = false;
      }
    }

    // 3. Clean up UI if everything worked
    if (allSuccessful) {
      setActionQueue([]); // Clear the cart
      fetchAllData();     // Refresh the inventory quantities from the database
      // Optional: You can add a success message state here instead of an alert if you prefer
      alert("All transactions processed successfully!");
    } else {
      alert("Some transactions failed to process. Please check the console.");
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === '' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (!isAuthenticated) {
    return <Login setAuth={setIsAuthenticated} setUserRole={setUserRole} />;
  }

  return (
    <div className="app-container">

      {/* TOP NAVIGATION BAR */}
      <div className="app-header">
        <h1 className="m-0 text-primary">Inventory Portal</h1>

        <div className="header-actions">
          <button onClick={() => setCurrentView(currentView === 'dashboard' ? 'search' : 'dashboard')} className="btn-primary">
            {currentView === 'dashboard' ? '📊 View Reports' : '🏠 Back to Dashboard'}
          </button>

          <button onClick={toggleTheme} className="btn-secondary" style={{ padding: '8px 16px' }}>
            {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>

          <button onClick={handleLogout} className="btn-secondary text-danger" style={{ padding: '8px 16px', fontWeight: 'bold' }}>
            Log Out
          </button>
        </div>
      </div>

      {currentView === 'dashboard' ? (
        <>
          {/* SELECTION BAR */}
          {userRole !== 'limited' && (
            <div className="card selection-bar">
              <h3 className="m-0 w-full">Select Job Details:</h3>
              <select value={selectedContractor} onChange={(e) => setSelectedContractor(e.target.value)}>
                <option value="">-- Select Contractor --</option>
                {/* CHANGED: value is now c.id instead of the name string */}
                {contractors.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
              <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
                <option value="">-- Select Project --</option>
                {/* CHANGED: value is now p.id instead of the name string */}
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* TWO-COLUMN LAYOUT */}
          <div className="layout-grid">

            {/* LEFT COLUMN: INVENTORY */}
            <div className="card col-main">
              <h2 className="m-0 mb-15">Find Items</h2>

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

              {userRole !== 'limited' && (
                <div style={{ marginBottom: '15px' }}>
                  <button onClick={() => setShowAddForm(!showAddForm)} className="btn-secondary">
                    {showAddForm ? '- Cancel New Item' : '+ Add New Item to Catalog'}
                  </button>

                  {showAddForm && (
                    <div className="card mt-15">
                      <h3>Create New Catalog Item</h3>
                      <AddItemForm
                        userRole={userRole}
                        onAddSuccess={() => {
                          fetchAllData();
                          setShowAddForm(false);
                          alert("Item added! Please check it in to add quantity.");
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Responsive Wrapper for Table */}
              <div className="table-responsive">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Available</th>
                      <th>Location</th>
                      {userRole !== 'limited' && <th>Action Qty</th>}
                      {userRole !== 'limited' && <th>Quick Actions</th>}
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
                        {userRole !== 'limited' && (
                          <td>
                            <input
                              type="number"
                              min="1"
                              value={itemQuantities[item.id] || ''}
                              onChange={(e) => setItemQuantities({ ...itemQuantities, [item.id]: e.target.value })}
                              placeholder="1"
                              style={{ width: '60px', padding: '6px' }}
                            />
                          </td>
                        )}
                        {userRole !== 'limited' && (
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => handleQueueAction(item, 'checkout')} className="btn-danger">Out</button>
                              <button onClick={() => handleQueueAction(item, 'return')} className="btn-success">In</button>
                            </div>
                          </td>
                        )}
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
            {userRole !== 'limited' && (
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
            )}

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

      {/* Admin controls ONLY render if the user is an admin */}
      {userRole === 'admin' && (
        <AdminTools
          API_BASE_URL={API_BASE_URL}
          inventory={inventory}
          contractors={contractors}
          projects={projects}
          onAddSuccess={fetchAllData}
        />
      )}

    </div>
  );
}

export default App;