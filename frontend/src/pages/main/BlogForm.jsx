import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import "../../styles/main/Blog.css";
import Navbar from '../../components/main/Navbar';
import Footer from '../../components/main/Footer';

const BlogForm = () => {
  const [form, setForm] = useState({ title: '', content: '', media: '', author: '' });
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post(`${import.meta.env.VITE_API_URL}/blogs/post-blogs`, form);
    navigate('/blogs');
  };

  return (
    <div className="form-overlay">
      <div className="form-container">
        <button className="close-button" onClick={() => navigate(-1)}>×</button>
        <h2 className="head">Create New Blog</h2>
        <p className="subtitle-form">Fill out the form below to post your blog.</p>
        <form onSubmit={handleSubmit}>
          <input
            className="form-input"
            type="text"
            name="title"
            placeholder="Title"
            onChange={handleChange}
            required
          />
          <input
            className="form-input"
            type="text"
            name="media"
            placeholder="Image or Video URL"
            onChange={handleChange}
          />
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
            placeholder="Content"
            rows="6"
            onChange={handleChange}
            required
          />
          <button className="submit-button" type="submit">Post</button>
        </form>
      </div>
    </div>
  );
};

export default BlogForm;