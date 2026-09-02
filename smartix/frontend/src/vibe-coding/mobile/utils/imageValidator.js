/**
 * imageValidator - Validation d'images (version navigateur)
 *
 * Rôle: Vérifier les dimensions, taille, format d'un File/Blob
 * Compatible browser — sans dépendance serveur (sharp remplacé par APIs natives)
 */

const readImageMetadata = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight, format: file.type.split('/')[1] });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image corrompue ou invalide'));
    };
    img.src = url;
  });

class ImageValidator {
  /**
   * Valide un File image
   * @param {File} file - Fichier image à valider
   * @param {Object} options - Options
   */
  async validate(file, options = {}) {
    const {
      maxSize = 5 * 1024 * 1024,
      allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
      minDimensions = null,
      maxDimensions = null,
      aspectRatio = null,
      aspectRatioTolerance = 0.1
    } = options;

    const errors = [];

    if (file.size > maxSize) {
      errors.push(`Image trop volumineuse: ${file.size} > ${maxSize}`);
    }

    if (!allowedTypes.includes(file.type)) {
      errors.push(`Format non supporté: ${file.type}. Formats autorisés: ${allowedTypes.join(', ')}`);
    }

    let metadata = null;
    try {
      metadata = await readImageMetadata(file);
    } catch (error) {
      errors.push(`Erreur lecture image: ${error.message}`);
      return { valid: false, errors };
    }

    if (minDimensions) {
      if (metadata.width < minDimensions.width)
        errors.push(`Largeur minimale: ${minDimensions.width}px (actuelle: ${metadata.width}px)`);
      if (metadata.height < minDimensions.height)
        errors.push(`Hauteur minimale: ${minDimensions.height}px (actuelle: ${metadata.height}px)`);
    }

    if (maxDimensions) {
      if (metadata.width > maxDimensions.width)
        errors.push(`Largeur maximale: ${maxDimensions.width}px (actuelle: ${metadata.width}px)`);
      if (metadata.height > maxDimensions.height)
        errors.push(`Hauteur maximale: ${maxDimensions.height}px (actuelle: ${metadata.height}px)`);
    }

    if (aspectRatio) {
      const actualRatio = metadata.width / metadata.height;
      const expectedRatio = aspectRatio.width / aspectRatio.height;
      if (Math.abs(actualRatio - expectedRatio) > aspectRatioTolerance) {
        errors.push(
          `Ratio d'aspect invalide: ${actualRatio.toFixed(2)} (attendu: ${expectedRatio.toFixed(2)} ± ${aspectRatioTolerance})`
        );
      }
    }

    return { valid: errors.length === 0, errors, metadata };
  }

  /**
   * Redimensionne une image via Canvas
   * @param {File} file - Fichier source
   * @param {Object} options
   * @returns {Promise<Blob>}
   */
  async resize(file, options = {}) {
    const { width = null, height = null, quality = 0.8, format = 'image/jpeg' } = options;

    try {
      const metadata = await readImageMetadata(file);
      const targetW = width || metadata.width;
      const targetH = height || metadata.height;

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      const url = URL.createObjectURL(file);
      const img = new Image();

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      ctx.drawImage(img, 0, 0, targetW, targetH);
      URL.revokeObjectURL(url);

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => blob ? resolve({ success: true, blob }) : reject(new Error('Canvas toBlob failed')),
          format,
          quality
        );
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export const imageValidator = new ImageValidator();
export default imageValidator;
