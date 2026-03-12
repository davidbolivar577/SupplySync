import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function DetailedSearch({ API_BASE_URL, contractors, projects }) {
  const [historyData, setHistoryData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);

  // Multi-Select Array States
  const [selectedContractors, setSelectedContractors] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);

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

    if (itemSearch) {
      results = results.filter(row => row.item?.toLowerCase().includes(itemSearch.toLowerCase()));
    }
    
    // Check if the row's contractor is in our selected array
    if (selectedContractors.length > 0) {
      results = results.filter(row => selectedContractors.includes(`${row.first_name} ${row.last_name}`.trim()));
    }
    
    // Check if the row's project is in our selected array
    if (selectedProjects.length > 0) {
      results = results.filter(row => selectedProjects.includes(row.project_name));
    }
    
    if (selectedAction) {
      results = results.filter(row => row.action_type === selectedAction);
    }
    
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
  }, [itemSearch, selectedContractors, selectedProjects, selectedAction, startDate, endDate, sortConfig, historyData]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') { direction = 'desc'; }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) return sortConfig.direction === 'asc' ? ' 🔼' : ' 🔽';
    return '';
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
    <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>📊 Detailed Reports</h2>
        <button onClick={exportToPDF} style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          📄 Export to PDF
        </button>
      </div>
      
      {/* FILTER CONTROL PANEL */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '6px' }}>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', borderRight: '1px solid #ddd', paddingRight: '15px' }}>
          <label style={{ fontSize: '0.9em', color: '#555' }}>From:</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
          <label style={{ fontSize: '0.9em', color: '#555' }}>To:</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
        </div>

        <input type="text" placeholder="🔍 Search item..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', flex: '1', minWidth: '150px' }} />

        {/* Multi-Select Dropdowns */}
        <select 
          value="" 
          onChange={(e) => {
            const val = e.target.value;
            if (val && !selectedContractors.includes(val)) setSelectedContractors([...selectedContractors, val]);
          }} 
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="">+ Add Contractor Filter</option>
          {contractors.map(c => <option key={c.id} value={`${c.first_name} ${c.last_name}`}>{c.first_name} {c.last_name}</option>)}
        </select>

        <select 
          value="" 
          onChange={(e) => {
            const val = e.target.value;
            if (val && !selectedProjects.includes(val)) setSelectedProjects([...selectedProjects, val]);
          }} 
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="">+ Add Project Filter</option>
          {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>

        <select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
          <option value="">All Actions</option>
          <option value="CHECK_OUT">Checkouts</option>
          <option value="RETURN">Returns</option>
        </select>
        
        <button onClick={() => { setItemSearch(''); setSelectedContractors([]); setSelectedProjects([]); setSelectedAction(''); setStartDate(''); setEndDate(''); }} style={{ padding: '8px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Clear All Filters
        </button>
      </div>

      {/* NEW: Active Filters Display (Chips) */}
      {(selectedContractors.length > 0 || selectedProjects.length > 0) && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {selectedContractors.map(name => (
            <span key={name} style={{ backgroundColor: '#007bff', color: 'white', padding: '5px 10px', borderRadius: '15px', fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              👤 {name} 
              <button onClick={() => setSelectedContractors(selectedContractors.filter(n => n !== name))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </span>
          ))}
          {selectedProjects.map(name => (
            <span key={name} style={{ backgroundColor: '#28a745', color: 'white', padding: '5px 10px', borderRadius: '15px', fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              🏗️ {name} 
              <button onClick={() => setSelectedProjects(selectedProjects.filter(n => n !== name))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* TABLE DATA */}
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table border="1" cellPadding="10" style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#e9ecef', cursor: 'pointer', userSelect: 'none' }}>
              <th onClick={() => handleSort('timestamp')}>Date{getSortIndicator('timestamp')}</th>
              <th onClick={() => handleSort('timestamp')}>Time</th>
              <th onClick={() => handleSort('action_type')}>Action{getSortIndicator('action_type')}</th>
              <th onClick={() => handleSort('item')}>Item{getSortIndicator('item')}</th>
              <th onClick={() => handleSort('quantity_changed')}>Qty{getSortIndicator('quantity_changed')}</th>
              <th onClick={() => handleSort('contractor_name')}>Contractor{getSortIndicator('contractor_name')}</th>
              <th onClick={() => handleSort('project_name')}>Project{getSortIndicator('project_name')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((row) => {
                const dateObj = new Date(row.timestamp);
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ color: '#444' }}>{dateObj.toLocaleDateString()}</td>
                    <td style={{ color: '#777', fontSize: '0.9em' }}>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ fontWeight: 'bold', color: row.action_type === 'CHECK_OUT' ? '#d93025' : '#1e8e3e' }}>
                      {row.action_type === 'CHECK_OUT' ? 'OUT' : 'IN'}
                    </td>
                    <td>{row.item || <span style={{color: 'red'}}>Deleted Item</span>}</td>
                    <td>{Math.abs(row.quantity_changed || 1)}</td> 
                    <td>{row.first_name ? `${row.first_name} ${row.last_name}` : <span style={{color: 'red'}}>Deleted</span>}</td>
                    <td>{row.project_name || <span style={{color: 'red'}}>Deleted Project</span>}</td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan="7" style={{ textAlign: 'center', color: '#777', padding: '30px' }}>No records match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DetailedSearch;