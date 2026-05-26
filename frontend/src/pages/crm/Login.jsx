import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { loginSuccess } from "../../redux/authSlice";
import { toast } from "react-toastify";
import CustomToast from "../../components/crm/CustomToast";
import { FiEye, FiEyeOff } from "react-icons/fi";
import "../../styles/crm/Login.css";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

    if (!res.ok || !data.token) {
      return toast(
        <CustomToast
          type="error"
          title="Login Failed!"
          message={data.message || "Invalid credentials. Please try again."}
        />
      );
    }

    if (data.user && data.user.enabled === false) {
      return toast(
        <CustomToast
          type="error"
          title="Account Disabled"
          message="Your account is disabled. Please contact support."
        />
      );
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    dispatch(loginSuccess(data.user));

    toast(
      <CustomToast
        type="success"
        title="Login Successful"
        message="Welcome back!"
      />
    );

    navigate("/crm/entrydashboard");
  };

  return (
    <div className="login-wrapper">
      <div className="login-glass-card">
        <h2 className="login-heading">Sign In</h2>
        <p className="login-subheading">Welcome back 👋</p>

        <form onSubmit={handleLogin} className="login-form">
          <label className="login-label-username">Username</label>
          <input
            className="login-input-username"
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <div className="login-password-header">
            <label className="login-label-password">Password</label>
            <span className="login-forgot-link login-disabled-link">Contact admin</span>
          </div>

          <div className="login-password-field">
            <input
              className="login-input-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="login-eye-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          <div className="login-remember-row">
            <input type="checkbox" id="login-remember" className="login-remember-checkbox" />
            <label htmlFor="login-remember" className="login-remember-label">
              Remember me
            </label>
          </div>

          <button className="login-submit-btn" type="submit">
            Sign In
          </button>
        </form>

        {/* <p className="login-signup-msg">
          Don’t have an account? <a href="#" className="login-signup-link">Sign Up</a>
        </p> */}

      </div>
    </div>
  );
};

export default Login;
