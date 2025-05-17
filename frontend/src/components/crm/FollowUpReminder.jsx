// import React, { useEffect, useState } from "react";
// import axios from "axios";
// import "../../styles/crm/FollowUpReminder.css"; // Adjust the path as needed
// import Navbar from "./Navbar";
// import GoBackButton from "./GoBackButton";

// const FollowUpReminder = () => {
//   const [followUpClients, setFollowUpClients] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [statusInputs, setStatusInputs] = useState({});

//   const loggedInUser = JSON.parse(localStorage.getItem("user"));
//   if (!loggedInUser?._id) {
//       return <p>Error: User ID is required!</p>;
//   }
//   const userId = loggedInUser._id;
//   const userName = loggedInUser.name;

//   const handleStatusChange = (e, clientId) => {
//     setStatusInputs(prev => ({
//       ...prev,
//       [clientId]: e.target.value
//     }));
//   };
  
//   const handleSetAllStatus = async () => {
//     const token = localStorage.getItem("token");

//     if (!token) {
//       alert("You must be logged in.");
//       return;
//     }

//     try {
//       // Prepare the status updates for all clients
//       const updatedStatuses = followUpClients.map(client => ({
//         clientId: client._id,
//         status: statusInputs[client._id] || client.status, // Use new status if provided
//       }));

//       // Update the statuses in the backend
//       await Promise.all(
//         updatedStatuses.map(async (update) => {
//           try {
//             await axios.put(
//               `${import.meta.env.VITE_API_URL}/followup/update-status/${update.clientId}`,
//               { status: update.status },
//               {
//                 headers: {
//                   Authorization: `Bearer ${token}`,
//                 },
//               }
//             );
//           } catch (error) {
//             console.error(`Failed to update client ${update.clientId}:`, error);
//           }
//         })
//       );

//       // After successfully updating, re-fetch the updated clients data
//       fetchFollowUpClients();

//       alert("Statuses updated successfully.");
//     } catch (error) {
//       console.error("Error updating statuses:", error);
//       alert("An error occurred while updating statuses.");
//     }
//   };

//   const fetchFollowUpClients = async () => {
//     const token = localStorage.getItem("token");

//     if (!token) {
//       alert("You must be logged in.");
//       return;
//     }

//     try {
//       const res = await axios.get(
//         `${import.meta.env.VITE_API_URL}/followup/reminder/${userId}`,
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );
//       setFollowUpClients(res.data); // Update state with the re-fetched data
//     } catch (error) {
//       console.error("Error fetching follow-up clients:", error);
//       alert("Failed to fetch follow-up clients.");
//     }
//   };

//   useEffect(() => {
//     fetchFollowUpClients(); // Fetch data when the component mounts
//   }, []); // Empty array to fetch only once when component is mounted
 
   
//   return (
//     <>
//       <Navbar />
//       <GoBackButton /> {/* Go back button */}
//       <div className="followup-reminder-container">
//         <h2>Follow-Up Reminders</h2>
//         {loading && <p>Loading...</p>}
      
//         {followUpClients.length > 0 ? (
//           <div>
//             <h3>You need to follow up with {followUpClients.length} clients today:</h3>
//             <button onClick={handleSetAllStatus} className="status-btn">
//               Set Status
//             </button>
//             <table>
//               <thead>
//                 <tr>
//                   <th>Name</th>
//                   <th>Company</th>
//                   <th>Phone</th>
//                   <th>Email</th>
//                   <th>Follow-up Date</th>
//                   <th>Remarks</th>
//                   <th>Requirement</th>
//                   <th>Status</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {followUpClients.map((client, index) => (
//                   <tr key={index}>
//                     <td>{client.name}</td>
//                     <td>{client.companyName}</td>
//                     <td>{client.phone}</td>
//                     <td>{client.email}</td>
//                     <td>{new Date(client.followUpDate).toLocaleDateString()}</td>
//                     <td>{client.remarks}</td>
//                     <td>{client.requirement}</td>
//                     <td>
//                       <input
//                         className="input"
//                         type="text"
//                         value={statusInputs[client._id] ?? client.status ?? ""}
//                         onChange={(e) => handleStatusChange(e, client._id)}
//                       />
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         ) : (
//           !loading && <p>No clients to follow up with today.</p>
//         )}
//       </div>
//     </>
//   );
// };

// export default FollowUpReminder;
