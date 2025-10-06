import React, { useState } from 'react';
import { toast } from 'react-toastify';
import CustomToast from '../CustomToast';

const AddCategoryModal = ({ isOpen, onClose, onSubmit }) => {
  const [categoryName, setCategoryName] = useState('');

  const handleSubmit = async (e) => {
  e.preventDefault();

  const payload = { name: categoryName };

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/categories/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Failed to add category');
    }

    const result = await response.json();

    toast(
      <CustomToast
        type="success"
        title="Category Added"
        message={`Category "${categoryName}" added successfully!`}
      />
    );

    if (onSubmit) onSubmit(result);
    setCategoryName('');
    onClose();
  } catch (error) {
    console.error('Error adding category:', error);

    toast(
      <CustomToast
        type="error"
        title="Add Category Failed"
        message={error.message || 'Failed to add category. Please try again.'}
      />
    );
  }
};

  if (!isOpen) return null;

 return (
  <div className="fe-modal-overlay">
    <div className="fe-modal-container">
      <div className="fe-modal-header">
        <h3 className="fe-modal-title">Add New Category</h3>
        <button className="fe-modal-close" onClick={onClose}>×</button>
      </div>

      <div className="fe-modal-body">
        <div className="fe-input-group">
          <label>Category Name *</label>
          <input
            type="text"
            name="name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="fe-footer-buttons fe-action-buttons">
        <button type="button" className="fe-btn-close" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="fe-btn-submit" onClick={handleSubmit}>
          Save Category
        </button>
      </div>
    </div>
  </div>
);

};

export default AddCategoryModal;
