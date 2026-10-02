import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema({
  shortUrlId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "shortUrl",
    required: true,
    index: true,
  },
  ipAddress: {
    type: String,
    required: false,
  },
  country: {
    type: String,
    required: false,
  },
  city: {
    type: String,
    required: false,
  },
  browser: {
    type: String,
    required: false,
  },
  os: {
    type: String,
    required: false,
  },
  device: {
    type: String,
    required: false,
  },
}, {
  timestamps: true,
});

const Analytics = mongoose.model("Analytics", analyticsSchema);

export default Analytics;
