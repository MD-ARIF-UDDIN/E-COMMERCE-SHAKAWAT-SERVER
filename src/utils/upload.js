const sharp = require('sharp');
const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

/**
 * Compresses and uploads an image to Supabase Storage.
 * @param {Buffer} buffer - The image buffer.
 * @param {string} originalName - Original filename.
 * @returns {Promise<string>} - Public URL of the uploaded image.
 */
async function uploadProductImage(buffer, originalName) {
  return uploadToBucket(buffer, 'products');
}

async function uploadCategoryImage(buffer, originalName) {
  return uploadToBucket(buffer, 'categories');
}

async function uploadToBucket(buffer, bucketName) {
  try {
    const processedBuffer = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const fileName = `${uuidv4()}.webp`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, processedBuffer, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error(`Upload error to ${bucketName}:`, error);
    throw new Error(`Failed to upload image to ${bucketName}: ` + error.message);
  }
}

module.exports = { uploadProductImage, uploadCategoryImage };
