import ReactionError from "@reactioncommerce/reaction-error";
import getPaginatedResponse from "../../utils/getPaginatedResponse.js";
import wasFieldRequested from "@reactioncommerce/api-utils/graphql/wasFieldRequested.js";
import { decodeTagOpaqueId } from "../../xforms/id.js";

/**
 * @name Query/bannerImages
 * @method
 * @memberof Catalog/GraphQL
 * @summary Get a list of banner images
 * @param {Object} _ - unused
 * @param {ConnectionArgs} args - an object of all arguments that were sent by the client
 * @param {String[]} [args.tagIds] - limit to banner images with these tags
 * @param {Boolean} [args.isActive] - filter by active status
 * @param {Object} context - an object containing the per-request state
 * @param {Object} info Info about the GraphQL request
 * @returns {Promise<Object>} A BannerImageConnection object
 */
export default async function bannerImages(_, args, context, info) {
    const {
        tagIds: opaqueTagIds,
        isActive,
        isAdmin,
        ...connectionArgs
    } = args;
    // if (context.user === undefined || context.user === null) {
    //     throw new ReactionError(
    //         "access-denied",
    //         "Unauthorized access. Please Login First"
    //     );
    // }
    const tagIds = opaqueTagIds && opaqueTagIds.map(decodeTagOpaqueId);

    const query = await context.queries.bannerImages(context, {
        tagIds,
        isActive,
        isAdmin
    });

    return getPaginatedResponse(query, connectionArgs, {
        includeHasNextPage: wasFieldRequested("pageInfo.hasNextPage", info),
        includeHasPreviousPage: wasFieldRequested("pageInfo.hasPreviousPage", info),
        includeTotalCount: wasFieldRequested("totalCount", info)
    });
} 