const express = require('express');
const multer = require('multer');
const router = express.Router();
const Post = require('../models/model');
const emojiRegex = require('emoji-regex');
const { Octokit } = require('@octokit/rest');
const path = require('path');
const fs = require('fs');
const util = require('util');
const writeFileAsync = util.promisify(fs.writeFile);

const octokit = new Octokit({
  auth: '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',
});
// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads')); // Set the destination folder
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Use the original filename
  }
});

// Create the multer middleware
const upload = multer({ storage });

// Get all posts
router.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Create a new pos

router.post('/posts', upload.single('image'), async (req, res) => {
  const { content } = req.body;

  try {
    const reactions = {
      heart: 0,
      sad: 0,
      like: 0,
      laugh: 0
    };

    let imageURL = null;

    if (req.file) {
      const { buffer, originalname } = req.file;

      // Move the uploaded file to the 'uploads' folder
      const filePath = path.join(__dirname, '..', 'uploads', originalname);

      fs.writeFileSync(filePath, buffer);

      // Create a release on GitHub
      octokit.repos.createRelease({
        owner: 'alaeddine-cmd',
        repo: 'animevault-back',
        tag_name: 'v1.0', // Specify a tag name for the release
      })
        .then((release) => {
          // Upload the image file as a release asset
          octokit.repos.uploadReleaseAsset({
            owner: 'alaeddine-cmd',
            repo: 'animevault-back',
            release_id: release.data.id,
            name: originalname,
            data: buffer,
          })
            .then((uploadAsset) => {
              // Retrieve the download URL of the uploaded asset
              imageURL = uploadAsset.data.browser_download_url;

              // Create a post with the saved image URL
              createPost();
            })
            .catch((error) => {
              console.error(error);
              res.status(500).json({ error: 'Failed to upload the file to GitHub' });
            });
        })
        .catch((error) => {
          console.error(error);
          res.status(500).json({ error: 'Failed to create a release on GitHub' });
        });
    } else {
      // Create a post without an image URL
      createPost();
    }

    function createPost() {
      Post.create({
        content,
        media: imageURL ? [imageURL] : [],
        reactions,
      })
        .then((post) => {
          res.status(201).json(post);
        })
        .catch((error) => {
          console.error(error);
          res.status(400).json({ error: 'Failed to create a post' });
        });
    }
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
