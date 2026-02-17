import { decodeTagOpaqueId } from "../../xforms/id.js";

/**
 * @name Mutation/addBannerImage
 * @method
 * @memberof Catalog/GraphQL
 * @summary resolver for the addBannerImage GraphQL mutation
 * @param {Object} _ - unused
 * @param {Object} args - an object of all arguments that were sent by the client
 * @param {String} args.featuredImage - The featured image URL
 * @param {String[]} [args.tagIds] - Optional array of tag IDs to associate with the banner
 * @param {Boolean} [args.isActive] - Whether the banner should be active
 * @param {Object} context - an object containing the per-request state
 * @returns {Promise<Object>} AddBannerImagePayload
 */
export default async function addBannerImage(_, args, context) {
  const {
    bannerId,
    featuredImage,
    tagIds: opaqueTagIds,
    isActive,
    startAt,
    endAt,
    priority,
    title
  } = args;

  const tagIds = opaqueTagIds && opaqueTagIds.map(decodeTagOpaqueId);

  const banner = await context.mutations.addBannerImage(context, {
    bannerId,
    featuredImage,
    tagIds,
    startAt,
    endAt,
    priority,
    title,
    isActive
  });

  return banner;
} 