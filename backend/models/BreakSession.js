import mongoose from 'mongoose';

const BreakSessionSchema = new mongoose.Schema({
  // Break sessions are now global, not per employee or QR
  breakType: {
    type: String,
    enum: ['BREAKFAST', 'LUNCH', 'TEA', 'CLOTHES','MORNING MEETING'],
    required: true
  },
  // Duration-based breaks (preferred).
  // Stored in minutes to avoid floating point ambiguity.
  durationMinutes: {
    type: Number,
    min: 0
  },
  startTime: {
    type: String
  },
  endTime: {
    type: String
  }
});

export default mongoose.model('BreakSession', BreakSessionSchema);
