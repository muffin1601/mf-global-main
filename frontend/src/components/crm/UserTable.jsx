import React, { useEffect, useState } from "react";
import axios from "axios";
import RegisterUserModal from "./Modals/RegisterUserModal";
import ChangePasswordModal from "./Modals/ChangePasswordModal";
import ActivityLogModal from "./Modals/ActivityLogModal";
import "../../styles/crm/UserTable.css";
import { toast } from "react-toastify";

const UserTable = () => {
    const [users, setUsers] = useState([]);
    const [selectedUserActivity, setSelectedUserActivity] = useState(false);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(null);

    const fetchUsers = async () => {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/users`);
        setUsers(res.data);
    };

    const toggleUser = async (id) => {
        await axios.patch(`${import.meta.env.VITE_API_URL}/admin/toggle-user/${id}/toggle`);
        fetchUsers();
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    return (
        <>
            <div className="user-table-mgmt-container-unique">
                <div className="user-table-title-head">
                <h2 className="user-table-title-unique">User Management</h2>

                <div className="user-table-actions-unique">
                    <button
                        className="user-table-register-btn-unique"
                        onClick={() => setShowRegisterModal(true)}
                    >
                        Register User
                    </button>
                    <button
                        className="user-table-track-btn-unique"
                        onClick={() => setSelectedUserActivity(true)}
                    >
                        Track Activity
                    </button>
                </div></div>

                <table className="user-table-table-unique">
                    <thead className="user-table-thead-unique">
                        <tr className="user-table-tr-head-unique">
                            <th className="user-table-th-unique">User ID</th>
                            <th className="user-table-th-unique">Email</th>
                            <th className="user-table-th-unique">Username</th>
                            <th className="user-table-th-unique">Role</th>
                            <th className="user-table-th-unique">Status</th>
                            <th className="user-table-th-unique">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="user-table-tbody-unique">
                        {users.map((u) => (
                            <tr className="user-table-tr-body-unique" key={u.userId}>
                                <td className="user-table-td-unique">{u.userId}</td>
                                <td className="user-table-td-unique">{u.email}</td>
                                <td className="user-table-td-unique">{u.username}</td>
                                <td className="user-table-td-unique">{u.role}</td>
                                <td className="user-table-td-unique">
                                    {u.enabled ? "Enabled" : "Disabled"}
                                </td>
                                <td className="user-table-td-actions-unique">
                                    <button
                                        className="user-table-toggle-btn-unique"
                                        onClick={() => toggleUser(u._id)}
                                    >
                                        {u.enabled ? "Disable" : "Enable"}
                                    </button>
                                    <button
                                        className="user-table-change-password-btn-unique"
                                        onClick={() => setShowChangePasswordModal(u.userId)}
                                    >
                                        Update Password
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {showRegisterModal && (
                    <RegisterUserModal
                        onClose={() => setShowRegisterModal(false)}
                        onSuccess={fetchUsers}
                    />
                )}

                {showChangePasswordModal && (
                    <ChangePasswordModal 
                        userId={showChangePasswordModal}
                        onClose={() => setShowChangePasswordModal(false)}
                        onSuccess={fetchUsers}
                    />
                )}

                {selectedUserActivity && (
                    <ActivityLogModal
                        userId={selectedUserActivity}
                        users={users}
                        onClose={() => setSelectedUserActivity(null)}
                    />
                )}
            </div>
        </>
    );
};

export default UserTable;
