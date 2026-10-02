import { generateNanoId } from "../utils/helper.js"
import urlSchema from "../models/short_url.model.js"
import { getCustomShortUrl, saveShortUrl } from "../dao/short_url.js"

export const createShortUrlWithoutUser = async (url, slug = null, expiresAt = null) => {
    const length = parseInt(process.env.SHORT_ID_LENGTH) || 5
    const shortUrl = slug || generateNanoId(length)
    if (!shortUrl) throw new Error("Short URL not generated")
    await saveShortUrl(shortUrl, url, null, expiresAt)
    return shortUrl
}

export const createShortUrlWithUser = async (url, userId, slug = null, expiresAt = null) => {
    const length = parseInt(process.env.SHORT_ID_LENGTH) || 5
    const shortUrl = slug || generateNanoId(length)
    const exists = await getCustomShortUrl(slug)
    if (exists) throw new Error("This custom url already exists")

    await saveShortUrl(shortUrl, url, userId, expiresAt)
    return shortUrl
}