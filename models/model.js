const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  content: {
    required: true,
    type: String
  },
  media: {
    type: [String],
  },
  comments: [{
    comment: String
  }],
  reactions: {
    type: Map,
    of: Number,
    default: new Map(),
  },
  signaled: {
    type: Boolean,
    default: false
  }
});

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
