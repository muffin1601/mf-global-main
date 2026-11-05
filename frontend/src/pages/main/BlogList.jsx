import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "../../styles/main/Blog.css";
import Navbar from "../../components/main/Navbar";
import Footer from "../../components/main/Footer";
import WhyChooseUs from "../../components/main/WhyChooseUs";
import useMarketingMeta from "./useMarketingMeta";
import "../../styles/main/MarketingSite.css";

const BlogList = () => {
  useMarketingMeta("Insights & Updates | MF Global Services", "Read the latest news and insights from MF Global Services.");
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/blogs`)
      .then((res) => setBlogs(Array.isArray(res.data) ? res.data : []))
      .catch(() => setLoadError("We couldn’t load the latest posts. Please try again later."))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getAuthorName = (author) => {
    if (!author) return "Admin";
    if (typeof author === "string") return author;
    return author.name || "Admin";
  };

  return (
    <div className="marketing-site">
      <Navbar />

      <main className="blog-background-container">
        <div className="blog-background-overlay"></div>

        <div className="blog-list-container">
          <div className="blog-list-header">
            <h1 className="blog-list-title">Insights & Updates</h1>
            <Link to="/blogs/new" className="blog-create-button">
              + Create New Blog
            </Link>
          </div>

          {loading && <p className="blog-list-message" role="status">Loading posts…</p>}
          {!loading && loadError && <p className="blog-list-message" role="alert">{loadError}</p>}
          {!loading && !loadError && blogs.length === 0 && <p className="blog-list-message">New posts will appear here soon.</p>}
          {!loading && !loadError && blogs.length > 0 && (
            <div className="blog-list-grid">
              {blogs.map((blog) => (
              <div className="blog-card" key={blog._id}>
                <h2 className="blog-card-title">{blog.title}</h2>

                {/* Meta info */}
                <div className="blog-card-meta">
                  <span className="blog-author">
                    By {getAuthorName(blog.author)}
                  </span>
                  {blog.createdAt && (
                    <span className="blog-date">
                      {formatDate(blog.createdAt)}
                    </span>
                  )}
                </div>

                {blog.media &&
                  (blog.media.includes("mp4") ? (
                    <video
                      className="blog-card-media"
                      width="100%"
                      controls
                      preload="none"
                      src={blog.media}
                      aria-label={blog.title}
                    />
                  ) : (
                    <img
                      className="blog-card-media"
                      src={blog.media}
                      alt={blog.title}
                      width="100%"
                      loading="lazy"
                    />
                  ))}

                <p className="blog-card-content">
                  {String(blog.content || "").slice(0, 100)}{String(blog.content || "").length > 100 ? "…" : ""}
                </p>

                <Link
                  to={`/blogs/${blog._id}`}
                  className="blog-readmore-link"
                >
                  Read More
                </Link>
              </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <section><WhyChooseUs /></section>
      <Footer />
    </div>
  );
};

export default BlogList;
