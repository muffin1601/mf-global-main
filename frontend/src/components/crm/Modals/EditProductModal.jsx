import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import CustomToast from "../CustomToast";
import "./ProductModal.css";

const EditProductModal = ({ product, onClose, onSave }) => {
  const [categoryNames, setCategoryNames] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");

  const [editedProduct, setEditedProduct] = useState({
    s_code: "",
    p_name: "",
    p_type: "",
    p_color: "",
    HSN_code: "",
    dimension: "",      
    cat_id: "",
    p_description: "",
    p_price: {
      purchase_price: "",
      basic_amount: "",
      GST_rate: "",
      net_amount: "",
    },
  });

  const [previewImage, setPreviewImage] = useState(null);
  const [newImage, setNewImage] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);

  /* --------------------------------------------------
     LOAD PRODUCT DATA
  -------------------------------------------------- */
  useEffect(() => {
    if (!product) return;

    setEditedProduct({
      s_code: product.s_code || "",
      p_name: product.p_name || "",
      p_type: product.p_type || "",
      p_color: product.p_color || "",
      HSN_code: product.HSN_code || "",
      dimension: product.dimension || "",    // ⭐ LOAD NEW FIELD
      cat_id: product.cat_id || "",
      p_description: product.p_description || "",
      p_price: {
        purchase_price: product.p_price?.purchase_price || "",
        basic_amount: product.p_price?.basic_amount || "",
        GST_rate: product.p_price?.GST_rate || "",
        net_amount: product.p_price?.net_amount || "",
      },
    });

    setPreviewImage(
      product.p_image
        ? `${import.meta.env.VITE_IMAGE_URL}${product.p_image}`
        : null
    );
    setNewImage(null);
    setRemoveImage(false);
  }, [product]);

  /* --------------------------------------------------
     FETCH CATEGORIES
  -------------------------------------------------- */
  useEffect(() => {
    let active = true;
    setCategoriesLoading(true);
    setCategoriesError("");
    // Use the same category API that powers Product Management itself. Older
    // products can have a stale cat_id, but that must not prevent the current
    // category list from being offered in the edit form.
    axios.get(`${import.meta.env.VITE_API_URL}/categories`)
      .then((res) => { if (active) setCategoryNames(Array.isArray(res.data) ? res.data : []); })
      .catch(() => { if (active) setCategoriesError("Categories could not be loaded. Please retry."); })
      .finally(() => { if (active) setCategoriesLoading(false); });
    return () => { active = false; };
  }, []);

  /* --------------------------------------------------
     AUTO-CALCULATE NET AMOUNT
  -------------------------------------------------- */
  useEffect(() => {
    const { basic_amount, GST_rate } = editedProduct.p_price;

    if (basic_amount !== '' && GST_rate !== '' && Number.isFinite(Number(basic_amount)) && Number.isFinite(Number(GST_rate))) {
      const basic = parseFloat(basic_amount);
      const gst = parseFloat(GST_rate);
      const net = basic + (basic * gst) / 100;

      setEditedProduct((prev) => ({
        ...prev,
        p_price: { ...prev.p_price, net_amount: net.toFixed(2) },
      }));
    }
  }, [editedProduct.p_price.basic_amount, editedProduct.p_price.GST_rate]);

  /* --------------------------------------------------
     HANDLE INPUT CHANGES
  -------------------------------------------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name in editedProduct.p_price) {
      setEditedProduct((prev) => ({
        ...prev,
        p_price: { ...prev.p_price, [name]: value },
      }));
    } else {
      setEditedProduct((prev) => ({ ...prev, [name]: value }));
    }
  };

  /* --------------------------------------------------
     SAVE PRODUCT (SEND FORMDATA)
  -------------------------------------------------- */
  const saveProduct = async (event) => {
    event?.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const fd = new FormData();

      fd.append("_id", product._id);
      fd.append("s_code", editedProduct.s_code);
      fd.append("p_name", editedProduct.p_name);
      fd.append("p_type", editedProduct.p_type);
      fd.append("p_color", editedProduct.p_color);
      fd.append("HSN_code", editedProduct.HSN_code);
      fd.append("dimension", editedProduct.dimension);         // ⭐ SAVE NEW FIELD
      fd.append("cat_id", editedProduct.cat_id);
      fd.append("p_description", editedProduct.p_description);
      fd.append("p_price", JSON.stringify(editedProduct.p_price));
      fd.append("remove_image", String(removeImage));

      if (newImage) {
        fd.append("p_image", newImage);
      }

      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/products/update`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      toast(
        <CustomToast
          type="success"
          title="Updated"
          message={`Product "${editedProduct.p_name}" updated successfully!`}
        />
      );

      onSave(res.data);
      onClose();
    } catch (error) {
      toast(
        <CustomToast
          type="error"
          title="Update Failed"
          message={error.response?.data?.message || error.message}
        />
      );
    } finally { setSaving(false); }
  };

  if (!product) return null;

  return (
    <div className="glasso-modal-overlay" onClick={() => !saving && onClose()}>
      <div
        className="glasso-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glasso-modal-header">
          <h3 className="glasso-modal-title">Edit Product</h3>
          <button type="button" className="glasso-close-btn" aria-label="Close edit product" onClick={onClose} disabled={saving}>
            ×
          </button>
        </div>

        <form id="edit-product-form" className="glasso-modal-body" onSubmit={saveProduct}>
          {/* IMAGE UPLOAD */}
          <div className="glasso-input-group" style={{ gridColumn: "span 2" }}>
            <label>Product Image</label>

            {previewImage ? (
              <div style={{ textAlign: "left" }}>
                <img
                  src={previewImage}
                  alt="Preview"
                  style={{
                    width: "auto",
                    height: "auto",
                    maxWidth: "160px",
                    maxHeight: "160px",
                    borderRadius: "10px",
                    objectFit: "contain",
                  }}
                />
                <button
                  type="button"
                  style={{
                    display: "block",
                    marginTop: "8px",
                    background: "#d32f2f",
                    color: "#fff",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setPreviewImage(null);
                    setNewImage(null);
                    setRemoveImage(true);
                  }}
                >
                  Remove Image
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setNewImage(file);
                    setPreviewImage(URL.createObjectURL(file));
                    setRemoveImage(false);
                  }
                }}
              />
            )}
          </div>

          {/* BASIC DETAILS */}
          {[
            { label: "Style Code", name: "s_code" },
            { label: "Product Name", name: "p_name" },
            { label: "Material Type", name: "p_type" },
            { label: "Color", name: "p_color" },
            { label: "HSN Code", name: "HSN_code" },
            { label: "Dimensions", name: "dimension" },  // ⭐ NEW FIELD
          ].map(({ label, name }) => (
            <div className="glasso-input-group" key={name}>
              <label htmlFor={`edit-product-${name}`}>{label}{name === 'p_name' ? ' *' : ''}</label>
              <input
                id={`edit-product-${name}`}
                type="text"
                name={name}
                value={editedProduct[name] || ""}
                onChange={handleChange}
                required={name === "p_name"}
              />
            </div>
          ))}

          {/* CATEGORY */}
          <div className="glasso-input-group">
            <label htmlFor="edit-product-code">Product Code</label>
            <input id="edit-product-code" type="text" value={product.p_code || 'Legacy product code unavailable'} readOnly />
            <small>Product codes remain unchanged when the category changes.</small>
          </div>
          <div className="glasso-input-group">
            <label htmlFor="edit-product-category">Category *</label>
            <select
              id="edit-product-category"
              name="cat_id"
              value={editedProduct.cat_id || ""}
              onChange={handleChange}
              required
              disabled={categoriesLoading || saving}
            >
              <option value="">{categoriesLoading ? "Loading categories…" : "Select Category"}</option>
              {categoryNames.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {categoriesError && <small role="alert">{categoriesError}</small>}
            {!categoriesLoading && !categoriesError && categoryNames.length === 0 && <small role="alert">No categories are available. Add a category first.</small>}
          </div>

          {/* DESCRIPTION */}
          <div className="glasso-input-group" style={{ gridColumn: "span 2" }}>
            <label>Description</label>
            <textarea
              name="p_description"
              value={editedProduct.p_description || ""}
              onChange={handleChange}
            />
          </div>

          {/* PRICING */}
          <div className="glasso-input-group">
            <label>Purchase Amount</label>
            <input
              type="number"
              name="purchase_price"
              value={editedProduct.p_price.purchase_price || ""}
              onChange={handleChange}
            />
          </div>

          <div className="glasso-input-group">
            <label>Basic Amount</label>
            <input
              type="number"
              name="basic_amount"
              value={editedProduct.p_price.basic_amount || ""}
              onChange={handleChange}
            />
          </div>

          <div className="glasso-input-group">
            <label>GST Rate (%)</label>
            <select
              name="GST_rate"
              value={editedProduct.p_price.GST_rate || ""}
              onChange={handleChange}
            >
              <option value="">Select GST</option>
              <option value="5">5%</option>
              <option value="18">18%</option>
            </select>
          </div>

          <div className="glasso-input-group">
            <label>Net Amount</label>
            <input
              type="number"
              name="net_amount"
              value={
                editedProduct.p_price.net_amount
                  ? Math.round(editedProduct.p_price.net_amount)
                  : ""
              }
              readOnly
              style={{ backgroundColor: "#f5f5f5" }}
            />
          </div>
        </form>

        <div className="glasso-footer-buttons glasso-action-buttons">
          <button type="button" className="glasso-btn-cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="edit-product-form" className="glasso-btn-save" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProductModal;
