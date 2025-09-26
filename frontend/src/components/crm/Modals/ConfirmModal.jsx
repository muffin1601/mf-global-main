import React from 'react';


const ConfirmModal = ({ message, onConfirm, onCancel }) => {
  return (
    <div className="glasso-confirm-overlay">
      <div className="glasso-confirm-container">
        <p className="glasso-confirm-message">{message}</p>
        <div className="glasso-confirm-buttons">
          <button className="glasso-confirm-btn delete" onClick={onConfirm}>Yes</button>
          <button className="glasso-confirm-btn cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;


const css = `
.glasso-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  border-radius: 20px;
  justify-content: center;
  align-items: center;
  z-index: 99999;
}

.glasso-confirm-container {
  width: 400px;
  max-width: 90%;
  background: rgba(255, 255, 255, 0.87);
  backdrop-filter: blur(15px);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.glasso-confirm-message {
  font-size: 1.2rem;
  color: #313131ff;
  text-align: center;
}

.glasso-confirm-buttons {
  display: flex;
  gap: 1rem;
}

.glasso-confirm-btn {
  padding: 0.5rem 1.5rem;
  border-radius: 20px;
  border: none;
  font-family: 'Outfit', sans-serif;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s, box-shadow 0.2s;
}

.glasso-confirm-btn.delete {
  background: rgba(255, 0, 0, 0.91);
   font-family: 'Outfit', sans-serif;
  color: #fff;
}

.glasso-confirm-btn.delete:hover {
  background: rgba(224, 7, 7, 0.9);
  box-shadow: 0 2px 8px rgba(255,0,0,0.15);
}

.glasso-confirm-btn.cancel {
  background: rgba(23,146,23,1);
   font-family: 'Outfit', sans-serif;
  color: #fff;
}

.glasso-confirm-btn.cancel:hover {
  background: rgba(18,120,18,0.95);
  box-shadow: 0 2px 8px rgba(23,146,23,0.15);
}
`;
 
const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);