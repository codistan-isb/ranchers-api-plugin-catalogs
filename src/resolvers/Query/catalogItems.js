import Logger from "@reactioncommerce/logger";
import ReactionError from "@reactioncommerce/reaction-error";
// import getPaginatedResponse from "@reactioncommerce/api-utils/graphql/getPaginatedResponse.js";
import wasFieldRequested from "@reactioncommerce/api-utils/graphql/wasFieldRequested.js";
import { decodeShopOpaqueId, decodeTagOpaqueId } from "../../xforms/id.js";
import xformCatalogBooleanFilters from "../../utils/catalogBooleanFilters.js";
import getPaginatedResponse from "../../utils/getPaginatedResponse.js";

/**
 * @name Query/catalogItems
 * @method
 * @memberof Catalog/GraphQL
 * @summary Get a list of catalogItems
 * @param {Object} _ - unused
 * @param {ConnectionArgs} args - an object of all arguments that were sent by the client
 * @param {String[]} [args.searchQuery] - limit to catalog items matching this text search query
 * @param {String[]} [args.shopIds] - limit to catalog items for these shops
 * @param {Boolean} [args.isBanner] -  #To handle banner images case
 * @param {String[]} [args.tagIds] - limit to catalog items with this array of tags
 * @param {Object[]} [args.booleanFilters] - Array of boolean filter objects with `name` and `value`
 * @param {Object} context - an object containing the per-request state
 * @param {Object} info Info about the GraphQL request
 * @returns {Promise<Object>} A CatalogItemConnection object
 */
