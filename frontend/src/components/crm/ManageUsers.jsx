// import React, { useEffect, useState } from 'react';
// import axios from 'axios';
// import '../../styles/crm/ManageUsers.css';
// import Navbar from './Navbar';
// import GoBackButton from './GoBackButton';

// export default function AdminUserPage() {
//     const [users, setUsers] = useState([]);
//     const [form, setForm] = useState({ name: '', username: '', email: '', password: '', role: 'user' });

//     const fetchUsers = async () => {
//         const res = await axios.get(`${import.meta.env.VITE_API_URL}/users`);
//         setUsers(res.data);
//     };

//     const toggleUser = async (id) => {
//         await axios.patch(`${import.meta.env.VITE_API_URL}/admin/toggle-user/${id}/toggle`);
//         fetchUsers();
//     };

//     const registerUser = async (e) => {
//         e.preventDefault();
//         await axios.post(`${import.meta.env.VITE_API_URL}/admin/register-user`, form);
//         setForm({ name: '' ,username: '', email: '', password: '' , role: 'user' });
//         fetchUsers();
//     };

//     useEffect(() => {
//         fetchUsers();
//     }, []);

//     return (
//         <>
//             <Navbar />
//             <GoBackButton />
//             <div className="admin-page">
//                 <h2 className="admin-heading">Admin User Management</h2>

//                 <table className="admin-table">
//                     <thead className="admin-table-head">
//                         <tr className="admin-table-row">
//                             <th className="admin-table-header">User ID</th>
//                             <th className="admin-table-header">Email</th>
//                             <th className="admin-table-header">Username</th>
//                             <th className="admin-table-header">Role</th>
//                             <th className="admin-table-header">Status</th>
//                             <th className="admin-table-header">Actions</th>
//                         </tr>
//                     </thead>
//                     <tbody className="admin-table-body">
//                         {users.map(user => (
//                             <tr key={user.userId} className="admin-table-row">
//                                 <td className="admin-table-cell">{user.userId}</td>
//                                 <td className="admin-table-cell">{user.email}</td>
//                                 <td className="admin-table-cell">{user.username}</td>
//                                 <td className="admin-table-cell">{user.role}</td>
//                                 <td className="admin-table-cell">{user.enabled ? 'Enabled' : 'Disabled'}</td>
//                                 <td className="admin-table-cell">
//                                     <button onClick={() => toggleUser(user._id)} className="toggle-btn">
//                                         {user.enabled ? 'Disable' : 'Enable'}
//                                     </button>
//                                 </td>
//                             </tr>
//                         ))}
//                     </tbody>
//                 </table>

//                 <form onSubmit={registerUser} className="admin-form">
//                     <h3 className="admin-form-heading">Register New User</h3>
//                     <select
//                         value={form.role || 'user'}
//                         onChange={e => setForm({ ...form, role: e.target.value })}
//                         className="admin-form-select"
//                         required
//                     >
//                         <option value="user" className="admin-form-option">User</option>
//                         <option value="admin" className="admin-form-option">Admin</option>
//                     </select>
//                     <input
//                         type="text"
//                         placeholder="Name"
//                         value={form.name}
//                         onChange={e => setForm({ ...form, name: e.target.value })}
//                         className="admin-form-input"
//                         required
//                     />
//                     <input
//                         type="text"
//                         placeholder="Username"
//                         value={form.username}
//                         onChange={e => setForm({ ...form, username: e.target.value })}
//                         className="admin-form-input"
//                         required
//                     />
//                     <input
//                         type="email"
//                         placeholder="Email"
//                         value={form.email}
//                         onChange={e => setForm({ ...form, email: e.target.value })}
//                         className="admin-form-input"
//                         required
//                     />
//                     <input
//                         type="text"
//                         placeholder="Password"
//                         value={form.password}
//                         onChange={e => setForm({ ...form, password: e.target.value })}
//                         className="admin-form-input"
//                         required
//                     />
//                     <button type="submit" className="submit-btn">Register</button>
//                     <button type="submit" onClick={() => (window.location.href = "/crm/forgot-password")} className="change-pass-btn">Change Password</button>
//                 </form>
//             </div>
//         </>
//     );
// }
