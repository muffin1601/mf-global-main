import React from "react";
import "../../styles/crm/ToastStyles.css";

const icons = {
  success: "✔",
  error: "✖",
  warning: "⚠",
  info: "❓",
};

export default function CustomToast({ type, title, message }) {
  return (
    <div className={`custom-toast toast-${type}`}>
      <div className="toast-icon">{icons[type]}</div>
      <div>
        <div className="toast-title">{title}</div>
        <div className="toast-message">{message}</div>
      </div>
    </div>
  );
}
