const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

function storageFor(subfolder) {
  const dir = path.join(UPLOAD_ROOT, subfolder);
  fs.mkdirSync(dir, { recursive: true });

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
}

// relative path stored in DB / returned in API responses (e.g. "profile/<uuid>.jpg")
function relativeUploadPath(subfolder, filename) {
  return `${subfolder}/${filename}`;
}

function fileUrl(relativePath) {
  const { appUrl } = require('../config/env');
  if (!relativePath) return null;
  return `${appUrl}/uploads/${relativePath}`;
}

function uploader(subfolder, maxSizeMb = 10) {
  return multer({
    storage: storageFor(subfolder),
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
  });
}

module.exports = { uploader, relativeUploadPath, fileUrl, UPLOAD_ROOT };
