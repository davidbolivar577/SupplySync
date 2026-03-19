import React from 'react';
import { GoogleLogin } from '@react-oauth/google';

const Login = ({ setAuth }) => {

  const handleSuccess = async (credentialResponse) => {
    try {
      // Send the Google token to your Express backend
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential })
      });

      const data = await res.json();

      if (res.ok) {
        console.log("✅ Successfully logged in as:", data.user.role);
        // Save your app's session token to local storage so they stay logged in
        localStorage.setItem('inventory_token', data.token);
        localStorage.setItem('user_role', data.user.role);
        
        // Let them into the app!
        setAuth(true);
      } else {
        alert(data.error || "Login failed.");
      }
    } catch (err) {
      console.error("Backend connection error:", err);
      alert("Failed to connect to the server.");
    }
  };

  const handleError = () => {
    console.error("❌ Google Login Failed");
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      width: '100%',
      backgroundColor: 'var(--bg-main)' 
    }}>
      <div className="card" style={{ 
        width: '100%', 
        maxWidth: '400px', 
        textAlign: 'center', 
        padding: '40px 20px',
        margin: '20px'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '10px' }}>Inventory Portal</h2>
        <p className="text-muted" style={{ marginBottom: '30px' }}>
          Please sign in to access your dashboard.
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin 
            onSuccess={handleSuccess}
            onError={handleError}
            theme="outline" 
            size="large"
          />
        </div>
      </div>
    </div>
  );
};

export default Login;