import React, { useState } from "react";
import axios from "axios";

import { toast } from "react-toastify";

const ChangePasswordModal = ({ userId, onClose, onSuccess }) => {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

     const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await axios.put(
                `${import.meta.env.VITE_API_URL}/admin/change-password/${userId}`,
                { password }
            );

            toast.success("Password changed successfully!"); // ✅ show success toast

            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to change password.");
            toast.error(err.response?.data?.message || "Failed to change password."); // ✅ optional error toast
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="change-password-modal-overlay">
            <div className="change-password-modal-content">
                <h3 className="change-password-modal-title">Update Password</h3>
                <form className="change-password-modal-form" onSubmit={handleSubmit}>
                    <input
                        className="change-password-modal-input"
                        type="password"
                        placeholder="New Password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    {error && <div className="change-password-modal-error-text">{error}</div>}

                    <div className="change-password-modal-buttons">
                        <button className="change-password-modal-submit" type="submit" disabled={loading}>
                            {loading ? "Updating..." : "Update"}
                        </button>
                        <button className="change-password-modal-cancel" type="button" onClick={onClose}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;

const css = `
.change-password-modal-overlay {
  position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    justify-content: center;
     border-radius:20px;
    align-items: center;
    z-index: 9999;
}

.change-password-modal-content {
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

.change-password-modal-title {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 600;
    color: #222;
    margin-bottom: 20px;
    text-align: center;
}

.change-password-modal-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.change-password-modal-input {
    padding: 0.7rem 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
    font-family: 'Outfit', sans-serif;
    outline: none;
    transition: border-color 0.2s;
}

.change-password-modal-input:focus {
    border-color: #007bff;
}

.change-password-modal-error-text {
    color: #e53935;
    font-size: 0.95rem;
    text-align: center;
    margin-bottom: 0.5rem;
}

.change-password-modal-buttons {
    display: flex;
    gap: 0.8rem;
    font-family: 'Outfit', sans-serif;
    justify-content: space-between;
}

.change-password-modal-submit,
.change-password-modal-cancel {
    padding: 0.6rem 1.4rem;
    border-radius: 8px;
    font-size: 1rem;
    font-family: 'Outfit', sans-serif;
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s, color 0.2s;
}

.change-password-modal-submit {
    background: #007bff;
    color: #fff;
}

.change-password-modal-submit:disabled {
    background: #b0c4de;
    cursor: not-allowed;
}

.change-password-modal-cancel {
    background: #f5f5f5;
    color: #333;
}

.change-password-modal-cancel:hover {
    background: #e0e0e0;
}
`
const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);