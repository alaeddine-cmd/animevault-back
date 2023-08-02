const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  postCreator: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User', // Assuming your user model is named 'User'
  },
  content: {
    required: true,
    type: String,
  },
  media: {
    type: [String],
  },
  comments: [
    {
      comment: String,
      username: String,
      userId: String,
      reactionsToComment: {
        type: Map,
        of: String, // Allow string values for reactions
        default: {},
      },
    },
  ],
  reactions: {
    type: Map,
    of: Number,
    default: {},
  },
  signaled: {
    type: Boolean,
    default: false,
  },
  signaledBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  lastReactionState: [
    {
      emoji: String,
      count: Number,
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
  ],
});

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
