import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import CommentSection from '../../components/main/CommentSection';
import "../../styles/main/Blog.css";
import Navbar from '../../components/main/Navbar';
import Footer from '../../components/main/Footer';
import WhyChooseUs from '../../components/main/WhyChooseUs';

const BlogDetail = () => {
  const { id } = useParams();
  const [blog, setBlog] = useState(null);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/blogs/${id}`).then((res) => setBlog(res.data));
  }, [id]);

  if (!blog) return <p className="blog-loading">Loading...</p>;

  return (
    <>
        <Navbar/>
                <div className="blog-background-container">
            <div className="blog-background-overlay"></div>
    <div className="blog-detail-container">
      <h2 className="blog-detail-title">{blog.title}</h2>
      {blog.media && (
        blog.media.includes('mp4') ? (
          <video className="blog-detail-media" width="100%" controls src={blog.media} />
        ) : (
          <img className="blog-detail-media" src={blog.media} alt={blog.title} width="100%" />
        )
      )}
      <p className="blog-detail-content">{blog.content}</p>
      <CommentSection blogId={id} />
    </div></div>
    <WhyChooseUs/>
    <Footer/>
    </>
  );
};

export default BlogDetail;
