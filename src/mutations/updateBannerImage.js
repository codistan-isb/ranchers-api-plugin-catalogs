import ReactionError from "@reactioncommerce/reaction-error";

/**
 * @name updateBannerImage
 * @method
 * @memberof Catalog/Mutations
 * @summary Updates the featured image in the BannerImageV2 collection
 * @param {Object} context - an object containing the per-request state
 * @param {Object} input - Input object
 * @param {String} input.bannerId - ID of banner to update
 * @param {String} input.featuredImage - The featured image URL to update
 * @returns {Promise<Object>} Updated banner
 */
export default async function updateBannerImage(context, { bannerId, featuredImage }) {
  const { collections, redis } = context;
  const { BannerImageV2 } = collections;
  console.log("bannerId ", bannerId);

  // Check if banner exists
  const banner = await BannerImageV2.findOne({ _id: bannerId });
  console.log("banner", banner);
  if (!banner) {
    throw new ReactionError("not-found", "Banner not found");
  }
  console.log("bannerId", bannerId);
  console.log("featuredImage", featuredImage);

  // Update the banner with new featured image
  const { value: updatedBanner } = await BannerImageV2.findOneAndUpdate(
    { _id: bannerId },
    {
      $set: {
        featuredImage,
        updatedAt: new Date()
      }
    },
    {
      returnDocument: "after"
    }
  );
  console.log("updatedBanner", updatedBanner);

  if (!updatedBanner) {
    throw new ReactionError("server-error", "Error updating banner image");
  }

  // Clear Redis cache
  if (redis) {
    console.log("Clearing Redis cache...");
    await redis.set("isCatalogUpdated", true, "EX", 604800);

    const pattern = 'catalogItems*';
    let cursor = '0'; // Initial cursor
    let keysToDelete = [];

    // Use SCAN to iterate through keys
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      keysToDelete = keysToDelete.concat(keys); // Collect matching keys
    } while (cursor !== '0'); // Continue until the cursor loops back to '0'

    if (keysToDelete.length > 0) {
      // Delete the matched keys
      await redis.del(...keysToDelete);
      console.log(`${keysToDelete.length} Redis keys deleted.`);
    } else {
      console.log('No Redis keys to delete.');
    }
  }

  return updatedBanner;
} 