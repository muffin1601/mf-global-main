import React, { useState } from "react";
import axios from "axios";
import "./styles/RegisterModal.css";

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
