import ReactionError from "@reactioncommerce/reaction-error";
import Random from "@reactioncommerce/random";

/**
 * @name addBannerImage
 * @method
 * @memberof Catalog/Mutations
 * @summary Adds a new banner image
 * @param {Object} context - an object containing the per-request state
 * @param {Object} input - Input object
 * @param {String} input.featuredImage - The featured image URL
 * @param {String[]} [input.tagIds] - Optional array of tag IDs to associate with the banner
 * @param {Boolean} [input.isActive] - Whether the banner should be active (defaults to true)
 * @returns {Promise<Object>} BannerImageV2
 */
export default async function addBannerImage(context, input) {
  const { collections, userHasPermission } = context;
  const { BannerImageV2 } = collections;
  const { featuredImage, tagIds, isActive = true,startAt,endAt, priority,title,bannerId } = input;

  if (!userHasPermission(["admin", "owner", "create-banner"])) {
    throw new ReactionError("access-denied", "Access denied");
  }

  const existingBanner = await BannerImageV2.findOne({ _id: bannerId });
  if (existingBanner) {
   await BannerImageV2.updateOne({ _id: bannerId }, { $set: { featuredImage, tagIds, isActive, startAt, endAt, priority, title, updatedAt: new Date() } });
   return await BannerImageV2.findOne({ _id: bannerId });
  }
  const newBanner = {
    _id: Random.id(),
    title,
    featuredImage,
    tagIds: tagIds || [],
    isActive,
    startAt,
    endAt,
    priority ,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  console.log("newBanner", newBanner);
  const { insertedId } = await BannerImageV2.insertOne(newBanner);

  const banner = await BannerImageV2.findOne({ _id: insertedId });

  return banner;
} 