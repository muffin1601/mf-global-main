import React, { useState } from 'react';
import { toast } from 'react-toastify';

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
      toast.success('Category added successfully!');
      if (onSubmit) onSubmit(result);
      setCategoryName('');
      onClose();
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error('Failed to add category. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="form-modal-overlay">
      <div className="form-modal-content">
        <div className="form-modal-header">
          <h3 className="form-modal-title">Add New Category</h3>
          <button className="btn-close-form" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Category Name *</label>
            <input
              type="text"
              name="name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="form-modal-input"
              required
            />
          </div>

          <div className="form-actions form-action-buttons">
            <button type="button" className="close-form-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-form-btn">
              Save Category
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCategoryModal;
