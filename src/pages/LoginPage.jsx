// pages/LoginPage.jsx
import React, { useState,useEffect } from "react";
import axios from "axios";
export default function LoginPage({ onLoginSuccess }) {
  // const [username, setUsername] = useState("");
  // const [password, setPassword] = useState("");
  const username ="TrungKhanh";
  const password ="1";
  const [loading, setLoading] = useState(false);  
  const [checking, setChecking] = useState(true);


  const VITE_URL_BACKEND = import.meta.env.VITE_URL_BACKEND;
  
  const handleLogin = async () => {
    if (!username || !password) {
      alert("Enter username and password");
      return;
    }
    setLoading(true);
    const request_id = new Date().valueOf();

    try {
      console.log("Logging URL_BACKEND:", VITE_URL_BACKEND);
      const res = await axios.post(`${VITE_URL_BACKEND}/api/accounts/login`, {
        request_id,
        username,
        password,
      });

      if (res.data.login) {
        console.log("Logged in user:", username);
        onLoginSuccess(username);
      } else {
        alert(res.data.message || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      alert("Error logging in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Login</h2>
      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={{ display: "block", marginBottom: 10 }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", marginBottom: 10 }}
      />
      <button onClick={handleLogin} disabled={loading}>
        {loading ? "Logging in..." : "Login"}
      </button>
    </div>
  );
}
