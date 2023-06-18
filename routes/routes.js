const express = require('express');
const multer = require('multer');
const router = express.Router();
const Post = require('../models/model');
const emojiRegex = require('emoji-regex');

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = file.originalname.split('.').pop(); // Get the file extension
    const fileName = file.fieldname + '-' + uniqueSuffix + '.' + fileExtension;
    cb(null, fileName);
  },
});

// Multer upload instance
const upload = multer({ storage: storage });

// Get all posts
router.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Create a new post
router.post('/posts', upload.single('image'), async (req, res) => {
  const { content } = req.body;
  let imageURL = null;

  if (req.file) {
    const { filename, mimetype } = req.file;
    imageURL = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
  }

  try {
    // Create a new post with the content and media
    const reactions = {
      heart: 0,
      sad: 0,
      like: 0,
      laugh: 0
    };

    const post = await Post.create({
      content,
      media: imageURL ? [imageURL] : [],
      reactions, // Set the reactions field with initial values
    });

    res.status(201).json(post);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create a post' });
  }
});


// Update
router.put('/posts/:id', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  try {
    const post = await Post.findByIdAndUpdate(
      id,
      { $set: { content } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    return res.json(post);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: 'Failed to update the post' });
  }
});


// Delete a post
router.delete('/posts/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findByIdAndDelete(id);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to delete the post' });
  }
});

// Add a comment to a post
router.post('/posts/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  try {
    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const newComment = { comment };
    post.comments.push(newComment);
    await post.save();

    res.status(201).json(newComment);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to add comment to the post' });
  }
});




router.get('/posts/:id/reactions', async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Extract the actual reaction counts from the post.reactions map
    const reactionCounts = {
      heart: post.reactions.get('heart') || 0,
      sad: post.reactions.get('sad') || 0,
      like: post.reactions.get('like') || 0,
      laugh: post.reactions.get('laugh') || 0,
    };

    res.json(reactionCounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch reaction counts' });
  }
});


// Increment a specific reaction by 1
router.put('/posts/:id/reactions/:reaction', async (req, res) => {
  const { id, reaction } = req.params;

  try {
    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (!post.reactions.has(reaction)) {
      res.status(400).json({ error: 'Invalid reaction emoji' });
      return;
    }

    post.reactions.set(reaction, post.reactions.get(reaction) + 1);
    await post.save();

    res.json(post.reactions);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to increment reaction' });
  }
});




// Decrement a specific reaction by 1
router.put('/posts/:id/reactions/:reaction/decrement', async (req, res) => {
  const { id, reaction } = req.params;

  try {
    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (!post.reactions.has(reaction)) {
      res.status(400).json({ error: 'Invalid reaction emoji' });
      return;
    }

    // Check if the reaction count is greater than 0 before decrementing
    if (post.reactions.get(reaction) > 0) {
      post.reactions.set(reaction, post.reactions.get(reaction) - 1);
      await post.save();
    }

    res.json(post.reactions);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to decrement reaction' });
  }
});


module.exports = router;

// Signal a post
router.post('/posts/:id/signal', async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    post.signaled = true;
    await post.save();

    res.sendStatus(201);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to signal the post' });
  }
});

module.exports = router;
