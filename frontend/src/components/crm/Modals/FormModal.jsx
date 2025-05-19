import React, { useState, useEffect } from 'react';
import './styles/FormModal.css';
import axios from "axios";
import { logActivity } from "../../../utils/logActivity"; 
import CsvUploadModal from './CsvUploadModal';
import { toast } from 'react-toastify';

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
      alert("Please resolve errors before submitting.");
      return;
    }

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/add-client`, formData);
      toast.success("Data Submitted!");

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
        phone: "",
        datatype: "",
        category: "",
        quantity: "",
        requirements: "",
        assignedTo: [],
      });
    } catch (error) {
      console.error("Error submitting data:", error);
      if (error.response && error.response.status === 400) {
        alert(`Submission failed: ${error.response.data.error}`);
      } else {
        alert("Submission failed. Please try again.");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="form-modal-overlay" onClick={onClose}>
      <div className="form-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="form-modal-header">
          <h2 className="form-modal-title">Add New Lead</h2>
          <button className="btn-close-form" onClick={onClose}>✖</button>
        </div>
        <form onSubmit={handleSubmit} className="form-grid">
          {[
            { label: "Name", name: "name" },
            { label: "Company", name: "company" },
            { label: "Email", name: "email", type: "email" },
            { label: "Location", name: "location" },
            { label: "Quantity", name: "quantity" },
          ].map(({ label, name, type = "text" }) => (
            <div className="form-group" key={name}>
              <label>{label}:</label>
              <input
                className="form-modal-input"
                type={type}
                name={name}
                value={formData[name]}
                onChange={handleChange}
                placeholder={label}
              />
            </div>
          ))}

          <div className="form-group">
            <label>Datatype:</label>
            <select name="datatype" value={formData.datatype} onChange={handleChange}>
              <option value="" disabled>Select Datatype</option>
              <option value="🌐 IndiaMart">🌐 IndiaMart</option>
              <option value="🏢 Offline">🏢 Offline</option>
              <option value="📊 TradeIndia">📊 TradeIndia</option>
              <option value="📞 JustDial">📞 JustDial</option>
              <option value="🖥️ WebPortals">🖥️ WebPortals</option>
              <option value="🔍 Other">🔍 Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Assigned To</label>
            <select
              value={formData.assignedTo?.[0]?.user?._id || ""}
              disabled={userRole !== "admin"}
              onChange={(e) => {
                const selectedUser = users.find(u => u._id === e.target.value);
                if (selectedUser) {
                  setField("assignedTo", [
                    {
                      user: {
                        _id: selectedUser._id,
                        name: selectedUser.name,
                      },
                      permissions: { view: true, update: false, delete: false },
                    },
                  ]);
                } else {
                  setField("assignedTo", []);
                }
              }}
            >
              <option value="">Select User</option>
              {users.map(user => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          {Object.entries(dropdownFields).map(([field, options]) => (
            <div className="form-group" key={field}>
              <label>{field.replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase())}</label>
              <select
                value={formData[field] || ""}
                onChange={(e) => setField(field, e.target.value)}
              >
                <option value="">Select {field}</option>
                {options.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <div className="form-group">
            <label>Category:</label>
            <select
              className="form-modal-input"
              name="category"
              value={formData.category}
              onChange={handleChange}
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option value={cat} key={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Contact:</label>
            <input
              className="form-modal-input"
              type="tel"
              name="contact"
              value={formData.contact}
              onChange={(e) => {
                handleChange(e);
                contactChange(e);
              }}
              placeholder="Landline"
              pattern="^[0-9]{10}$"
              title="Contact number must be exactly 10 digits"
            />
            {contactError && (
              <div className="error-message">
                {contactError}
                <button type="button" className="toggle-details-btn" onClick={() => setShowContactDetails(!showContactDetails)}>
                  {showContactDetails ? "Hide Details" : "Show Details"}
                </button>
              </div>
            )}
            {showContactDetails && existingContactUser && (
              <div className="duplicate-details">
                <p><strong>Name:</strong> {existingContactUser.name}</p>
                <p><strong>Company:</strong> {existingContactUser.company}</p>
                <p><strong>Email:</strong> {existingContactUser.email}</p>
                <p><strong>Location:</strong> {existingContactUser.location}</p>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Phone:</label>
            <input
              className="form-modal-input"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={(e) => {
                handleChange(e);
                phoneChange(e);
              }}
              placeholder="Enter 10-digit number"
              pattern="^[6-9][0-9]{9}$"
              title="Phone number must start with 6-9 and be 10 digits"
              required
            />
            {phoneError && (
              <div className="error-message">
                {phoneError}
                <button type="button" className="toggle-details-btn" onClick={() => setShowPhoneDetails(!showPhoneDetails)}>
                  {showPhoneDetails ? "Hide Details" : "Show Details"}
                </button>
              </div>
            )}
            {showPhoneDetails && existingPhoneUser && (
              <div className="duplicate-details">
                <p><strong>Name:</strong> {existingPhoneUser.name}</p>
                <p><strong>Company:</strong> {existingPhoneUser.company}</p>
                <p><strong>Email:</strong> {existingPhoneUser.email}</p>
                <p><strong>Location:</strong> {existingPhoneUser.location}</p>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Requirement:</label>
            <textarea
              className="form-modal-textarea"
              name="requirements"
              value={formData.requirements}
              onChange={handleChange}
              placeholder="Requirements"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="additional-action-btn" onClick={() => setShowCsvModal(true)}>
              Upload CSV
            </button>
            <div className="form-action-buttons">
              <button type="submit" className="submit-form-btn">Submit</button>
              <button type="button" className="close-form-btn" onClick={onClose}>Close</button>
            </div>
          </div>
        </form>

        {showCsvModal && (
          <CsvUploadModal onClose={() => setShowCsvModal(false)} />
        )}
      </div>
    </div>
  );
};

export default FormModal;
