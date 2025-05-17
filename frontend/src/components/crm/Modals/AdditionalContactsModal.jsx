
import React from "react";
import { AiOutlineClose } from "react-icons/ai";
import { RiDeleteBin6Line } from "react-icons/ri"; // optional: delete icon
import "./styles/AdditionalContactsModal.css";

const AdditionalContactsModal = ({
    isOpen,
    onClose,
    additionalContacts,
    handleContactChange,
    addNewContact,
    removeContact // ✅ expects function from parent
}) => {
    if (!isOpen) return null;

    return (
        <div className="acm-overlay" onClick={onClose}>
            <div className="acm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="acm-header">
                    <h3>Additional Contacts</h3>
                    <button className="acm-close-btn" onClick={onClose}><AiOutlineClose /></button>
                </div>
                <div className="acm-body">
                    {additionalContacts.map((contact, index) => (
                        <div key={index} className="acm-contact-group">
                            <div className="acm-contact-header">
                                <span>Contact {index + 1}</span>
                                <button
                                    className="acm-delete-contact-btn"
                                    onClick={() => removeContact(index)}
                                    title="Remove Contact"
                                >
                                    <RiDeleteBin6Line />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Name"
                                value={contact.name}
                                onChange={(e) => handleContactChange(index, "name", e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Contact"
                                value={contact.contact}
                                onChange={(e) => handleContactChange(index, "contact", e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Details"
                                value={contact.details}
                                onChange={(e) => handleContactChange(index, "details", e.target.value)}
                            />
                        </div>
                    ))}
                    <button type="button" className="acm-add-contact-btn" onClick={addNewContact}>
                        + Add Contact
                    </button>
                </div>

                <div className="acm-footer">
                    <button className="acm-cancel-btn" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default AdditionalContactsModal;
