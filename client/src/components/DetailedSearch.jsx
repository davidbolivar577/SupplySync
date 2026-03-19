import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function DetailedSearch({ API_BASE_URL, inventory, contractors, projects }) {
  const [historyData, setHistoryData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);

  // Multi-Select Array States
  const [selectedContractors, setSelectedContractors] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]); 

  // Searchable Input States
  const [itemInput, setItemInput] = useState('');
  const [contractorInput, setContractorInput] = useState('');
  const [projectInput, setProjectInput] = useState('');

  // Other Filters
  const [itemSearch, setItemSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  useEffect(() => {
    fetch(`${API_BASE_URL}/history`)
      .then(res => res.json())
      .then(data => {
        setHistoryData(data);
        setFilteredData(data);
      })
      .catch(err => console.error("Error fetching history:", err));
  }, [API_BASE_URL]);

  useEffect(() => {
    let results = [...historyData];

    if (itemSearch) results = results.filter(row => row.item?.toLowerCase().includes(itemSearch.toLowerCase()));
    if (selectedItems.length > 0) results = results.filter(row => selectedItems.includes(row.item));
    if (selectedContractors.length > 0) results = results.filter(row => selectedContractors.includes(`${row.first_name} ${row.last_name}`.trim()));
    if (selectedProjects.length > 0) results = results.filter(row => selectedProjects.includes(row.project_name));
    if (selectedAction) results = results.filter(row => row.action_type === selectedAction);
    
    if (startDate) {
      const [year, month, day] = startDate.split('-');
      const start = new Date(year, month - 1, day, 0, 0, 0);
      results = results.filter(row => new Date(row.timestamp) >= start);
    }
    if (endDate) {
      const [year, month, day] = endDate.split('-');
      const end = new Date(year, month - 1, day, 23, 59, 59);
      results = results.filter(row => new Date(row.timestamp) <= end);
    }

    results.sort((a, b) => {
      let aValue = a[sortConfig.key] || '';
      let bValue = b[sortConfig.key] || '';

      if (sortConfig.key === 'contractor_name') {
        aValue = `${a.first_name} ${a.last_name}`.toLowerCase();
        bValue = `${b.first_name} ${b.last_name}`.toLowerCase();
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredData(results);
  }, [itemSearch, selectedItems, selectedContractors, selectedProjects, selectedAction, startDate, endDate, sortConfig, historyData]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') { direction = 'desc'; }
    setSortConfig({ key, direction });
  };

  const exportToPDF = () => {
    const userTitle = window.prompt("Enter a title for this report:", "SupplySync Detailed Report");
    if (userTitle === null) return; 

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(userTitle || "SupplySync Detailed Report", 14, 22); 
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableColumn = ["Date", "Time", "Action", "Item", "Qty", "Contractor", "Project"];
    const tableRows = [];

    filteredData.forEach(row => {
      const dateObj = new Date(row.timestamp);
      tableRows.push([
        dateObj.toLocaleDateString(),
        dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        row.action_type === 'CHECK_OUT' ? 'OUT' : 'IN',
        row.item || 'Deleted Item',
        Math.abs(row.quantity_changed || 1),
        `${row.first_name || 'Deleted'} ${row.last_name || ''}`.trim(),
        row.project_name || 'Deleted Project'
      ]);
    });

    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 35, styles: { fontSize: 9 }, headStyles: { fillColor: [0, 123, 255] } });
    doc.save("SupplySync_Report.pdf");
  };

  return (
    <div className="card">
      <div className="detailed-header">
        <h2 className="m-0">🔎 Detailed Search & Reports</h2>
        <button onClick={exportToPDF} className="btn-primary w-full" style={{ maxWidth: '200px' }}>📄 Export to PDF</button>
      </div>
      
      {/* FILTER CONTROL PANEL */}
      <div className="filter-panel">
        
        <div className="date-filter">
          <label className="text-muted" style={{ fontSize: '0.9em' }}>From:</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <label className="text-muted" style={{ fontSize: '0.9em' }}>To:</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <input 
          type="text" 
          placeholder="🔍 Fuzzy Search..." 
          value={itemSearch} 
          onChange={(e) => setItemSearch(e.target.value)} 
        />

        <input 
          list="item-options" 
          placeholder="+ Add Item Filter" 
          value={itemInput}
          onChange={(e) => {
            const val = e.target.value;
            setItemInput(val);
            if (inventory?.some(i => i.name === val) && !selectedItems.includes(val)) {
              setSelectedItems([...selectedItems, val]);
              setItemInput('');
            }
          }}
        />
        <datalist id="item-options">
          {inventory?.map(i => <option key={i.id} value={i.name} />)}
        </datalist>

        <input 
          list="contractor-options" 
          placeholder="+ Add Contractor Filter" 
          value={contractorInput}
          onChange={(e) => {
            const val = e.target.value;
            setContractorInput(val);
            if (contractors?.some(c => `${c.first_name} ${c.last_name}` === val) && !selectedContractors.includes(val)) {
              setSelectedContractors([...selectedContractors, val]);
              setContractorInput('');
            }
          }}
        />
        <datalist id="contractor-options">
          {contractors?.map(c => <option key={c.id} value={`${c.first_name} ${c.last_name}`} />)}
        </datalist>

        <input 
          list="project-options" 
          placeholder="+ Add Project Filter" 
          value={projectInput}
          onChange={(e) => {
            const val = e.target.value;
            setProjectInput(val);
            if (projects?.some(p => p.name === val) && !selectedProjects.includes(val)) {
              setSelectedProjects([...selectedProjects, val]);
              setProjectInput('');
            }
          }}
        />
        <datalist id="project-options">
          {projects?.map(p => <option key={p.id} value={p.name} />)}
        </datalist>

        <select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)}>
          <option value="">All Actions</option>
          <option value="CHECK_OUT">Checkouts</option>
          <option value="RETURN">Returns</option>
        </select>
        
        <button 
          onClick={() => { 
            setItemSearch(''); setSelectedItems([]); setSelectedContractors([]); setSelectedProjects([]); setSelectedAction(''); setStartDate(''); setEndDate(''); 
            setItemInput(''); setContractorInput(''); setProjectInput(''); 
          }} 
          className="btn-outline w-full"
        >
          Clear Filters
        </button>
      </div>

      {/* ACTIVE FILTERS DISPLAY (CHIPS) */}
      {(selectedItems.length > 0 || selectedContractors.length > 0 || selectedProjects.length > 0) && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {selectedItems.map(name => (
            <span key={name} style={{ backgroundColor: 'var(--warning)', color: '#111', padding: '5px 10px', borderRadius: '15px', fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              📦 {name} 
              <button onClick={() => setSelectedItems(selectedItems.filter(n => n !== name))} style={{ background: 'none', border: 'none', color: '#111', cursor: 'pointer', fontWeight: 'bold', padding: '0 0 0 5px' }}>✕</button>
            </span>
          ))}
          {selectedContractors.map(name => (
            <span key={name} style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '5px 10px', borderRadius: '15px', fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              👤 {name} 
              <button onClick={() => setSelectedContractors(selectedContractors.filter(n => n !== name))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold', padding: '0 0 0 5px' }}>✕</button>
            </span>
          ))}
          {selectedProjects.map(name => (
            <span key={name} style={{ backgroundColor: 'var(--success)', color: 'white', padding: '5px 10px', borderRadius: '15px', fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              🏗️ {name} 
              <button onClick={() => setSelectedProjects(selectedProjects.filter(n => n !== name))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold', padding: '0 0 0 5px' }}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* TABLE DATA */}
      <div className="table-responsive">
        <table id="history-table" style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('timestamp')} style={{ cursor: 'pointer' }}>Date {sortConfig.key === 'timestamp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th>Time</th>
              <th onClick={() => handleSort('action_type')} style={{ cursor: 'pointer' }}>Action {sortConfig.key === 'action_type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('item')} style={{ cursor: 'pointer' }}>Item {sortConfig.key === 'item' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th>Qty</th>
              <th>Contractor</th>
              <th>Project</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((row) => {
                const dateObj = new Date(row.timestamp);
                return (
                  <tr key={row.id}>
                    <td>{dateObj.toLocaleDateString()}</td>
                    <td className="text-muted" style={{ fontSize: '0.9em' }}>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ fontWeight: 'bold', color: row.action_type === 'CHECK_OUT' ? 'var(--danger)' : 'var(--success)' }}>
                      {row.action_type === 'CHECK_OUT' ? 'OUT' : 'IN'}
                    </td>
                    <td>{row.item || <span className="text-danger">Deleted Item</span>}</td>
                    <td>{Math.abs(row.quantity_changed || 1)}</td> 
                    <td>{row.first_name ? `${row.first_name} ${row.last_name}` : <span className="text-danger">Deleted</span>}</td>
                    <td>{row.project_name || <span className="text-danger">Deleted Project</span>}</td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px' }} className="text-muted">No records match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DetailedSearch;