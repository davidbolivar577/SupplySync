import { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';

const Login = ({ setAuth, setUserRole }) => {
  const API_BASE_URL = import.meta.env.VITE_API_URL;
  
  // States for Login Link
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- 1. CATCH THE LINK FROM THE URL ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const linkToken = urlParams.get('link_token');

    if (linkToken) {
      verifyLink(linkToken);
    }
  }, []);

  const verifyLink = async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      
      const data = await res.json();

      if (res.ok) {
        // Log them in!
        localStorage.setItem('inventory_token', data.token);
        localStorage.setItem('user_role', data.user.role);
        setAuth(true);
        setUserRole(data.user.role);
        
        // Clean up the URL so the token disappears from the address bar
        window.history.replaceState({}, document.title, "/");
      } else {
        setError(data.error || 'Invalid or expired link.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error while verifying link.');
    }
  };

  // --- 2. SEND THE LOGIN LINK ---
  const handleSendLink = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/auth/send-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
        setEmail(''); // Clear the input
      } else {
        setError(data.error || 'Failed to send link.');
      }
    } catch (err) {
      setError('Could not connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. EXISTING GOOGLE LOGIN LOGIC ---
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('inventory_token', data.token);
        localStorage.setItem('user_role', data.user.role);
        setAuth(true);
        setUserRole(data.user.role);
      } else {
        setError(data.error || 'Google login failed.');
      }
    } catch (err) {
      setError('Server error during Google login.');
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '30px' }}>
        <h2 className="text-primary mb-25">Inventory Portal</h2>
        
        {/* Error / Success Messages */}
        {error && <div className="text-danger mb-15" style={{ background: '#fee2e2', padding: '10px', borderRadius: '5px' }}>{error}</div>}
        {message && <div className="text-success mb-15" style={{ background: '#d1fae5', padding: '10px', borderRadius: '5px' }}>{message}</div>}

        {/* LOGIN LINK FORM */}
        <form onSubmit={handleSendLink} style={{ marginBottom: '25px' }}>
          <p className="text-muted" style={{ marginBottom: '10px' }}>Log in via Email</p>
          <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
            <input 
              type="email" 
              placeholder="admin@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary w-full" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Login Link'}
            </button>
          </div>
        </form>

        <div className="text-muted mb-15">OR</div>

        {/* GOOGLE LOGIN BUTTON */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin 
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google login popup closed or failed.')}
          />
        </div>

      </div>
    </div>
  );
};

export default Login;