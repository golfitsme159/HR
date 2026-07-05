const mongoose = require('mongoose');

const ROLES = ['EMPLOYEE', 'HR', 'ADMIN'];

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    nickname: {
      type: String,
      trim: true,
      default: '',
    },
    // Last 6 digits of the national ID. HR pre-registers employees with this
    // value; the employee later links their LINE account against it.
    nationalIdLast6: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\d{6}$/, 'nationalIdLast6 must be exactly 6 digits'],
    },
    // Populated once the employee links their LINE account. Uniqueness is
    // enforced by a PARTIAL index (see below), not `unique`/`sparse` here:
    // pre-registered employees all carry an explicit `null` (default), and a
    // sparse index still indexes null values — so multiple unlinked employees
    // would collide. The partial index keys only real (string) LINE ids.
    lineUserId: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'EMPLOYEE',
    },
    // HR/Admin web login credentials. Employees authenticate via LINE and have
    // neither field. `passwordHash` is never returned by default (select:false).
    username: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    maxWfhPerMonth: {
      type: Number,
      default: 10,
      min: 0,
    },
    annualLeaveQuota: {
      type: Number,
      default: 6,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Partial unique index: enforce uniqueness only for actual (string) LINE ids so
// any number of pre-registered employees can share a null lineUserId, while a
// linked LINE id still maps to at most one user. Replaces the old sparse+unique
// index (which failed because `default: null` makes the field an explicit null
// that a sparse index still enforces on).
userSchema.index(
  { lineUserId: 1 },
  { unique: true, partialFilterExpression: { lineUserId: { $type: 'string' } } }
);

userSchema.virtual('isLinked').get(function isLinked() {
  return Boolean(this.lineUserId);
});

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
