export const PostLayouts = {
  TEXT_ONLY: 'TEXT_ONLY',
  IMAGE_TOP: 'IMAGE_TOP',
  IMAGE_SIDE: 'IMAGE_SIDE',
  IMAGE_BACKGROUND: 'IMAGE_BACKGROUND',
  VIDEO: 'VIDEO',
  GALLERY: 'GALLERY',
  LINK_CARD: 'LINK_CARD',
  SHARED_POST: 'SHARED_POST'
};

/**
 * Resolves the layout type for a post based on its content.
 * @param {Object} post - The post object.
 * @returns {string} The layout type from PostLayouts.
 */
export const resolvePostLayout = (post) => {
  if (!post) return PostLayouts.TEXT_ONLY;
  
  if (post.post_type === 'shared_post') return PostLayouts.SHARED_POST;

  const hasImage = !!post.image;
  const hasVideo = !!post.video;
  
  // Normalisation identique à FeedSimple pour la détection
  const bg_image = (typeof post.background_image === 'string' && post.background_image.trim() !== '') ? post.background_image : null;
  const bg_css = (typeof post.background_css === 'string' && post.background_css.trim() !== '') ? post.background_css : null;
  const hasCustomBackground = !!(bg_image || bg_css);

  if (hasVideo) return PostLayouts.VIDEO;

  // RÈGLE PRIORITAIRE : Si image OU arrière-plan personnalisé -> IMAGE_BACKGROUND (Immersif)
  if (hasImage || hasCustomBackground) {
    return PostLayouts.IMAGE_BACKGROUND;
  }
  
  return PostLayouts.TEXT_ONLY;
};
