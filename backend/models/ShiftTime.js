import mongoose from 'mongoose';

const ShiftTimeSchema = new mongoose.Schema(
  {
    manpowerDayStart: {
      type: String,
      default: '08:00',
    },
    manpowerDayEnd: {
      type: String,
      default: '17:00',
    },
    manpowerNightStart: {
      type: String,
      default: '20:00',
    },
    manpowerNightEnd: {
      type: String,
      default: '05:00',
    },
    permanentDayStart: {
      type: String,
      default: '08:00',
    },
    permanentDayEnd: {
      type: String,
      default: '17:00',
    },
    permanentNightStart: {
      type: String,
      default: '20:00',
    },
    permanentNightEnd: {
      type: String,
      default: '05:00',
    },
    manpowerDayOtStart: {
      type: String,
      default: '17:00',
    },
    manpowerDayOtEnd: {
      type: String,
      default: '20:00',
    },
    manpowerNightOtStart: {
      type: String,
      default: '05:00',
    },
    manpowerNightOtEnd: {
      type: String,
      default: '08:00',
    },
    permanentDayOtStart: {
      type: String,
      default: '17:00',
    },
    permanentDayOtEnd: {
      type: String,
      default: '20:00',
    },
    permanentNightOtStart: {
      type: String,
      default: '05:00',
    },
    permanentNightOtEnd: {
      type: String,
      default: '08:00',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('ShiftTime', ShiftTimeSchema);
