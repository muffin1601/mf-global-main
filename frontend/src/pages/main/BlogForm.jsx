import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../../styles/main/Blog.css";
import "../../styles/main/MarketingSite.css";
import useMarketingMeta from "./useMarketingMeta";

const BlogForm = () => {
  useMarketingMeta("Create a Blog | MF Global Services", "Create a new post for MF Global Services.");
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
    <div className="marketing-site">
    <main className="form-overlay">
      <div className="form-container">
        <button type="button" className="close-button" aria-label="Close form" onClick={() => navigate(-1)}>
          ×
        </button>

        <h1 className="head">Create New Blog</h1>
        <p className="subtitle-form">
          Fill out the form below to post your blog.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="blog-form-field">
            Blog Title
            <input
              className="form-input"
              type="text"
              name="title"
              onChange={handleChange}
              required
            />
          </label>

          {/* Image Upload */}
          <label className="blog-form-field">
            Image or video
            <input
              className="form-input"
              type="file"
              accept="image/*,video/mp4"
              onChange={handleImageChange}
            />
          </label>

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

          <label className="blog-form-field">
            Author Name
            <input
              className="form-input"
              type="text"
              name="author"
              onChange={handleChange}
            />
          </label>

          <label className="blog-form-field">
            Blog Content
            <textarea
              className="form-textarea"
              name="content"
              rows="6"
              onChange={handleChange}
              required
            />
          </label>

          <button className="submit-button" type="submit">
            Post Blog
          </button>
        </form>
      </div>
    </main>
    </div>
  );
};

export default BlogForm;
