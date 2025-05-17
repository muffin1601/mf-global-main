import React, { useState, useEffect } from 'react';
import './styles/FormModal.css';
import axios from "axios";
import { logActivity } from "../../../utils/logActivity"; 
import CsvUploadModal from './CsvUploadModal';

const FormModal = ({ isOpen, onClose }) => {
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
    });
  
  const [categories, setCategories] = useState([]);
  // const [Datatype, setDatatype] = useState([]);
  const [phoneError, setPhoneError] = useState('');
  const [existingPhoneUser, setExistingPhoneUser] = useState(null);
  const [contactError, setContactError] = useState('');
  const [existingContactUser, setExistingContactUser] = useState(null);
  const [showPhoneDetails, setShowPhoneDetails] = useState(false);
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/clients/meta`).then((res) => {
      setCategories(res.data.categories);
    });
  }, []);


  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const phoneChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, phone: value });

    if (value.match(/^[6-9][0-9]{9}$/)) {
      axios
        .get(`${import.meta.env.VITE_API_URL}/check-duplicate-phone`, {
          params: { phone: value },
        })
        .then((res) => {
          if (res.data.exists) {
            setPhoneError('This phone number already exists.');
            setExistingPhoneUser(res.data.user);
          }
        })
        .catch((error) => {
          console.error("Error checking phone duplicacy:", error);
        });
    }
  }

  const contactChange = (e) => {
    const rawValue = e.target.value;

    // Remove leading/trailing spaces and collapse internal spaces
    const sanitizedValue = rawValue.trim().replace(/\s+/g, '');

    setFormData({ ...formData, contact: sanitizedValue });

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
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/add-client`, formData);
      alert("Data Submitted!");

      // ✅ Log activity
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
        <div className='form-modal-header'>
          <h2 className='form-modal-title'>Add New Lead</h2>
          <button className="btn-close-form" onClick={onClose}>✖</button>
        </div>
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-group">
            <label>Name:</label>
            <input
              className="form-modal-input"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Name"
            />
          </div>

          <div className="form-group">
            <label>Company:</label>
            <input
              className="form-modal-input"
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              placeholder="Company"
            />
          </div>

          <div className="form-group">
            <label>Email:</label>
            <input
              className="form-modal-input"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email"
            />
          </div>

          <div className="form-group">
            <label>Datatype:</label>
            <select
              name="datatype"
              value={formData.datatype}
              onChange={handleChange}
            >
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
                <button
                  type="button"
                  className="toggle-details-btn"
                  onClick={() => setShowContactDetails(!showContactDetails)}
                >
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
                <button
                  type="button"
                  className="toggle-details-btn"
                  onClick={() => setShowPhoneDetails(!showPhoneDetails)}
                >
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
            <label>Location:</label>
            <input
              className="form-modal-input"
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="Location"
            />
          </div>

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
                <option value={cat} key={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Quantity:</label>
            <input
              className="form-modal-input"
              type="text"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              placeholder="Quantity"
            />
          </div>

          <div className="form-group">
            <label>Requirement:</label>
            <textarea
              className="form-modal-textarea"
              name="requirements"
              value={formData.requirements}
              onChange={handleChange}
              placeholder="Requirements"
            ></textarea>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="additional-action-btn"
              onClick={() => setShowCsvModal(true)} // Keep the modal open without closing the form modal
            >
              Upload CSV
            </button>
          <div className='form-action-buttons'>
            <button type="submit" className='submit-form-btn'>Submit</button>
            <button type="button" className='close-form-btn'onClick={onClose}>Close</button>
          </div>
          </div>
        </form>
        {showCsvModal && (
          <CsvUploadModal
            onClose={() => setShowCsvModal(false)} // Pass the function to close the modal
          />
        )}
      </div>
    </div>
  );
};

export default FormModal;
