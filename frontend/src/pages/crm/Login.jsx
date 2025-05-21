import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { loginSuccess } from "../../redux/authSlice";
import "../../styles/crm/Login.css";
import { toast } from 'react-toastify';

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.token) return toast.error(data.message || "Login failed.");
    if (data.user && data.user.enabled === false)
      return toast.error("Your account is disabled. Please contact support.");

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    dispatch(loginSuccess(data.user));
    navigate("/crm/entrydashboard");
  };

  return (
    <div className="login-page">
      <div className="login-card">
<<<<<<< HEAD
        <div className="login-box">
=======
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973
        <h2 className="login-title">Sign In</h2>
        <p className="login-subtitle">Welcome back !</p>
        {/* <button className="google-btn">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
          Signup with Google
        </button>
        <div className="divider">OR</div> */}
        <form onSubmit={handleLogin}>
          <label className="login-label">Username</label>
          <input
          className="login-input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <div className="password-row">
            <label >Password</label>
            <a href="#">Forget password ?</a>
          </div>
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="remember-row">
            <input type="checkbox" id="remember" />
            <label htmlFor="remember">Remember password ?</label>
          </div>
          <button className="signin-btn" type="submit">Sign In</button>
        </form>
        <p className="signup-msg">
          Dont have an account? <a href="#">Sign Up</a>
        </p>
        <div className="social-icons">
          <button className="social-btn fb">f</button>
          <button className="social-btn pink">X</button>
          <button className="social-btn ig">i</button>
        </div>
<<<<<<< HEAD
      </div></div>
=======
      </div>
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973

      <div className="login-side">
        <img src="/assets/logo.png" alt="logo" />
        <h2>Hello Again!</h2>
        <h4>Ready to Dive In?</h4>
        <p>
          Stay connected to your data, tasks, and performance all in one place.
          Secure, simple, and built for productivity.
        </p>
      </div>
    </div>
  );
};

export default Login;
