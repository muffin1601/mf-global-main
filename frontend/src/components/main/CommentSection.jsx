import React, { useCallback, useState, useEffect } from 'react';
import axios from 'axios';
import "../../styles/main/Blog.css"; // or create a separate CommentSection.css if you prefer

const CommentSection = ({ blogId }) => {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [user, setUser] = useState('');
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/blogs/comments/${blogId}`);
      setComments(Array.isArray(response.data) ? response.data : []);
      setLoadError('');
      return true;
    } catch {
      setLoadError("We couldn’t load comments right now.");
      return false;
    }
  }, [blogId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!text.trim() || !user.trim()) return;
    setSubmitting(true);
    setStatus('');
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/blogs/comments`, {
        blogId,
        text: text.trim(),
        user: user.trim(),
      });
      setText('');
      setUser('');
      const loaded = await fetchComments();
      setStatus(loaded ? "Your comment was posted." : "Your comment was posted, but the latest comments could not be refreshed.");
    } catch {
      setStatus("We couldn’t post your comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="comment-section">
      <h3 className="comment-title">Comments</h3>
      <form className="comment-form" onSubmit={handleComment}>
        <label className="comment-field">
          Your Name
          <input
            className="comment-input"
            type="text"
            autoComplete="name"
            maxLength={120}
            value={user}
            onChange={(e) => setUser(e.target.value)}
            required
          />
        </label>
        <label className="comment-field">
          Write a comment
          <textarea
            className="comment-textarea"
            maxLength={3000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
        </label>
        <button className="comment-button" type="submit" disabled={submitting}>{submitting ? "Posting…" : "Post Comment"}</button>
      </form>
      {loadError && <p className="comment-status error" role="alert">{loadError}</p>}
      {status && <p className="comment-status" role="status" aria-live="polite">{status}</p>}
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
