const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { IMAGES_DIR } = require('../images');

// Allowed type
const MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// Store local in /images
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, IMAGES_DIR);
  },
  filename: (req, file, callback) => {
    const name = file.originalname.split(' ').join('_').split('.')[0];
    const extension = MIME_TYPES[file.mimetype];
    callback(null, `${name}_${Date.now()}.${extension}`);
  },
});

// Only img - max 5mb
const fileFilter = (req, file, callback) => {
  if (MIME_TYPES[file.mimetype]) {
    callback(null, true);
  } else {
    callback(new Error('Only image files are allowed'), false);
  }
};

const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('image');

const optimizeImage = async (file) => {
  const originalPath = path.join(IMAGES_DIR, file.filename);
  const optimizedName = `opt_${file.filename.replace(/\.[^.]+$/, '')}.webp`;
  const optimizedPath = path.join(IMAGES_DIR, optimizedName);

  await sharp(originalPath)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(optimizedPath);

  fs.unlink(originalPath, (err) => {
    if (err) console.error('Original image cleanup failed:', err);
  });

  return optimizedName;
};

module.exports = (req, res, next) => {
  uploadImage(req, res, (err) => {
    if (err) return next(err);
    if (!req.file) return next();
    return optimizeImage(req.file)
      .then((optimizedName) => {
        req.optimizedFilename = optimizedName;
        next();
      })
      .catch(next);
  });
};
