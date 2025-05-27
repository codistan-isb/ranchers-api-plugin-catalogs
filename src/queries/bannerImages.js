/**
 * @name bannerImages
 * @method
 * @memberof Catalog/NoMeteorQueries
 * @summary query the BannerImageV2 collection for banner images
 * @param {Object} context - an object containing the per-request state
 * @param {Object} params - request parameters
 * @param {String[]} [params.tagIds] - Tag IDs to include (OR)
 * @param {Boolean} [params.isActive] - Filter by active status
 * @returns {Promise<MongoCursor>} - A MongoDB cursor for the proper query
 */
export default async function bannerImages(context, params) {
  const { tagIds, isActive } = params;
  const { collections } = context;
  const { BannerImageV2 } = collections;

  const query = {};

  if (tagIds) query.tagIds = { $in: tagIds };
  if (typeof isActive === "boolean") query.isActive = isActive;

  return BannerImageV2.find(query);
} 