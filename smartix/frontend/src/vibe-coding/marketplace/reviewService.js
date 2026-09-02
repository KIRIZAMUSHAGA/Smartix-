export const REVIEW_STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };
export const initializeReviewService = async (deps) => {};
export const getReviewService = () => ({
  getAppAnalytics: async () => null,
  submitReview: async () => ({ success: false }),
  getReviews: async () => [],
});
export const setPublishService = () => {};
export default getReviewService;
