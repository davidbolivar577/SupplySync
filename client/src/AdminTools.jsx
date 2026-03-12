import { useState } from 'react';
import EditItemForm from './EditItemForm';
import './AdminTools.css'; // <-- Import the new clean styles!

function AdminTools({ API_BASE_URL, inventory, contractors, projects, onAddSuccess }) {
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');

  // Editing States
  const [editingContractorId, setEditingContractorId] = useState(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');

  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editProjectName, setEditProjectName] = useState('');

  const [editingItem, setEditingItem] = useState(null);

  // --- ITEM FUNCTIONS ---
  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/${id}`, { method: 'DELETE' });
      if (response.ok) onAddSuccess(); 
      else alert("Failed to delete item.");
    } catch (error) { console.error("Error deleting item:", error); }
  };

  // --- CONTRACTOR FUNCTIONS ---
  const handleAddContractor = async (e) => {
    e.preventDefault();
    if (!newFirstName || !newLastName) return alert("Please enter both first and last name.");
    try {
      await fetch(`${API_BASE_URL}/contractors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: newFirstName, last_name: newLastName })
      });
      setNewFirstName(''); setNewLastName('');
      onAddSuccess(); 
    } catch (error) { console.error("Error adding contractor:", error); }
  };

  const handleDeleteContractor = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/contractors/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) alert(data.error || "Failed to delete.");
      else onAddSuccess();
    } catch (error) { console.error("Error deleting:", error); }
  };

  const handleUpdateContractor = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/contractors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: editFirstName, last_name: editLastName })
      });
      setEditingContractorId(null);
      onAddSuccess();
    } catch (error) { console.error("Error updating contractor:", error); }
  };

  // --- PROJECT FUNCTIONS ---
  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!newProjectName) return alert("Please enter a project name.");
    try {
      await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName })
      });
      setNewProjectName('');
      onAddSuccess(); 
    } catch (error) { console.error("Error adding project:", error); }
  };

  const handleDeleteProject = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the project: ${name}?`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/projects/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) alert(data.error || "Failed to delete.");
      else onAddSuccess();
    } catch (error) { console.error("Error deleting:", error); }
  };

  const handleUpdateProject = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editProjectName })
      });
      setEditingProjectId(null);
      onAddSuccess();
    } catch (error) { console.error("Error updating project:", error); }
  };

  return (
    <div className="admin-container">
      <h2 className="admin-header">⚙️ Administrator Tools</h2>
      
      <div className="admin-grid">

        {/* LEFT COLUMN: INVENTORY */}
        <div className="admin-card">
          <h3>Manage Inventory</h3>
          {editingItem ? (
            <div style={{ backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '6px', border: '1px solid #444' }}>
              <EditItemForm
                item={editingItem}
                onUpdateSuccess={() => { setEditingItem(null); onAddSuccess(); }}
                onCancel={() => setEditingItem(null)}
              />
            </div>
          ) : (
            <ul className="admin-list">
              {inventory?.map(item => (
                <li key={item.id} className="admin-list-item">
                  <span className="admin-item-text">
                    {item.name} <span className="admin-item-subtext">({item.quantity} qty)</span>
                  </span>
                  <div className="action-buttons">
                    <button onClick={() => setEditingItem(item)} className="btn-icon edit" title="Edit">✎</button>
                    <button onClick={() => handleDeleteItem(item.id, item.name)} className="btn-icon delete" title="Delete">✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* MIDDLE COLUMN: CONTRACTORS */}
        <div className="admin-card">
          <h3>Manage Contractors</h3>
          <form onSubmit={handleAddContractor} className="admin-form">
            <input type="text" placeholder="First Name" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} className="admin-input" />
            <input type="text" placeholder="Last Name" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} className="admin-input" />
            <button type="submit" className="admin-btn btn-success">+ Add</button>
          </form>

          <ul className="admin-list">
            {contractors?.map(c => (
              <li key={c.id} className="admin-list-item">
                {editingContractorId === c.id ? (
                  <div className="admin-edit-row">
                    <input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} className="admin-input" />
                    <input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} className="admin-input" />
                    <div className="action-buttons">
                      <button onClick={() => handleUpdateContractor(c.id)} className="admin-btn btn-primary">Save</button>
                      <button onClick={() => setEditingContractorId(null)} className="admin-btn btn-secondary">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="admin-item-text">{c.first_name} {c.last_name}</span>
                    <div className="action-buttons">
                      <button onClick={() => { setEditingContractorId(c.id); setEditFirstName(c.first_name); setEditLastName(c.last_name); }} className="btn-icon edit" title="Edit">✎</button>
                      <button onClick={() => handleDeleteContractor(c.id, `${c.first_name} ${c.last_name}`)} className="btn-icon delete" title="Delete">✕</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT COLUMN: PROJECTS */}
        <div className="admin-card">
          <h3>Manage Projects</h3>
          <form onSubmit={handleAddProject} className="admin-form">
            <input type="text" placeholder="New Project" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="admin-input" />
            <button type="submit" className="admin-btn btn-success">+ Add</button>
          </form>

          <ul className="admin-list">
            {projects?.map(p => (
              <li key={p.id} className="admin-list-item">
                {editingProjectId === p.id ? (
                  <div className="admin-edit-row">
                    <input type="text" value={editProjectName} onChange={(e) => setEditProjectName(e.target.value)} className="admin-input" />
                    <div className="action-buttons">
                      <button onClick={() => handleUpdateProject(p.id)} className="admin-btn btn-primary">Save</button>
                      <button onClick={() => setEditingProjectId(null)} className="admin-btn btn-secondary">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="admin-item-text">{p.name}</span>
                    <div className="action-buttons">
                      <button onClick={() => { setEditingProjectId(p.id); setEditProjectName(p.name); }} className="btn-icon edit" title="Edit">✎</button>
                      <button onClick={() => handleDeleteProject(p.id, p.name)} className="btn-icon delete" title="Delete">✕</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}

export default AdminTools;