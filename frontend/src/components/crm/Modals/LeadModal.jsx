import React from 'react';
import { AiOutlineClose } from 'react-icons/ai';

const LeadModal = ({ lead, onClose }) => {
  if (!lead) return null;

  const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : 'N/A');

  // Only display these fields
  const displayFields = [
    'name',
    'email',
    'phone',
    'company',
    'contact',
    'location',
    'category',
    'quantity',
    'requirements',
    'remarks',
    'datatype',
    'callStatus',
    'address',
  ];

  return (
    <div className="glasso-lead-overlay" onClick={onClose}>
      <div className="glasso-lead-container" onClick={(e) => e.stopPropagation()}>
        <div className="glasso-lead-header">
          <h3 className="glasso-lead-title">Lead Details</h3>
          <button className="glasso-lead-close-btn" onClick={onClose}><AiOutlineClose /></button>
        </div>

        <div className="glasso-lead-body">
          {displayFields.map((key) => (
            <div className="glasso-lead-detail-group" key={key}>
              <span className="glasso-lead-label">
                {key.replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              <span className="glasso-lead-value">{lead[key] || 'N/A'}</span>
            </div>
          ))}

          {/* Additional Contacts */}
          {lead.additionalContacts && lead.additionalContacts.length > 0 && (
            <div className="glasso-lead-detail-group">
              <span className="glasso-lead-label">Additional Contacts</span>
              <div className="glasso-lead-contacts">
                {lead.additionalContacts.map((c, idx) => (
                  <div key={idx} className="glasso-lead-contact">
                    <div><span className="glasso-lead-label">Name:</span> {c.name}</div>
                    <div><span className="glasso-lead-label">Contact:</span> {c.contact}</div>
                    <div><span className="glasso-lead-label">Details:</span> {c.details}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assigned To */}
          <div className="glasso-lead-detail-group">
            <span className="glasso-lead-label">Assigned To</span>
            <span className="glasso-lead-value">
              {lead.assignedTo && lead.assignedTo.length > 0
                ? lead.assignedTo.map(a => a.user?.name || 'Unassigned').join(', ')
                : 'Unassigned'}
            </span>
          </div>

          {/* Follow-Up, Inquiry, Updated Dates */}
          <div className="glasso-lead-detail-group">
            <span className="glasso-lead-label">Follow-Up Date</span>
            <span className="glasso-lead-value">{formatDate(lead.followUpDate)}</span>
          </div>
          <div className="glasso-lead-detail-group">
            <span className="glasso-lead-label">Inquiry Date</span>
            <span className="glasso-lead-value">{formatDate(lead.inquiryDate)}</span>
          </div>
          <div className="glasso-lead-detail-group">
            <span className="glasso-lead-label">Updated</span>
            <span className="glasso-lead-value">{formatDate(lead.updatedAt)}</span>
          </div>
        </div>

        <div className="glasso-lead-footer">
          <button className="glasso-lead-ok-btn" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
};

export default LeadModal;


const css = `
.glasso-lead-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  border-radius: 20px;
  justify-content: center;
  align-items: center;
  z-index: 99999;
}

.glasso-lead-container {
  width: 700px;
  max-height: 90%;
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
.glasso-lead-container::-webkit-scrollbar {
  width: 12px;
}
.glasso-lead-container::-webkit-scrollbar-track {
  background: rgba(200,200,200,0.2);
  border-radius: 10px;
}
.glasso-lead-container::-webkit-scrollbar-thumb {
  background: rgba(100,100,100,0.5);
  border-radius: 10px;
  border: 3px solid rgba(200,200,200,0.2);
}
.glasso-lead-container::-webkit-scrollbar-thumb:hover {
  background: rgba(80,80,80,0.7);
}

.glasso-lead-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.glasso-lead-title {
  font-size: 1.5rem;
  color: #313131ff;
}

.glasso-lead-close-btn {
  font-size: 1.2rem;
  color: #3b3b3bff;
  background: none;
  border: none;
  cursor: pointer;
}

.glasso-lead-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 0.5rem;
  margin-top: 1rem;
}

.glasso-lead-detail-group {
  display: flex;
  flex-direction: column;
}

.glasso-lead-label {
  color: #292929ff;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.glasso-lead-value {
  background: rgba(255,255,255,0.84);
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  color: #000;
  font-family: 'Outfit', sans-serif;
}

.glasso-lead-contacts {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: 5px;
}

.glasso-lead-contact div {
  margin-bottom: 2px;
}

.glasso-lead-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.glasso-lead-ok-btn {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: none;
  background: rgba(23,146,23,1);
  color: #fff;
  font-family: 'Outfit', sans-serif;
  cursor: pointer;
  white-space: nowrap;
}

.glasso-lead-ok-btn:hover {
  background: rgba(18,120,18,0.95);
  box-shadow: 0 2px 8px rgba(23,146,23,0.15);
  transition: background 0.2s, box-shadow 0.2s;
}
`;

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);
