import React from 'react';
import './styles/LeadModal.css';
import { AiOutlineClose } from 'react-icons/ai';

const LeadModal = ({ lead, onClose }) => {
  if (!lead) return null;

return (
    <div className="lead-modal-overlay" onClick={onClose}>
        <div className="lead-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lead-modal-header">
                <h3>Lead Details</h3>
                <button className="close-btn" onClick={onClose}><AiOutlineClose /></button>
            </div>

            <div className="lead-modal-body">
                <div className="detail-box">
                    <span className="label">Name</span><span>{lead.name}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Email</span><span>{lead.email}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Phone</span><span>{lead.phone}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Company</span><span>{lead.company}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Contact</span><span>{lead.contact}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Location</span><span>{lead.location}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Category</span><span>{lead.category}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Quantity</span><span>{lead.quantity}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Requirements</span><span>{lead.requirements}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Remarks</span><span>{lead.remarks}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Data Type</span><span>{lead.datatype}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Call Status</span><span>{lead.callStatus}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Follow-Up Date</span>
                    <span>{lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Assigned To</span>
                    <span>
                        {lead.assignedTo && lead.assignedTo.length > 0
                            ? lead.assignedTo
                                    .map((a) => a.user && a.user.name ? a.user.name : 'Unassigned')
                                    .join(', ')
                            : 'Unassigned'}
                    </span>
                </div>

                <div className="detail-box">
                    <span className="label">Status</span><span>{lead.status}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Inquiry Date</span>
                    <span>{lead.inquiryDate ? new Date(lead.inquiryDate).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="detail-box">
                    <span className="label">Address</span><span>{lead.address}</span>
                </div>

                {/* Additional Contacts */}
                {lead.additionalContacts && lead.additionalContacts.length > 0 && (
                    <div className="detail-box">
                        <span className="label">Additional Contacts</span>
                        <div style={{ marginTop: '5px' }}>
                            {lead.additionalContacts.map((contact, idx) => (
                                <div key={idx} style={{ marginBottom: '10px', paddingLeft: '10px' }}>
                                    <div><span className="label">Name:</span> {contact.name}</div>
                                    <div><span className="label">Contact:</span> {contact.contact}</div>
                                    <div><span className="label">Details:</span> {contact.details}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="detail-box">
                    <span className="label">Updated</span>
                    <span>{new Date(lead.updatedAt).toLocaleDateString()}</span>
                </div>
            </div>

            <div className="lead-modal-footer">
                <button className="ok-btn" onClick={onClose}>OK</button>
            </div>
        </div>
    </div>
);
};

export default LeadModal;
