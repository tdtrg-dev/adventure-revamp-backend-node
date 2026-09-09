const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Net-new collection (no Laravel table) — replaces personal_access_tokens.
 * Sanctum tokens never expire and are individually revocable on logout;
 * this gives stateless JWT the same revocation behavior (checked in middlewares/auth.js).
 */
const authTokenSchema = new Schema(
  {
    jti: { type: String, required: true, unique: true },
    tokenable_type: { type: String, enum: ['user', 'admin'], required: true },
    tokenable_id: { type: Schema.Types.ObjectId, required: true },
    issued_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true },
    revoked_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

authTokenSchema.index({ tokenable_type: 1, tokenable_id: 1 });

module.exports = mongoose.model('AuthToken', authTokenSchema);