export default async function catalogItems(_, args, context, info) {
  const { redis } = context;
  const {
    shopIds: opaqueShopIds,
    tagIds: opaqueTagIds,
    booleanFilters,
    searchQuery,
    isBanner,
    // sortBy,
    // sortOrder,
    ...connectionArgs
  } = args;
  console.log("isBanner ", isBanner);
  const shopIds = opaqueShopIds && opaqueShopIds.map(decodeShopOpaqueId);
  const tagIds = opaqueTagIds && opaqueTagIds.map(decodeTagOpaqueId);

  let catalogBooleanFilters = {};
  if (Array.isArray(booleanFilters) && booleanFilters.length) {
    catalogBooleanFilters = await xformCatalogBooleanFilters(
      context,
      booleanFilters
    );
  }
  let isCatalogUpdated, redisKey,ifRedisNotWorking

  if (redis) {
    try {
      redisKey = `catalogItems:${JSON.stringify(args)}`;
      isCatalogUpdated = await redis?.get("isCatalogUpdated")
      console.log("isCatalogUpdated ", isCatalogUpdated)
    } catch (err) {
      console.log("err ",err)
      ifRedisNotWorking=true;
    }

  }
  console.log("ifRedisNotWorking ",ifRedisNotWorking)
  console.log("isCatalogUpdated ",isCatalogUpdated)
  console.log("typeof ",typeof(isCatalogUpdated))



  // Check if cached data exists and is valid
  let cachedCatalogItems;
  console.log(
    "redis ", redis
  )
  console.log("ifRedisNotWorking!=true ",ifRedisNotWorking!=true)
  console.log(`isCatalogUpdated!="true"`,isCatalogUpdated!="true")
  console.log("redis&&ifRedisNotWorking!=true&&isCatalogUpdated!=true ",(redis&&ifRedisNotWorking!=true&&isCatalogUpdated!="true"))
  if (redis&&ifRedisNotWorking!=true&&isCatalogUpdated!="true") {
    try {
      cachedCatalogItems = await redis.get(redisKey);
    } catch (error) {
      console.warn("Redis error:", error.message);
    }
  } else {
    console.warn("Redis is not initialized. Skipping cache lookup.");
  }

  if (cachedCatalogItems) {
    // Return cached data if available
    console.log("Returning catalog items from Redis cache ");
    console.log("cachedCatalogItems ",cachedCatalogItems)
    return JSON.parse(cachedCatalogItems);
  }

  if (connectionArgs.sortBy === "featured") {
    if (!tagIds || tagIds.length === 0) {
      throw new ReactionError(
        "not-found",
        "A tag ID is required for featured sort"
      );
    }
    if (tagIds.length > 1) {
      throw new ReactionError(
        "invalid-parameter",
        "Multiple tags cannot be sorted by featured. Only the first tag will be returned."
      );
    }
    const tagId = tagIds[0];
    return context.queries.catalogItemsAggregate(context, {
      catalogBooleanFilters,
      connectionArgs,
      searchQuery,
      shopIds,
      tagId,
      isBanner
    });

    // // Cache the result in Redis with expiry of 1 week (604800 seconds)
    // const sanitizedItems = sanitizeForCache(featuredCatalogItems); // Sanitize the data before caching
    // await redis.set(redisKey, JSON.stringify(sanitizedItems), "EX", 604800); // Cache for 1 week
    // return featuredCatalogItems;
  }

  // minPrice is a sorting term that does not necessarily match the field path by which we truly want to sort.
  // We allow plugins to return the true field name, or fallback to the default pricing field.
  if (connectionArgs.sortBy === "minPrice") {
    let realSortByField;

    // Allow external pricing plugins to handle this if registered. We'll use the
    // first value returned that is a string.
    for (const func of context.getFunctionsOfType(
      "getMinPriceSortByFieldPath"
    )) {
      realSortByField = await func(context, { connectionArgs }); // eslint-disable-line no-await-in-loop
      if (typeof realSortByField === "string") break;
    }

    if (!realSortByField) {
      Logger.warn(
        "An attempt to sort catalog items by minPrice was rejected. " +
        "Verify that you have a pricing plugin installed and it registers a getMinPriceSortByFieldPath function."
      );
      throw new ReactionError(
        "invalid-parameter",
        "Sorting by minPrice is not supported"
      );
    }

    connectionArgs.sortBy = realSortByField;
  }

  const query = await context.queries.catalogItems(context, {
    catalogBooleanFilters,
    searchQuery,
    shopIds,
    tagIds,
    isBanner
    // sortBy,
    // sortOrder,
  });
  connectionArgs.sortBy = "priority"

  const res = await getPaginatedResponse(query, connectionArgs, {
    includeHasNextPage: wasFieldRequested("pageInfo.hasNextPage", info),
    includeHasPreviousPage: wasFieldRequested("pageInfo.hasPreviousPage", info),
    includeTotalCount: wasFieldRequested("totalCount", info)
  });

  // Cache the result in Redis with expiry of 1 week (604800 seconds)
  // const sanitizedQuery = sanitizeForCache(res); // Sanitize the data before caching
  if (redis&&ifRedisNotWorking!=true) {
    try {
      console.log("isCatalogUpdated false")
      await redis.set(redisKey, JSON.stringify(res), "EX", 604800); // Cache for 1 week
      await redis.set("isCatalogUpdated", false, "EX", 604800);
    } catch (error) {
      console.warn("Redis error:", error.message);
    }
  } else {
    console.warn("Redis is not initialized. Skipping cache storage.");
  }

  console.log(res);
  console.log("res[0]",res.nodes[0])
  console.log("res[1]",res.nodes[1])
  console.log("res[2]",res.nodes[2])
  console.log("res[3]",res.nodes[3])

  return res;
}

// Helper function to avoid circular references in MongoDB objects
function sanitizeForCache(object) {
  const cacheSafeObject = JSON.parse(
    JSON.stringify(object, (key, value) => {
      // You can customize the circular structure removal here if needed
      if (
        value &&
        value.constructor &&
        value.constructor.name === "NativeTopology"
      ) {
        return undefined; // Avoid circular references
      }
      return value;
    })
  );
  return cacheSafeObject;
}
