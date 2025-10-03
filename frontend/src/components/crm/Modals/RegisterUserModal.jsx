import React, { useState } from "react";
import axios from "axios";

const RegisterUserModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        role: "",
        name: "",
        username: "",
        email: "",
        password: "",
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) =>
        setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/admin/register-user`, formData);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || "Registration failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-modal-overlay">
            <div className="register-modal-content">
                <h3 className="register-modal-title">Register New User</h3>

                <form className="register-modal-form" onSubmit={handleSubmit}>
                    <select
                        className="register-modal-select"
                        name="role"
                        required
                        value={formData.role}
                        onChange={handleChange}
                    >
                        <option value="">Select Role</option>
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                    </select>

                    <input
                        className="register-modal-input"
                        type="text"
                        name="name"
                        placeholder="Full Name"
                        value={formData.name}
                        required
                        onChange={handleChange}
                    />
                    <input
                        className="register-modal-input"
                        type="text"
                        name="username"
                        placeholder="Username"
                        value={formData.username}
                        required
                        onChange={handleChange}
                    />
                    <input
                        className="register-modal-input"
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={formData.email}
                        required
                        onChange={handleChange}
                    />
                    <input
                        className="register-modal-input"
                        type="password"
                        name="password"
                        placeholder="Password"
                        value={formData.password}
                        required
                        onChange={handleChange}
                    />

                    {error && <div className="register-modal-error">{error}</div>}

                    <div className="register-modal-buttons">
                        <button
                            className="register-modal-submit"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Registering..." : "Register"}
                        </button>
                        <button
                            className="register-modal-cancel"
                            type="button"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RegisterUserModal;


const css = `
.register-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
}

.register-modal-content {
    width: 420px;
    max-width: 95vw;
    background: rgba(255,255,255,0.77);
    border-radius: 20px;
    backdrop-filter: blur(15px);
    padding: 2rem 2rem 1.5rem 2rem;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    overflow-y: auto;
    scroll-behavior: smooth;
    scrollbar-width: thin;
    scrollbar-color: rgba(100,100,100,0.5) rgba(200,200,200,0.2);
}

.register-modal-content::-webkit-scrollbar {
    width: 12px;
}
.register-modal-content::-webkit-scrollbar-track {
    background: rgba(200,200,200,0.2);
    border-radius: 10px;
}
.register-modal-content::-webkit-scrollbar-thumb {
    background-color: rgba(100,100,100,0.5);
    border-radius: 10px;
    border: 3px solid rgba(200,200,200,0.2);
    transition: background-color 0.3s ease, transform 0.3s ease;
}
.register-modal-content::-webkit-scrollbar-thumb:hover {
    background-color: rgba(80,80,80,0.7);
    transform: scaleX(1.2);
}

.register-modal-title {
    font-size: 1.75rem;
    color: #222;
    margin-bottom: 1.2rem;
    text-align: center;
    font-weight: 600;
}

.register-modal-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.register-modal-select,
.register-modal-input {
    padding: 0.6rem 0.8rem;
    border-radius: 10px;
    border: none;
    outline: none;
    font-family: 'Outfit', sans-serif;
    background: rgba(255,255,255,0.85);
    color: #000;
    font-size: 1rem;
    transition: 0.3s all;
}

.register-modal-select:focus,
.register-modal-input:focus {
    box-shadow: 0 0 8px rgba(0,0,0,0.2);
}

.register-modal-error {
    background: rgba(255, 0, 0, 0.1);
    border-left: 4px solid #d32f2f;
    padding: 0.4rem 0.6rem;
    border-radius: 8px;
    font-size: 0.95rem;
    color: #b00020;
    margin-top: 0.2rem;
}

.register-modal-buttons {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.3rem;
    gap: 1rem;
}

.register-modal-submit,
.register-modal-cancel {
    padding: 0.6rem 1.2rem;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    font-family: 'Outfit', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    transition: background 0.2s, box-shadow 0.2s;
}

.register-modal-submit {
    background: #169216;
    color: #fff;
}
.register-modal-submit:disabled {
    background: #b3c6ff;
    color: #888;
    cursor: not-allowed;
}
.register-modal-submit:not(:disabled):hover {
    background: #0f720f;
}

.register-modal-cancel {
    background: #d32f2f;
    color: #fff;
}
.register-modal-cancel:hover {
    background: #b71c1c;
}
`
const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);