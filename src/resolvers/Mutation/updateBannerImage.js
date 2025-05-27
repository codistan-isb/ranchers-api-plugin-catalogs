import decodeOpaqueId from "@reactioncommerce/api-utils/decodeOpaqueId.js";

/**
 * @name Mutation/updateBannerImage
 * @method
 * @memberof Catalog/GraphQL
 * @summary resolver for the updateBannerImage GraphQL mutation
 * @param {Object} parentResult - unused
 * @param {Object} args - an object of all arguments that were sent by the client
 * @param {String} args.bannerId - The opaque ID of banner to update
 * @param {Object} args.featuredImage - The featured image to update
 * @param {Object} context - an object containing the per-request state
 * @returns {Promise<Object>} UpdateBannerImagePayload
 */
export default async function updateBannerImage(parentResult, args, context) {
  const { bannerId, featuredImage } = args;

  // const decodedBannerId = decodeOpaqueId(bannerId).id;

  return context.mutations.updateBannerImage(context, {
    bannerId: bannerId,
    featuredImage
  });
} 