import ReactionError from "@reactioncommerce/reaction-error";

/**
 * @name updateProductDeliveryOptions
 * @method
 * @memberof Catalog/Mutations
 * @summary Updates isDelivery and isTakeaway fields for a product in the Products collection
 * @param {Object} context - an object containing the per-request state
 * @param {Object} input - Input object
 * @param {String} input.productId - Product ID to update
 * @param {Boolean} input.isDelivery - Whether the product is available for delivery
 * @param {Boolean} input.isTakeaway - Whether the product is available for takeaway
 * @returns {Promise<Object>} Updated product
 */
export default async function updateProductDeliveryOptions(context, input) {
  const { collections, userHasPermission } = context;
  const { Products } = collections;
  const { productId, isDelivery, isTakeaway } = input;

  // Check permission
  if (!userHasPermission(["admin", "owner", "edit-product"])) {
    throw new ReactionError("access-denied", "Access denied");
  }

  // First check if product exists
  const product = await Products.findOne({ _id: productId });
  if (!product) {
    throw new ReactionError("not-found", "Product not found");
  }

  // Update the product
  const { value: updatedProduct } = await Products.findOneAndUpdate(
    { _id: productId },
    {
      $set: {
        isDelivery,
        isTakeaway,
        updatedAt: new Date()
      }
    },
    {
      returnOriginal: false
    }
  );

  if (!updatedProduct) {
    throw new ReactionError("server-error", "Failed to update product");
  }

  // After updating the product, publish the changes to the Catalog
  const success = await context.mutations.publishProducts(context, [productId]);

  return updatedProduct;
} 