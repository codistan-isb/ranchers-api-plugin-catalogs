// import applyBeforeAfterToFilter from "./applyBeforeAfterToFilter.js";
// import applyOffsetPaginationToMongoCursor from "./applyOffsetPaginationToMongoCursor.js";
// import applyPaginationToMongoCursor from "./applyPaginationToMongoCursor.js";
// import getCollectionFromCursor from "./getCollectionFromCursor.js";
// import getMongoSort from "./getMongoSort.js";

const DEFAULT_LIMIT = 20;

/**
 * Resolvers that return multiple documents in the form of a connection should construct a
 * MongoDB query, pass that cursor to this function, and then return the result.
 *
 * @name getPaginatedResponse
 * @method
 * @memberof GraphQL/ResolverUtilities
 * @summary Given a MongoDB cursor, adds skip, limit, sort, and other filters as necessary
 *   based on GraphQL resolver arguments.
 * @param {Cursor} mongoCursor Node MongoDB Cursor instance. Will be mutated.
 * @param {Object} args Connection arguments from GraphQL query
 * @param {Object} options Options
 * @param {Boolean} [options.includeTotalCount] Whether to return the totalCount. Default is true. Set this to
 *   false if you don't need it to avoid an extra database command.
 * @param {Boolean} [options.includeHasPreviousPage] Whether to return the pageInfo.hasPreviousPage.
 *   Default is true. Set this to false if you don't need it to avoid an extra database command.
 * @param {Boolean} [options.includeHasNextPage] Whether to return the pageInfo.hasNextPage.
 *   Default is true. Set this to false if you don't need it to avoid an extra database command.
 * @returns {Promise<Object>} { nodes, pageInfo, totalCount }
 */
async function getPaginatedResponse(
  mongoCursor,
  args,
  {
    includeHasNextPage = true,
    includeHasPreviousPage = true,
    includeTotalCount = true,
  } = {}
) {
  console.log("getPaginatedResponse,args:", args);
  const { offset, last, sortBy, sortOrder, sortByProductField } = args;
  const baseFilter = mongoCursor.cmd.query;

  // Get the total count, prior to adding before/after filtering
  let totalCount = null;
  if (includeTotalCount) {
    totalCount = await mongoCursor.clone().count();
  }

  // Get a MongoDB sort object
  const sort = getMongoSort({ sortBy, sortByProductField, sortOrder });

  // Find the document for the before/after ID
  const collection = getCollectionFromCursor(mongoCursor);
  let { after, before } = args;
  let hasMore = false;
  if (after || before) {
    const doc = await collection.findOne(
      {
        _id: before || after,
      },
      {
        projection: {
          [sortBy]: 1,
        },
      }
    );

    if (after) after = doc;
    if (before) before = doc;
    hasMore = true;
  }

  // Get an updated filter, with before/after added
  const updatedFilter = applyBeforeAfterToFilter({
    baseFilter,
    after,
    before,
    sortBy,
    sortOrder,
  });

  // Apply these to the cursor
  mongoCursor.filter(updatedFilter).sort(sort);

  let hasPreviousPage;
  let hasNextPage;

  if (offset !== undefined) {
    // offset and last cannot be used together
    if (last) throw new Error("Request either last or offset but not both");

    ({ hasPreviousPage, hasNextPage } =
      await applyOffsetPaginationToMongoCursor(mongoCursor, args, {
        includeHasNextPage,
      }));
  } else {
    // Skip calculating pageInfo if it wasn't requested. Saves a db count command.
    ({ hasPreviousPage, hasNextPage } = await applyPaginationToMongoCursor(
      mongoCursor,
      args,
      {
        includeHasNextPage,
        includeHasPreviousPage,
      }
    ));
  }

  // Figure out proper hasNext/hasPrevious
  const pageInfo = {};
  if (includeHasNextPage) {
    pageInfo.hasNextPage = hasNextPage === null ? hasMore : hasNextPage;
  }
  if (includeHasPreviousPage) {
    pageInfo.hasPreviousPage =
      hasPreviousPage === null ? hasMore : hasPreviousPage;
  }

  const nodes = await mongoCursor.toArray();
  const count = nodes.length;
  if (count) {
    pageInfo.startCursor = nodes[0]._id;
    pageInfo.endCursor = nodes[count - 1]._id;
  }

  return { nodes, pageInfo, totalCount };
}

export default getPaginatedResponse;

// ================================ helper functions ==================================

