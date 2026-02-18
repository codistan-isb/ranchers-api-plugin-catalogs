import { decodeTagOpaqueId } from "../../xforms/id.js";

/**
 * @name Mutation/removeBannerImage
 * @method
 * @memberof Catalog/GraphQL
 * @summary resolver for the removeBannerImage GraphQL mutation
 * @param {Object} _ - unused
 * @param {Object} args - an object of all arguments that were sent by the client
 * @param {String} args.featuredImage - The featured image URL
 * @param {String[]} [args.tagIds] - Optional array of tag IDs to associate with the banner
 * @param {Boolean} [args.isActive] - Whether the banner should be active
 * @param {Object} context - an object containing the per-request state
 * @returns {Promise<Object>} removeBannerImagePayload
 */
export default async function removeBannerImage(_, args, context) {
  const {bannerId} = args;
  const banner = await context.mutations.removeBannerImage(context, {bannerId});

  return banner;
} 