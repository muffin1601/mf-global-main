import React, { useState, useEffect } from 'react';
import axios from 'axios';
import "../../styles/main/Blog.css"; // or create a separate CommentSection.css if you prefer

const CommentSection = ({ blogId }) => {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [user, setUser] = useState('');

  const fetchComments = () => {
    axios.get(`${import.meta.env.VITE_API_URL}/blogs/comments/${blogId}`).then((res) => setComments(res.data));
  };

  useEffect(() => {
    fetchComments();
  }, [blogId]);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!text) return;
    await axios.post(`${import.meta.env.VITE_API_URL}/blogs/comments`, { blogId, text, user });
    setText('');
    setUser('');
    fetchComments();
  };

  return (
    <div className="comment-section">
      <h3 className="comment-title">Comments</h3>
      <form className="comment-form" onSubmit={handleComment}>
        <input
          className="comment-input"
          type="text"
          placeholder="Your Name"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          required
        />
        <textarea
          className="comment-textarea"
          placeholder="Write a comment..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
        <button className="comment-button" type="submit">Post Comment</button>
      </form>
      <ul className="comment-list">
        {comments.map((c) => (
          <li className="comment-item" key={c._id}>
            <strong className="comment-user">{c.user}</strong>: <span className="comment-text">{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CommentSection;