/**
 * @name applyBeforeAfterToFilter
 * @method
 * @memberof GraphQL/ResolverUtilities
 * @summary Adjusts a MongoDB filter based on GraphQL before and after params
 * @param {Object} args object of arguments passed
 * @param {Object} [args.after] A document that all results should be filtered to be after.
 * @param {Object} [args.baseFilter] The MongoDB filter object to extend.
 * @param {Object} [args.before] A document that all results should be filtered to be before.
 * @param {String} [args.sortBy] The name of the field we are sorting by. Default _id
 * @param {String} [args.sortOrder] The sort order, "asc" or "desc". Default "asc"
 * @returns {Object} The potentially-modified filter object
 */
function applyBeforeAfterToFilter({
  after,
  baseFilter = {},
  before,
  sortBy: sortByField = "_id",
  sortOrder = "asc",
}) {
  let filter = baseFilter;
  const baseFilterIsEmpty = Object.keys(baseFilter).length === 0;
  const limits = {};
  const ors = [];

  if (typeof sortByField !== "string") throw new Error("sortBy is required");
  if (sortOrder !== "asc" && sortOrder !== "desc")
    throw new Error("sortOrder is required");

  if (after && before)
    throw new Error(
      "Including both 'after' and 'before' params is not allowed"
    );

  if (!after && !before) return filter;

  let doc;
  let op;
  if (before) {
    doc = before;
    op = sortOrder === "desc" ? "$gt" : "$lt";
  } else {
    doc = after;
    op = sortOrder === "desc" ? "$lt" : "$gt";
  }

  const internalId = doc._id;

  if (sortByField === "_id") {
    if (baseFilterIsEmpty) {
      filter = { _id: { [op]: internalId } };
    } else {
      filter = {
        $and: [{ ...filter }, { _id: { [op]: internalId } }],
      };
    }
  } else {
    limits[op] = doc[sortByField];
    ors.push({
      [sortByField]: doc[sortByField],
      _id: { [op]: internalId },
    });

    if (baseFilterIsEmpty) {
      filter = {
        $or: [
          {
            [sortByField]: limits,
          },
          ...ors,
        ],
      };
    } else {
      filter = {
        $and: [
          { ...filter },
          {
            $or: [
              {
                [sortByField]: limits,
              },
              ...ors,
            ],
          },
        ],
      };
    }
  }

  return filter;
}

/**
 * Inspired by https://www.reindex.io/blog/relay-graphql-pagination-with-mongodb/
 * @name applyOffsetPaginationToMongoCursor
 * @method
 * @memberof GraphQL/ResolverUtilities
 * @summary Adds skip and limit to a MongoDB cursor as necessary, based on GraphQL
 *   first and offset params
 * @param {Cursor} cursor MongoDB cursor
 * @param {Object} args An object with offset or last but not both.
 * @param {Object} options Options
 * @param {Boolean} [options.includeHasNextPage] Whether to return the pageInfo.hasNextPage.
 *   Default is true. Set this to false if you don't need it to avoid an extra database command.
 * @return {Promise<Object>} { hasNextPage, hasPreviousPage }
 */
async function applyOffsetPaginationToMongoCursor(
  cursor,
  { first, offset } = {},
  { includeHasNextPage = true } = {}
) {
  // Enforce a first: 20 limit if no user-supplied limit, using the DEFAULT_LIMIT
  const limit = first || DEFAULT_LIMIT;

  // Rewind the cursor to start at a zero index
  cursor.rewind();

  // Now apply actual limit + skip to the provided cursor
  cursor.limit(limit);
  cursor.skip(offset);

  let hasNextPage = null;

  const hasPreviousPage = offset > 0;

  if (includeHasNextPage) {
    const nextCursor = cursor.clone();

    nextCursor.skip(offset + limit);
    nextCursor.limit(1);

    const nextDoc = await nextCursor.hasNext();
    hasNextPage = !!nextDoc;

    cursor.limit(limit);
    cursor.skip(offset);
  }

  return {
    hasNextPage,
    hasPreviousPage,
  };
}

/**
 * Inspired by https://www.reindex.io/blog/relay-graphql-pagination-with-mongodb/
 * @name applyPaginationToMongoCursor
 * @method
 * @memberof GraphQL/ResolverUtilities
 * @summary Adds skip and limit to a MongoDB cursor as necessary, based on GraphQL
 *   first and last params
 * @param {Cursor} cursor MongoDB cursor
 * @param {Object} args An object with first or last but not both.
 * @param {Object} options Options
 * @param {Boolean} [options.includeHasPreviousPage] Whether to return the pageInfo.hasPreviousPage.
 *   Default is true. Set this to false if you don't need it to avoid an extra database command.
 * @param {Boolean} [options.includeHasNextPage] Whether to return the pageInfo.hasNextPage.
 *   Default is true. Set this to false if you don't need it to avoid an extra database command.
 * @returns {Promise<Object>} { hasNextPage, hasPreviousPage }
 */
