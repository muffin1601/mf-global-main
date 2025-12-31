const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const Blog = require("../../models/blog");
const Comment = require("../../models/comment");

/* ==========================
   Multer Setup
========================== */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/blogs");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      `${Date.now()}-${file.fieldname}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error("Only images are allowed"));
  },
});

/* ==========================
   Blog Routes
========================== */

router.get("/", async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid blog ID format" });
  }

  try {
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ error: "Blog not found" });
    res.json(blog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================
   CREATE BLOG (IMAGE UPLOAD)
========================== */

router.post("/post-blogs", upload.single("media"), async (req, res) => {
  try {
    const { title, content, author } = req.body;

    const baseUrl =
      process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}`;

    const media = req.file
      ? `${baseUrl}/uploads/blogs/${req.file.filename}`
      : "";

    const newBlog = new Blog({
      title,
      content,
      author,
      media,
    });

    await newBlog.save();
    res.status(201).json(newBlog);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ==========================
   Comments
========================== */

router.get("/comments/:blogId", async (req, res) => {
  try {
    const comments = await Comment.find({
      blogId: req.params.blogId,
    }).sort({ createdAt: -1 });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/comments", async (req, res) => {
  const { blogId, user, text } = req.body;
  try {
    const newComment = new Comment({ blogId, user, text });
    await newComment.save();
    res.status(201).json(newComment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
