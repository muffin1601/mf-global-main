import React, { useState } from "react";
import axios from "axios";
import "./styles/ChangePasswordModal.css";
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
