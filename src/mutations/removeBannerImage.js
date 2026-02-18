import ReactionError from "@reactioncommerce/reaction-error";
import Random from "@reactioncommerce/random";

/**
 * @name removeBannerImage
 * @method
 * @memberof Catalog/Mutations
 * @summary Removes a banner image
 * @param {Object} context - an object containing the per-request state
 * @param {Object} input - Input object
 * @returns {Promise<Boolean>} true if successful, false otherwise
 */
export default async function removeBannerImage(context, input) {
  const { collections, userHasPermission } = context;
  const { BannerImageV2 } = collections;
  const {bannerId } = input;

  if (!userHasPermission(["admin", "owner", "create-banner"])) {
    throw new ReactionError("access-denied", "Access denied");
  }

  const existingBanner = await BannerImageV2.findOne({ _id: bannerId });
  console.log("existingBanner", existingBanner);
  if (existingBanner) {
   await BannerImageV2.deleteOne({ _id: bannerId });
   return {Id: bannerId};
  }
  return {Id:null};
} 