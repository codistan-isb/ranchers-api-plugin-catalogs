import { decodeProductOpaqueId } from "../../xforms/id.js";

/**
 * @name Mutation/updateProductDeliveryOptions
 * @method
 * @memberof Catalog/GraphQL
 * @summary resolver for the updateProductDeliveryOptions GraphQL mutation
 * @param {Object} _ - unused
 * @param {Object} args - an object of all arguments that were sent by the client
 * @param {String} args.productId - The ID of product to update
 * @param {Boolean} args.isDelivery - Whether the product is available for delivery
 * @param {Boolean} args.isTakeaway - Whether the product is available for takeaway
 * @param {Object} context - an object containing the per-request state
 * @returns {Promise<Object>} UpdateProductDeliveryOptionsPayload
 */
export default async function updateProductDeliveryOptions(_, args, context) {
  const { productId, isDelivery, isTakeaway } = args;
  console.log("productId before decode", productId);

  const decodedProductId = decodeProductOpaqueId(productId);

  return context.mutations.updateProductDeliveryOptions(context, {
    productId: decodedProductId,
    isDelivery,
    isTakeaway
  });
} 