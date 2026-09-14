const mongoose = require('mongoose');
const { Schema } = mongoose;

// Embedded — was user_profiles (1:1)
const profileSchema = new Schema(
  {
    gender: { type: String, enum: ['male', 'female', 'other'], default: null },
    dob: { type: Date, default: null },
    phone: { type: String, default: null },
    image: { type: String, default: null },
    bio: { type: String, default: null },
    radius: { type: Number, default: null },
    address: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    company_cat_id: { type: Schema.Types.ObjectId, ref: 'CompanyCategory', default: null },
  },
  { _id: false }
);

// Embedded — was user_wallets (1:1)
const walletSchema = new Schema(
  {
    balance: { type: Number, default: 0 },
    pending_balance: { type: Number, default: 0 },
    total_earned: { type: Number, default: 0 },
    total_withdrawn: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    user_type: { type: String, enum: ['user', 'company'], required: true },
    google_id: { type: String, default: null },
    fb_id: { type: String, default: null },
    stripe_account_id: { type: String, default: null },
    stripe_customer_id: { type: String, default: null },
    is_online: { type: Boolean, default: false },
    last_seen_at: { type: Date, default: null },
    is_banned: { type: Boolean, default: false },
    suspended_until: { type: Date, default: null },
    email_verified_at: { type: Date, default: null },
    password_reset_token: { type: String, default: null, select: false },
    password_reset_expires: { type: Date, default: null, select: false },
    // Email-verification OTP (see sendEmailOtp / verifyEmailOtp in auth.service).
    email_otp_hash: { type: String, default: null, select: false },
    email_otp_expires_at: { type: Date, default: null, select: false },
    email_otp_attempts: { type: Number, default: 0, select: false },
    email_otp_last_sent_at: { type: Date, default: null, select: false },
    // Password-reset OTP (forgot password steps 1-2). The reset token that step 2
    // hands out lives in password_reset_token / password_reset_expires above.
    password_reset_otp_hash: { type: String, default: null, select: false },
    password_reset_otp_expires_at: { type: Date, default: null, select: false },
    password_reset_otp_attempts: { type: Number, default: 0, select: false },
    password_reset_otp_last_sent_at: { type: Date, default: null, select: false },

    profile: { type: profileSchema, default: () => ({}) },
    wallet: { type: walletSchema, default: () => ({}) },
    reward_points: { type: Number, default: 0 },

    interests: [{ type: Schema.Types.ObjectId, ref: 'Interest' }],
    following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    blocked_users: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

userSchema.index({ following: 1 });
userSchema.index({ blocked_users: 1 });

module.exports = mongoose.model('User', userSchema);