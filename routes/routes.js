const express = require('express');
const multer = require('multer');
const router = express.Router();
const Post = require('../models/model');
const User = require('../models/user');
const sharp = require('sharp');
const path = require('path');

// Multer storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

//Get image of a specific post
router.get('/posts/:id/image', async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);

    if (!post || !post.media || post.media.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Assuming there is only one image in the media array, retrieve the first one
    const imageData = post.media[0];

    // Convert the base64 image data to a buffer
    const imageBuffer = Buffer.from(imageData, 'base64');

    // Use sharp to identify the image type and set the appropriate file extension
    const metadata = await sharp(imageBuffer).metadata();
    const fileExtension = `.${metadata.format}`;

    res.writeHead(200, {
      'Content-Type': `image/${metadata.format}`,
      'Content-Length': imageBuffer.length,
      'Content-Disposition': `inline; filename=${id}${fileExtension}` // Set the filename for the image
    });

    // Send the image buffer as the response
    res.end(imageBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch the image' });
  }
});

// Create a new post
router.post('/posts', upload.single('image'), async (req, res) => {
  const { content, userId } = req.body;

  try {
    const reactions = {
      heart: 0,
      sad: 0,
      like: 0,
      laugh: 0,
    };

    let mediaData = [];

    if (req.file) {
      // Resize the image to a smaller size (e.g., 500x500)
      const resizedImageBuffer = await sharp(req.file.buffer).toBuffer(100);

      // Convert the resized image buffer to base64 data
      const base64Image = resizedImageBuffer.toString('base64');
      mediaData.push(base64Image);
    }

    // Create a new post with the user and media data
    const post = new Post({
      content,
      media: mediaData,
      reactions,
      postCreator: userId, // Set the postCreator field to the userId
    });

    await post.save();

    res.status(201).json(post);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create a post' });
  }
});

router.post('/:postId/comment/:commentId/react', async (req, res) => {
  const { postId, commentId } = req.params;
  const { emoji, userId } = req.body;
  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if the comment has the reactionsToComment map or initialize it if not present
    if (!comment.reactionsToComment) {
      comment.reactionsToComment = new Map();
    }

    // Check if the user has already reacted to this comment
    const userReaction = comment.reactionsToComment.get(userId);
    if (userReaction) {
      // User has already reacted, update the reaction
      comment.reactionsToComment.set(userId, emoji);
    } else {
      // User has not reacted before, add the new reaction
      comment.reactionsToComment.set(userId, emoji);
    }

    // Save the updated post
    post.markModified('comments'); // Mark the 'comments' field as modified
    await post.save();

    res.status(200).json({ message: 'Reaction added to comment successfully', post });
  } catch (error) {
    console.error('Error adding reaction to comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


router.get('/:postId/comments/react-count', async (req, res) => {
  const { postId } = req.params;
  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const commentReactions = [];
    post.comments.forEach(comment => {
      const reactionCountMap = new Map();
      if (comment.reactionsToComment) {
        // Count the emoji reactions for this comment
        comment.reactionsToComment.forEach((emoji, userId) => {
          if (reactionCountMap.has(emoji)) {
            reactionCountMap.set(emoji, reactionCountMap.get(emoji) + 1);
          } else {
            reactionCountMap.set(emoji, 1);
          }
        });
      }
      commentReactions.push({
        commentId: comment._id,
        reactionCountMap: Object.fromEntries(reactionCountMap),
      });
    });

    res.status(200).json({ postId, commentReactions });
  } catch (error) {
    console.error('Error fetching comment reactions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

//Get all comm + username

router.get('/posts/:postId/comments', async (req, res) => {
  const { postId } = req.params;

  try {
    const post = await Post.findById(postId).populate('comments.user', 'username');
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    const comments = post.comments.map(comment => ({
      comment: comment.comment,
      username: comment.user.username
    }));
    res.status(200).json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});


// Edit a comment
router.put('/posts/:postId/comments/:commentId', async (req, res) => {
  const { postId, commentId } = req.params;
  const { comment } = req.body; // The updated comment content from the client

  try {
    const post = await Post.findById(postId);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const commentIndex = post.comments.findIndex(
      (comment) => comment._id.toString() === commentId
    );

    if (commentIndex === -1) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    post.comments[commentIndex].comment = comment; // Update the comment content
    await post.save();

    res.status(200).json(post.comments[commentIndex]); // Send the updated comment data in the response
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to update the comment' });
  }
});


// Delete a comment
router.delete('/posts/:postId/comments/:commentId', async (req, res) => {
  const { postId, commentId } = req.params;

  try {
    const post = await Post.findById(postId);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const commentIndex = post.comments.findIndex(
      (comment) => comment._id.toString() === commentId
    );

    if (commentIndex === -1) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    post.comments.splice(commentIndex, 1);
    await post.save();

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to delete the comment' });
  }
});


//Get all posts
router.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find();
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.get('/posts/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const posts = await Post.find({ postCreator: userId });
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch posts' });
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

router.post('/posts/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { userId, username, comment } = req.body; // Extract the userId, username, and comment from the request body

  try {
    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const newComment = {
      comment,
      username,
      userId, // Include the userId in the new comment
    };

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


router.put('/posts/:id/reactions/:reaction', async (req, res) => {
  const { id, reaction } = req.params;
  const { userId } = req.body;

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

    const previousReaction = post.lastReactionState.find(
      (state) => state.user.toString() === userId
    );

    if (previousReaction) {
      // Decrement the previous reaction count
      post.reactions.set(previousReaction.emoji, previousReaction.count - 1);
    }

    // Increment the new reaction count
    post.reactions.set(reaction, post.reactions.get(reaction) + 1);

    // Update or add the user's last reaction state
    const newReactionState = {
      user: userId,
      emoji: reaction,
      count: post.reactions.get(reaction),
    };
    const userReactionIndex = post.lastReactionState.findIndex(
      (state) => state.user.toString() === userId
    );
    if (userReactionIndex !== -1) {
      // Update the existing user's reaction state
      post.lastReactionState[userReactionIndex] = newReactionState;
    } else {
      // Add the new user's reaction state
      post.lastReactionState.push(newReactionState);
    }

    await post.save();

    res.json(post.reactions);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to update reaction' });
  }
});

router.put('/posts/:id/reactions/:reaction/decrement', async (req, res) => {
  const { id, reaction } = req.params;
  const { userId } = req.body;

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
      // Decrement the reaction count by 1
      post.reactions.set(reaction, post.reactions.get(reaction) - 1);

      // Save the updated post to the database
      await post.save();

      res.json({ message: 'Emoji count decremented successfully' });
    } else {
      // No need to decrement since the count is already 0
      res.json({ message: 'Emoji count is already 0' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to decrement emoji count' });
  }
});


// Signal a post
router.post('/posts/:id/signal', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body; // Extract the user ID from the request body

  try {
    const post = await Post.findById(id);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    post.signaledBy.push(userId); // Add the user ID to the `signaledBy` array
    post.signaled = true;
    await post.save();

    res.sendStatus(201);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to signal the post' });
  }
});



// Create a new user account
router.post('/users', async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const newUser = new User({ username, password });
    await newUser.save();

    res.status(201).json(newUser);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to create user account' });
  }
});

// User login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    res.json({ message: 'Login successful', userIdVolo: user._id, usernameVolo: user.username }); // Include the user ID in the response
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Failed to login' });
  }
});

router.post('/users/username', async (req, res) => {
  const { userId } = req.body;

  try {
    // Assuming you have a User model
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const username = user.username;
    res.json({ username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch username' });
  }
});


module.exports = router;
