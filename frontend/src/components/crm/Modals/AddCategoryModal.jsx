import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import CustomToast from '../CustomToast';

const AddCategoryModal = ({ isOpen, onClose, onSubmit }) => {
  const [categoryName, setCategoryName] = useState('');
  const [categories, setCategories] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);
  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (isOpen) fetchCategories();
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/categories`);
      const data = await response.json();
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!categoryName.trim()) {
      toast(<CustomToast type="error" title="Missing Name" message="Please enter a category name." />);
      return;
    }

    try {
      const url = editingCategory
        ? `${API_URL}/categories/update/${editingCategory._id}`
        : `${API_URL}/categories/add`;

      const method = editingCategory ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName }),
      });

      if (!response.ok) throw new Error('Failed to save category');

      const result = await response.json();

      toast(
        <CustomToast
          type="success"
          title={editingCategory ? 'Category Updated' : 'Category Added'}
          message={`Category "${categoryName}" ${editingCategory ? 'updated' : 'added'} successfully!`}
        />
      );

      setCategoryName('');
      setEditingCategory(null);
      fetchCategories();
      if (onSubmit) onSubmit(result);
    } catch (error) {
      console.error('Error saving category:', error);
      toast(
        <CustomToast
          type="error"
          title="Save Failed"
          message={error.message || 'Failed to save category. Please try again.'}
        />
      );
    }
  };

  const handleEdit = (category) => {
    setCategoryName(category.name);
    setEditingCategory(category);
  };

  const handleCancelEdit = () => {
    setCategoryName('');
    setEditingCategory(null);
  };

  if (!isOpen) return null;

  return (
    <div className="category-modal-overlay">
      <div className="category-modal-container">
        {/* Header */}
        <div className="category-modal-header">
          <h3 className="category-modal-title">
            {editingCategory ? 'Edit Category' : 'Add New Category'}
          </h3>
          <button className="category-modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Body */}
        <div className="category-modal-body">
          <div className="category-input-group">
            <label className="category-input-label">Category Name *</label>
            <input
              type="text"
              name="name"
              className="category-input-field"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
            />
          </div>

          {/* Existing Categories List */}
          <div className="category-list-container">
            <h4 className="category-list-title">Existing Categories</h4>
            {categories.length > 0 ? (
              <ul className="category-list">
                {categories.map((cat) => (
                  <li key={cat._id} className="category-list-item">
                    <span className="category-item-name">{cat.name}</span>
                    <button
                      type="button"
                      className="category-edit-btn"
                      onClick={() => handleEdit(cat)}
                    >
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="category-empty-msg">No categories found.</p>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="category-modal-footer">
          {editingCategory ? (
            <>
              <button
                type="button"
                className="category-btn-cancel-edit"
                onClick={handleCancelEdit}
              >
                Cancel Edit
              </button>
              <button
                type="submit"
                className="category-btn-update"
                onClick={handleSubmit}
              >
                Update Category
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="category-btn-cancel"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="category-btn-save"
                onClick={handleSubmit}
              >
                Save Category
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddCategoryModal;


const css = `
/* ===== Overlay ===== */
.category-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(5px);
}

/* ===== Modal Container ===== */
.category-modal-container {
  width: 700px;
  max-height: 90%;
  overflow-y: auto;
  border-radius: 20px;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.87);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  animation: fadeIn 0.3s ease-out;
}

/* Smooth Scroll + Custom Scrollbar */
.category-modal-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(100,100,100,0.5) rgba(200,200,200,0.2);
  scroll-behavior: smooth;
}

.category-modal-container::-webkit-scrollbar {
  width: 10px;
}

.category-modal-container::-webkit-scrollbar-track {
  background: rgba(200,200,200,0.2);
  border-radius: 10px;
}

.category-modal-container::-webkit-scrollbar-thumb {
  background-color: rgba(100,100,100,0.5);
  border-radius: 10px;
  border: 3px solid rgba(200,200,200,0.2);
}

.category-modal-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(80,80,80,0.7);
}

/* ===== Header ===== */
.category-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-modal-title {
  font-size: 1.5rem;
  color: #2f2f2f;
  font-weight: 600;
}

.category-modal-close-btn {
  font-size: 1.4rem;
  color: #333;
  background: none;
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease, color 0.2s ease;
}

.category-modal-close-btn:hover {
  transform: scale(1.2);
  color: #e53935;
}

/* ===== Body ===== */
.category-modal-body {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.2rem;
  margin-top: 1.2rem;
}

.category-input-group {
  display: flex;
  flex-direction: column;
}

.category-input-label {
  color: #2c2c2c;
  margin-bottom: 0.3rem;
  font-weight: 500;
}

.category-input-field {
  padding: 0.6rem 0.9rem;
  border-radius: 10px;
  border: none;
  outline: none;
  background: rgba(255, 255, 255, 0.84);
  color: #000;
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  transition: box-shadow 0.3s ease, background 0.3s ease;
}

.category-input-field:focus {
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.25);
  background: rgba(255, 255, 255, 0.95);
}

/* ===== Category List ===== */
.category-list-container {
  background: rgba(255, 255, 255, 0.84);
  border-radius: 10px;
  padding: 1rem;
  border: 1px solid rgba(230, 230, 230, 0.7);
}

.category-list-title {
  margin-bottom: 0.8rem;
  font-size: 1.1rem;
  color: #333;
  font-weight: 600;
}

.category-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.category-list-item {
  background: rgba(255, 255, 255, 0.9);
  padding: 0.6rem 0.8rem;
  border-radius: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.category-list-item:hover {
  background: rgba(245, 245, 245, 0.95);
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.category-item-name {
  color: #222;
  font-weight: 500;
}

.category-edit-btn {
  background: rgba(0, 0, 255, 0.6);
  border: none;
  color: #fff;
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
   font-family: 'Outfit', sans-serif;
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.category-edit-btn:hover {
  background: rgba(0, 0, 180, 0.8);
  box-shadow: 0 2px 6px rgba(0, 0, 255, 0.15);
}

.category-empty-msg {
  color: #666;
  font-style: italic;
}

/* ===== Footer Buttons ===== */
.category-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.2rem;
  flex-wrap: wrap;
}

/* Base Button Style */
.category-btn-cancel,
.category-btn-save,
.category-btn-cancel-edit,
.category-btn-update {
  padding: 0.6rem 1.2rem;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-family: 'Outfit', sans-serif;
  color: #fff;
  font-weight: 500;
  transition: background 0.25s ease, box-shadow 0.25s ease;
}

/* Specific Buttons */
.category-btn-cancel { background: rgba(255, 0, 0, 0.6); }
.category-btn-save { background: rgba(23, 146, 23, 1); }
.category-btn-cancel-edit { background: rgba(255, 140, 0, 0.8); }
.category-btn-update { background: rgba(0, 123, 255, 0.8); }

/* Hover Effects */
.category-btn-cancel:hover {
  background: rgba(200, 0, 0, 0.8);
  box-shadow: 0 2px 8px rgba(255, 0, 0, 0.15);
}

.category-btn-save:hover {
  background: rgba(18, 120, 18, 0.95);
  box-shadow: 0 2px 8px rgba(23, 146, 23, 0.15);
}

.category-btn-cancel-edit:hover {
  background: rgba(255, 100, 0, 0.9);
  box-shadow: 0 2px 8px rgba(255, 140, 0, 0.2);
}

.category-btn-update:hover {
  background: rgba(0, 90, 200, 0.9);
  box-shadow: 0 2px 8px rgba(0, 90, 200, 0.2);
}

/* ===== Animation ===== */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

`;

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);
