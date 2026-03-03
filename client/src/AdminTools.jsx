import { useState } from 'react';

function AdminTools({ onAddSuccess }) {
    const API_BASE_URL = import.meta.env.VITE_API_URL;
    // Contractor State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    // Project State
    const [projectName, setProjectName] = useState('');
    const [projectAddress, setProjectAddress] = useState('');

    const handleAddContractor = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/contractors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ first_name: firstName, last_name: lastName, phone: null, email: null })
        }).then(res => {
            if (res.ok) {
                alert('Contractor Added!');
                setFirstName('');
                setLastName('');
                onAddSuccess(); // Refresh dropdowns!
            }
        });
    };

    const handleAddProject = (e) => {
        e.preventDefault();
        fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: projectName, address: projectAddress })
        }).then(res => {
            if (res.ok) {
                alert('Project Added!');
                setProjectName('');
                setProjectAddress('');
                onAddSuccess(); // Refresh dropdowns!
            }
        });
    };

    return (
        <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#e9ecef', borderRadius: '8px' }}>
            <h2>⚙️ Admin Tools</h2>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>

                {/* ADD CONTRACTOR FORM */}
                <div style={{ flex: '1', minWidth: '300px', backgroundColor: 'white', padding: '15px', borderRadius: '5px', border: '1px solid #ccc' }}>
                    <h4>👷 Add New Contractor</h4>
                    <form onSubmit={handleAddContractor} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input type="text" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} required style={{ padding: '8px' }} />
                        <input type="text" placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} required style={{ padding: '8px' }} />
                        <button type="submit" style={{ backgroundColor: '#17a2b8', color: 'white', padding: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Add Contractor</button>
                    </form>
                </div>

                {/* ADD PROJECT FORM */}
                <div style={{ flex: '1', minWidth: '300px', backgroundColor: 'white', padding: '15px', borderRadius: '5px', border: '1px solid #ccc' }}>
                    <h4>🏗️ Add New Project</h4>
                    <form onSubmit={handleAddProject} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input type="text" placeholder="Project Name (e.g. '123 Main St')" value={projectName} onChange={e => setProjectName(e.target.value)} required style={{ padding: '8px' }} />
                        <input type="text" placeholder="Address (Optional)" value={projectAddress} onChange={e => setProjectAddress(e.target.value)} style={{ padding: '8px' }} />
                        <button type="submit" style={{ backgroundColor: '#6f42c1', color: 'white', padding: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Add Project</button>
                    </form>
                </div>

            </div>
        </div>
    );
}

export default AdminTools;