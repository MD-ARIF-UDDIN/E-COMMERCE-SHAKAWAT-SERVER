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
  try {
    // 1. Process image with sharp
    // Resize if larger than 1200px and convert to WebP with 80% quality
    const processedBuffer = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // 2. Generate unique filename
    const fileName = `${uuidv4()}.webp`;

    // 3. Upload to Supabase 'products' bucket
    const { data, error } = await supabase.storage
      .from('products')
      .upload(fileName, processedBuffer, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // 4. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('products')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload image: ' + error.message);
  }
}

module.exports = { uploadProductImage };
