import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../../styles/main/Blog.css";

const BlogForm = () => {
  const [form, setForm] = useState({
    title: "",
    content: "",
    author: "",
  });

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("title", form.title);
    formData.append("content", form.content);
    formData.append("author", form.author);

    if (image) {
      formData.append("media", image);
    }

    await axios.post(
      `${import.meta.env.VITE_API_URL}/blogs/post-blogs`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    navigate("/blogs");
  };

  return (
    <div className="form-overlay">
      <div className="form-container">
        <button className="close-button" onClick={() => navigate(-1)}>
          ×
        </button>

        <h2 className="head">Create New Blog</h2>
        <p className="subtitle-form">
          Fill out the form below to post your blog.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            className="form-input"
            type="text"
            name="title"
            placeholder="Blog Title"
            onChange={handleChange}
            required
          />

          {/* Image Upload */}
          <input
            className="form-input"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
          />

          {/* Image Preview */}
          {preview && (
            <img
              src={preview}
              alt="Preview"
              style={{
                width: "100%",
                borderRadius: "8px",
                marginBottom: "12px",
              }}
            />
          )}

          <input
            className="form-input"
            type="text"
            name="author"
            placeholder="Author Name"
            onChange={handleChange}
          />

          <textarea
            className="form-textarea"
            name="content"
            placeholder="Blog Content"
            rows="6"
            onChange={handleChange}
            required
          />

          <button className="submit-button" type="submit">
            Post Blog
          </button>
        </form>
      </div>
    </div>
  );
};

export default BlogForm;
