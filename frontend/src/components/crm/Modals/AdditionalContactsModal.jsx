import React from "react";
import { AiOutlineClose } from "react-icons/ai";
import { RiDeleteBin6Line } from "react-icons/ri"; 

const AdditionalContactsModal = ({
    isOpen,
    onClose,
    additionalContacts,
    handleContactChange,
    addNewContact,
    removeContact 
}) => {
    if (!isOpen) return null;

    const user = JSON.parse(localStorage.getItem('user'));

    return (
        <div className="glasso-acm-overlay" onClick={onClose}>
            <div className="glasso-acm-container" onClick={(e) => e.stopPropagation()}>
                <div className="glasso-acm-header">
                    <h3 className="glasso-acm-title">Additional Contacts</h3>
                    <button className="glasso-acm-close-btn" onClick={onClose}><AiOutlineClose /></button>
                </div>

                <div className="glasso-acm-body">
                    {additionalContacts.map((contact, index) => (
                        <div key={index} className="glasso-acm-contact-group">
                            <div className="glasso-acm-contact-header">
                                <span>Contact {index + 1}</span>
                                {user?.role === "admin" && (
                                    <button
                                        className="glasso-acm-delete-btn"
                                        onClick={() => removeContact(index)}
                                        title="Remove Contact"
                                    >
                                        <RiDeleteBin6Line />
                                    </button>
                                )}
                            </div>
                            <input
                                type="text"
                                placeholder="Name"
                                value={contact.name}
                                onChange={(e) => handleContactChange(index, "name", e.target.value)}
                                className="glasso-acm-input"
                            />
                            <input
                                type="text"
                                placeholder="Contact"
                                value={contact.contact}
                                onChange={(e) => handleContactChange(index, "contact", e.target.value)}
                                className="glasso-acm-input"
                            />
                            <input
                                type="text"
                                placeholder="Details"
                                value={contact.details}
                                onChange={(e) => handleContactChange(index, "details", e.target.value)}
                                className="glasso-acm-input"
                            />
                        </div>
                    ))}

                    <button type="button" className="glasso-acm-add-btn" onClick={addNewContact}>
                        + Add Contact
                    </button>
                </div>

                <div className="glasso-acm-footer">
                    <button className="glasso-acm-cancel-btn" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default AdditionalContactsModal;

const css = `
.glasso-acm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999;
}

.glasso-acm-container {
  width: 600px;
  max-height: 100%;
  overflow-y: auto;
  backdrop-filter: blur(15px);
  background: rgba(255,255,255,0.87);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  display: flex;
  flex-direction: column;
  scroll-behavior: smooth;
}

/* Scrollbar */
.glasso-acm-container::-webkit-scrollbar {
  width: 12px;
}
.glasso-acm-container::-webkit-scrollbar-track {
  background: rgba(200,200,200,0.2);
  border-radius: 10px;
}
.glasso-acm-container::-webkit-scrollbar-thumb {
  background: rgba(100,100,100,0.5);
  border-radius: 10px;
  border: 3px solid rgba(200,200,200,0.2);
}
.glasso-acm-container::-webkit-scrollbar-thumb:hover {
  background: rgba(80,80,80,0.7);
}

.glasso-acm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.glasso-acm-title {
  font-size: 1.5rem;
  color: #313131ff;
}

.glasso-acm-close-btn {
  font-size: 1.2rem;
  color: #3b3b3bff;
  background: none;
  border: none;
  cursor: pointer;
}

.glasso-acm-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.glasso-acm-contact-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-family: 'Outfit', sans-serif;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0,0,0,0.1);
}

.glasso-acm-contact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
   font-family: 'Outfit', sans-serif;
  font-weight: 600;
}

.glasso-acm-delete-btn {
  background: rgba(255,0,0,0.6);
  color: #fff;
  border: none;
  border-radius: 8px;
   font-family: 'Outfit', sans-serif;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
}
.glasso-acm-delete-btn:hover {
  background: rgba(200,0,0,0.8);
}

.glasso-acm-input {
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: none;
  outline: none;
  font-family: 'Outfit', sans-serif;
  background: rgba(255,255,255,0.84);
  color: #000;
}

.glasso-acm-add-btn {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: none;
  background: rgba(0,0,255,0.6);
  color: #fff;
  cursor: pointer;
   font-family: 'Outfit', sans-serif;
  align-self: flex-start;
}
.glasso-acm-add-btn:hover {
  background: rgba(0,0,180,0.8);
}

.glasso-acm-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.glasso-acm-cancel-btn {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: none;
   font-family: 'Outfit', sans-serif;
  background: rgba(255,0,0,0.6);
  color: #fff;
  cursor: pointer;
}
.glasso-acm-cancel-btn:hover {
  background: rgba(200,0,0,0.8);
}
`;

const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);
