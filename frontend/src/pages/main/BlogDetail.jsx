import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import CommentSection from '../../components/main/CommentSection';
import "../../styles/main/BlogDetail.css";
import Navbar from '../../components/main/Navbar';
import Footer from '../../components/main/Footer';
import WhyChooseUs from '../../components/main/WhyChooseUs';
import useMarketingMeta from "./useMarketingMeta";
import "../../styles/main/MarketingSite.css";

const BlogDetail = () => {
  const { id } = useParams();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useMarketingMeta(
    blog?.title ? `${blog.title} | MF Global Services` : "Insights | MF Global Services",
    blog?.content?.slice(0, 155) || "Read insights from MF Global Services."
  );

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    axios.get(`${import.meta.env.VITE_API_URL}/blogs/${id}`)
      .then((res) => setBlog(res.data))
      .catch(() => setLoadError("We couldn’t load this post. It may have been removed or is temporarily unavailable."))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="marketing-site">
      <Navbar />
      <main className="blog-background-container-2">
        <div className="blog-background-overlay-2"></div>
        {loading && <p className="blog-loading" role="status">Loading post…</p>}
        {!loading && loadError && <p className="blog-loading" role="alert">{loadError}</p>}
        {!loading && !loadError && blog && <article className="blog-detail-container">
          <h1 className="blog-detail-title">{blog.title}</h1>
          {blog.media && (
            blog.media.includes('mp4') ? (
              <video className="blog-detail-media" width="100%" controls preload="metadata" src={blog.media} aria-label={blog.title} />
            ) : (
              <img className="blog-detail-media" src={blog.media} alt={blog.title} width="100%" loading="lazy" />
            )
          )}
          <p className="blog-detail-content">{blog.content || ""}</p>
          <CommentSection blogId={id} />
        </article>}
      </main>
      <section><WhyChooseUs /></section>
      <Footer />
    </div>
  );
};

export default BlogDetail;
