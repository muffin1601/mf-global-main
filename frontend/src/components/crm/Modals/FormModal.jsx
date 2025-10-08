import React, { useState, useEffect } from 'react';
import axios from "axios";
import { logActivity } from "../../../utils/logActivity"; 
import CsvUploadModal from './CsvUploadModal';
import { toast } from 'react-toastify';
import CustomToast from '../CustomToast';

const FormModal = ({
  isOpen,
  onClose,
  editedLead = {},
  userRole = 'admin',
  dropdownFields = {}
}) => {
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    contact: "",
    location: "",
    state: "",
    phone: "",
    datatype: "",
    category: "",
    quantity: "",
    requirements: "",
    assignedTo: [],
  });

  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [phoneError, setPhoneError] = useState('');
  const [existingPhoneUser, setExistingPhoneUser] = useState(null);
  const [contactError, setContactError] = useState('');
  const [existingContactUser, setExistingContactUser] = useState(null);
  const [showPhoneDetails, setShowPhoneDetails] = useState(false);
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);

  useEffect(() => {
    fetchUsers();
    axios.get(`${import.meta.env.VITE_API_URL}/clients/meta`).then((res) => {
      setCategories(res.data.categories);
    });
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/users`);
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const setField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const phoneChange = (e) => {
    const value = e.target.value;
    setField("phone", value);

    if (!value.match(/^[6-9][0-9]{9}$/)) {
      setPhoneError('');
      return;
    }

    axios
      .get(`${import.meta.env.VITE_API_URL}/check-duplicate-phone`, {
        params: { phone: value },
      })
      .then((res) => {
        if (res.data.exists) {
          setPhoneError('This phone number already exists.');
          setExistingPhoneUser(res.data.user);
        } else {
          setPhoneError('');
          setExistingPhoneUser(null);
        }
      })
      .catch((error) => {
        console.error("Error checking phone duplicacy:", error);
      });
  };

  const contactChange = (e) => {
    const rawValue = e.target.value;
    const sanitizedValue = rawValue.trim().replace(/\s+/g, '');

    setField("contact", sanitizedValue);

    if (!sanitizedValue) {
      setContactError('');
      return;
    }

    axios
      .get(`${import.meta.env.VITE_API_URL}/check-duplicate-contact`, {
        params: { contact: sanitizedValue },
      })
      .then((res) => {
        if (res.data.exists) {
          setContactError('This contact number already exists.');
          setExistingContactUser(res.data.user);
        } else {
          setContactError('');
          setExistingContactUser(null);
        }
      })
      .catch((error) => {
        console.error("Error checking contact duplicacy:", error);
      });
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (phoneError || contactError) {
    return toast(
      <CustomToast
        type="error"
        title="Validation Error"
        message="Please resolve errors before submitting."
      />
    );
  }

  try {
    await axios.post(`${import.meta.env.VITE_API_URL}/add-client`, formData);

    toast(
      <CustomToast
        type="success"
        title="Success"
        message="Data Submitted!"
      />
    );

    await logActivity("Submitted Data Entry", {
      name: formData.name,
      company: formData.company,
      phone: formData.phone,
      email: formData.email,
    });

    setFormData({
      name: "",
      company: "",
      email: "",
      contact: "",
      location: "",
      state: "",
      phone: "",
      datatype: "",
      category: "",
      quantity: "",
      requirements: "",
      assignedTo: [],
    });
  } catch (error) {
    console.error("Error submitting data:", error);
    toast(
      <CustomToast
        type="error"
        title="Submission Failed"
        message={
          error.response?.data?.error || "Submission failed. Please try again."
        }
      />
    );
  }
};

  if (!isOpen) return null;

  return (
    <div className="fe-modal-overlay" onClick={onClose}>
      <div className="fe-modal-container" onClick={e => e.stopPropagation()}>
        <div className="fe-modal-header">
          <h2 className="fe-modal-title">Add New Lead</h2>
          <button className="fe-modal-close" onClick={onClose}>✖</button>
        </div>

        <form className="fe-modal-body" >
          {[
            { label: "Name", name: "name" },
            { label: "Company", name: "company" },
            { label: "Email", name: "email", type: "email" },
            { label: "Location", name: "location" },
            { label: "State", name: "state" },
            { label: "Quantity", name: "quantity" },
          ].map(({ label, name, type = "text" }) => (
            <div className="fe-input-group" key={name}>
              <label>{label}</label>
              <input type={type} name={name} value={formData[name]} onChange={handleChange} />
            </div>
          ))}

          <div className="fe-input-group">
            <label>Datatype</label>
            <select name="datatype" value={formData.datatype} onChange={handleChange}>
              <option value="" disabled>Select Datatype</option>
              {["🌐 IndiaMart","🏢 Offline","📊 TradeIndia","📞 JustDial","🖥️ WebPortals","🔍 Other"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="fe-input-group">
            <label>Assigned To</label>
            <select value={formData.assignedTo?.[0]?.user?._id || ""} disabled={userRole !== "admin"} onChange={(e) => {
              const selectedUser = users.find(u => u._id === e.target.value);
              setField("assignedTo", selectedUser ? [{ user: { _id: selectedUser._id, name: selectedUser.name }, permissions: { view: true, update: false, delete: false } }] : []);
            }}>
              <option value="">Select User</option>
              {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>

          {Object.entries(dropdownFields).map(([field, options]) => (
            <div className="fe-input-group" key={field}>
              <label>{field.replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase())}</label>
              <select value={formData[field] || ""} onChange={e => setField(field, e.target.value)}>
                <option value="">Select {field}</option>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          ))}

          <div className="fe-input-group">
            <label>Category</label>
            <select name="category" value={formData.category} onChange={handleChange}>
              <option value="">Select Category</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div className="fe-input-group">
            <label>Contact</label>
            <input type="tel" name="contact" value={formData.contact} onChange={(e) => { handleChange(e); contactChange(e); }} pattern="^[0-9]{10}$" title="10-digit number" />
            {contactError && (
              <>
                <div className="fe-error">{contactError} <button type="button" className="fe-toggle-btn" onClick={() => setShowContactDetails(!showContactDetails)}>{showContactDetails ? "Hide" : "Show"} Details</button></div>
                {showContactDetails && existingContactUser && (
                  <div className="fe-duplicate-details">
                    <p><strong>Name:</strong> {existingContactUser.name}</p>
                    <p><strong>Company:</strong> {existingContactUser.company}</p>
                    <p><strong>Email:</strong> {existingContactUser.email}</p>
                    <p><strong>Location:</strong> {existingContactUser.location}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="fe-input-group">
            <label>Phone</label>
            <input type="tel" name="phone" value={formData.phone} onChange={(e) => { handleChange(e); phoneChange(e); }} pattern="^[6-9][0-9]{9}$" title="10-digit starting with 6-9" required />
            {phoneError && (
              <>
                <div className="fe-error">{phoneError} <button type="button" className="fe-toggle-btn" onClick={() => setShowPhoneDetails(!showPhoneDetails)}>{showPhoneDetails ? "Hide" : "Show"} Details</button></div>
                {showPhoneDetails && existingPhoneUser && (
                  <div className="fe-duplicate-details">
                    <p><strong>Name:</strong> {existingPhoneUser.name}</p>
                    <p><strong>Company:</strong> {existingPhoneUser.company}</p>
                    <p><strong>Email:</strong> {existingPhoneUser.email}</p>
                    <p><strong>Location:</strong> {existingPhoneUser.location}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="fe-input-group">
            <label>Requirements</label>
            <textarea name="requirements" value={formData.requirements} onChange={handleChange} />
          </div>

          
        </form><div className="fe-footer-buttons">
            <button type="button" className="fe-btn-upload" onClick={() => setShowCsvModal(true)}>Upload CSV</button>
            <div className="fe-action-buttons">
              <button type="submit" className="fe-btn-submit" onClick={handleSubmit}>Submit</button>
              <button type="button" className="fe-btn-close" onClick={onClose}>Close</button>
            </div>
          </div>

        {showCsvModal && <CsvUploadModal onClose={() => setShowCsvModal(false)} />}
      </div>
    </div>
  );
};

export default FormModal;

const css = `
.fe-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  border-radius:20px;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.fe-modal-container {
  width: 720px;
  max-height: 90%;
  background: rgba(255,255,255,0.9);
  border-radius: 20px;
  backdrop-filter: blur(15px);
  padding: 2rem;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  scroll-behavior: smooth;
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: rgba(100,100,100,0.5) rgba(200,200,200,0.2);
}

/* Webkit Scrollbar */
.fe-modal-container::-webkit-scrollbar {
  width: 12px;
}

.fe-modal-container::-webkit-scrollbar-track {
  background: rgba(200,200,200,0.2);
  border-radius: 10px;
}

.fe-modal-container::-webkit-scrollbar-thumb {
  background-color: rgba(100,100,100,0.5);
  border-radius: 10px;
  border: 3px solid rgba(200,200,200,0.2);
  transition: background-color 0.3s ease, transform 0.3s ease;
}

.fe-modal-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(80,80,80,0.7);
  transform: scaleX(1.2);
}

.fe-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.fe-modal-title {
  font-size: 1.75rem;
  color: #222;
}

.fe-modal-close {
  font-size: 1.3rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #333;
}

.fe-modal-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.fe-input-group {
  display: flex;
  flex-direction: column;
}

.fe-input-group label {
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #333;
}

.fe-input-group input,
.fe-input-group select,
.fe-input-group textarea {
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  border: none;
  outline: none;
  font-family: 'Outfit', sans-serif;
  background: rgba(255,255,255,0.85);
  color: #000;
  transition: 0.3s all;
}

.fe-input-group input:focus,
.fe-input-group select:focus,
.fe-input-group textarea:focus {
  box-shadow: 0 0 8px rgba(0,0,0,0.2);
}

/* Error message container with toggle button */
.fe-error {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 0, 0, 0.1); /* subtle red background */
  border-left: 4px solid #d32f2f; /* prominent red left border */
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #b00020;
  margin-top: 0.3rem;
}

/* Toggle button to show/hide duplicate details */
.fe-toggle-btn {
  background: transparent;
  border: none;
  color: #1976d2;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.8rem;
  transition: color 0.2s ease;
}

.fe-toggle-btn:hover {
  color: #0d47a1;
}

/* Duplicate contact/phone details box */
.fe-duplicate-details {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  padding: 0.75rem 1rem;
  border-radius: 10px;
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #111;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

/* Inside details paragraph */
.fe-duplicate-details p {
  margin: 0.2rem 0;
}

/* Strong labels inside details */
.fe-duplicate-details p strong {
  color: #333;
}


.fe-footer-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.fe-btn-upload,
.fe-btn-submit,
.fe-btn-close {
  padding: 0.6rem 1.2rem;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-family: 'Outfit', sans-serif;
  transition: all 0.2s;
}

.fe-btn-upload { background: #007bff; color: #fff; }
.fe-btn-submit { background: #169216; color: #fff; }
.fe-btn-close { background: #d32f2f; color: #fff; }

.fe-btn-upload:hover { background: #0056b3; }
.fe-btn-submit:hover { background: #0f720f; }
.fe-btn-close:hover { background: #b71c1c; }
.fe-action-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
  margin-top: 0.5rem;
}
`;

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);