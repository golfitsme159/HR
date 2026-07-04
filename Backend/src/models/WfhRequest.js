const mongoose = require('mongoose');

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

const wfhRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Normalized to 00:00 of the requested calendar day.
    requestedDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'PENDING',
      index: true,
    },
    // HR/Admin who approved or rejected the request.
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // When the approve/reject decision was made.
    decidedAt: {
      type: Date,
      default: null,
    },
  },
  {
    // Provides createdAt and updatedAt (spec's "updatedAt (Date)").
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// A user should not have two active (non-rejected) requests for the same day.
wfhRequestSchema.index(
  { userId: 1, requestedDate: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['PENDING', 'APPROVED'] } },
  }
);

const WfhRequest = mongoose.model('WfhRequest', wfhRequestSchema);

module.exports = WfhRequest;
module.exports.STATUSES = STATUSES;
