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
    manpowerSaturdayStart: {
      type: String,
      default: '08:00',
    },
    manpowerSaturdayEnd: {
      type: String,
      default: '13:00',
    },
    manpowerSaturdayNightStart: {
      type: String,
      default: '20:00',
    },
    manpowerSaturdayNightEnd: {
      type: String,
      default: '05:00',
    },
    manpowerSundayStart: {
      type: String,
      default: '08:00',
    },
    manpowerSundayEnd: {
      type: String,
      default: '13:00',
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
    permanentNormalStart: {
      type: String,
      default: '08:00',
    },
    permanentNormalEnd: {
      type: String,
      default: '17:00',
    },
    permanentSpecialStart: {
      type: String,
      default: '17:00',
    },
    permanentSpecialEnd: {
      type: String,
      default: '01:00',
    },
    permanentSaturdayStart: {
      type: String,
      default: '08:00',
    },
    permanentSaturdayEnd: {
      type: String,
      default: '13:00',
    },
    permanentSundayStart: {
      type: String,
      default: '08:00',
    },
    permanentSundayEnd: {
      type: String,
      default: '13:00',
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
    permanentSaturdayOtStart: {
      type: String,
      default: '13:00',
    },
    permanentSaturdayOtEnd: {
      type: String,
      default: '17:00',
    },
    permanentSundayOtStart: {
      type: String,
      default: '13:00',
    },
    permanentSundayOtEnd: {
      type: String,
      default: '17:00',
    },
    manpowerSaturdayOtStart: {
      type: String,
      default: '13:00',
    },
    manpowerSaturdayOtEnd: {
      type: String,
      default: '17:00',
    },
    manpowerSaturdayNightOtStart: {
      type: String,
      default: '05:00',
    },
    manpowerSaturdayNightOtEnd: {
      type: String,
      default: '08:00',
    },
    manpowerSundayOtStart: {
      type: String,
      default: '13:00',
    },
    manpowerSundayOtEnd: {
      type: String,
      default: '17:00',
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
