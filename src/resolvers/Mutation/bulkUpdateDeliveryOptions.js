/**
 * @name Mutation/bulkUpdateDeliveryOptions
 * @method
 * @memberof Catalog/GraphQL
 * @summary resolver for the bulkUpdateDeliveryOptions GraphQL mutation
 * @param {Object} _ - unused
 * @param {Object} args - an object of all arguments that were sent by the client
 * @param {Boolean} args.updateProducts - Whether to update products collection
 * @param {Boolean} args.updateCatalog - Whether to update catalog collection
 * @param {Object} context - an object containing the per-request state
 * @returns {Promise<Object>} BulkOperationResult
 */
export default async function bulkUpdateDeliveryOptions(_, args, context) {
  const { updateProducts = true, updateCatalog = true } = args;
  const { collections, userHasPermission } = context;
  const { Products, Catalog } = collections;

  // Check permission
  if (!userHasPermission(["admin", "owner"])) {
    throw new ReactionError("access-denied", "Access denied. Requires admin or owner role.");
  }

  try {
    let updatedCount = 0;

    // Update Products collection if requested
    if (updateProducts) {
      const productsResult = await Products.updateMany(
        {},
        {
          $set: {
            isDelivery: true,
            isTakeaway: true,
            updatedAt: new Date()
          }
        }
      );
      updatedCount += productsResult.modifiedCount;
    }

    // Update Catalog collection if requested
    if (updateCatalog) {
      const catalogResult = await Catalog.updateMany(
        {},
        {
          $set: {
            "product.isDelivery": true,
            "product.isTakeaway": true,
            updatedAt: new Date()
          }
        }
      );
      updatedCount += catalogResult.modifiedCount;
    }

    // If we updated products, we should republish them to sync the changes
    // if (updateProducts) {
    //   const allProducts = await Products.find({}, { projection: { _id: 1 } }).toArray();
    //   const productIds = allProducts.map((product) => product._id);
    //   await context.mutations.publishProducts(context, productIds);
    // }

    return {
      success: true,
      updatedCount,
      message: "Successfully updated delivery options"
    };
  } catch (error) {
    return {
      success: false,
      updatedCount: 0,
      message: error.message
    };
  }
} 