async function applyPaginationToMongoCursor(
  cursor,
  { first, last } = {},
  { includeHasNextPage = true, includeHasPreviousPage = true } = {}
) {
  if (first && last)
    throw new Error("Request either first or last but not both");

  // Enforce a first: 20 limit if no user-supplied limit, using the DEFAULT_LIMIT
  const limit = first || last || DEFAULT_LIMIT;

  let skip = 0;

  let hasNextPage = null;
  let hasPreviousPage = null;

  if (last) {
    // Get the new count after applying before/after
    const totalCount = await cursor.clone().count();
    if (totalCount > last) {
      skip = totalCount - last;
    }

    if (includeHasPreviousPage) {
      if (skip === 0) {
        hasPreviousPage = false;
      } else {
        // For backward pagination, we can find out whether there is a previous page here, but we can't
        // find out whether there's a next page because the cursor has already had "before" filtering
        // added. Code external to this function will need to determine whether there are any documents
        // after that "before" ID.
        const prevCursor = cursor.clone();
        prevCursor.limit(limit + 1);
        prevCursor.skip(skip - 1);
        const prevCursorCount = await prevCursor.count();
        hasPreviousPage = prevCursorCount > limit;
      }
    }
  } else if (includeHasNextPage) {
    // For forward pagination, we can find out whether there is a next page here, but we can't
    // find out whether there's a previous page because the cursor has already had "after" filtering
    // added. Code external to this function will need to determine whether there are any documents
    // before that "after" ID.
    const nextCursor = cursor.clone();
    nextCursor.limit(limit + 1);
    const nextCursorCount = await nextCursor.count();
    hasNextPage = nextCursorCount > limit;
  }

  // Now apply actual limit + skip to the provided cursor
  cursor.limit(limit);
  if (skip) cursor.skip(skip);

  return {
    hasNextPage,
    hasPreviousPage,
  };
}

/**
 * @name getCollectionFromCursor
 * @method
 * @memberof GraphQL/ResolverUtilities
 * @summary Get the associated Mongo Collection instance for a given Cursor instance
 * @param {Cursor} cursor  MongoDB cursor
 * @returns {Object} database collection
 */
function getCollectionFromCursor(cursor) {
  const { db } = cursor.options;
  const collectionName = cursor.ns.slice(db.databaseName.length + 1);
  return db.collection(collectionName);
}

/**
 * Note that this uses the object format rather than the array format because our in-memory db
 * for tests expects object format. The Node mongodb package allows either.
 * Technically an array would be better because JS does not guarantee preservation of object key
 * order, but this seems to work fine.
 *
 * @name getMongoSort
 * @method
 * @memberof GraphQL/ResolverUtilities
 * @summary Converts GraphQL sortBy and sortOrder params to the sort object format
 *   that MongoDB uses.
 * @returns {Object} Sort object
 */
// function getMongoSort({ sortBy, sortByProductField, sortOrder } = {}) {
//   const sortOrderEnumToMongo = {
//     asc: 1,
//     desc: -1,
//   };

//   const mongoSortDirection = sortOrderEnumToMongo[sortOrder || "asc"];
//   if (sortBy && sortBy !== "_id")

//     return {
//       [sortBy]: mongoSortDirection,
//       _id: mongoSortDirection,
//     };
//   return { _id: mongoSortDirection };
// }

function getMongoSort({ sortBy, sortByProductField, sortOrder } = {}) {
  const sortOrderEnumToMongo = {
    asc: 1,
    desc: -1,
  };

  const mongoSortDirection = sortOrderEnumToMongo[sortOrder || "asc"];

  // Initialize the sort object
  const sortObject = {};

  // If sortByProductField is provided, ignore sortBy
  // if (sortByProductField) {
  //   sortObject[`product.${sortByProductField}`] = mongoSortDirection;
  // } else if (sortBy && sortBy !== "_id") {
  //   // Only add sortBy if sortByProductField is not provided
  //   sortObject[sortBy] = mongoSortDirection;
  // }
  if (sortBy && sortBy !== "_id") {
    console.log("sortBy ",sortBy)
    // Only add sortBy if sortByProductField is not provided
    sortObject[sortBy] = mongoSortDirection;
  }

  // Always include sorting by _id
  sortObject._id = mongoSortDirection;

  return sortObject;
}
