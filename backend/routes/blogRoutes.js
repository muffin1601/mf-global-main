const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Blog = require('../models/blog');
const Comment = require('../models/comment');

router.get('/', async (req, res) => {
    try {
        const blogs = await Blog.find().sort({ createdAt: -1});
        res.json(blogs);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid blog ID format" });
  }

  try {
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    res.json(blog);
  } catch (error) {
    console.error("Error fetching blog:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

router.post('/post-blogs', async(req, res) => {
    const {title, content , media, author} = req.body;
    try {
        const newBlog = new Blog({title, content, media , author});
        await newBlog.save();
        res.status(201).json(newBlog);
    } catch (err) {
        res.status(400).json({ error: err.message});
    }
});

router.get('/comments/:blogId', async (req, res) => {
    try {
        const comments = await Comment.find({ blogId: req.params.blogId}).sort({ createdAt: -1 });
        res.json(comments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/comments', async (req, res) => {
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