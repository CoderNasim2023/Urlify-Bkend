import { getShortUrl } from "../dao/short_url.js"
import { createShortUrlWithoutUser, createShortUrlWithUser } from "../services/short_url.service.js"
import wrapAsync from "../utils/tryCatchWrapper.js"
import { getRedisClient } from "../config/redis.config.js"
import { NotFoundError } from "../utils/errorHandler.js"

export const createShortUrl = wrapAsync(async (req, res) => {
    const data = req.body
    let shortUrl
    if (req.user) {
        shortUrl = await createShortUrlWithUser(data.url, req.user._id, data.slug)
    } else {
        shortUrl = await createShortUrlWithoutUser(data.url)
    }
    const baseUrl = (process.env.APP_URL && process.env.APP_URL.trim()) || 'https://urlify.co.in'
    res.status(200).json({ shortUrl: baseUrl.replace(/\/$/, '') + '/' + shortUrl })
})


export const redirectFromShortUrl = wrapAsync(async (req, res) => {
    const { id } = req.params

    // try redis cache first
    try {
        const client = getRedisClient()
        if (client) {
            const cacheKey = `short:${id}`
            const cached = await client.get(cacheKey)
            if (cached) {
                return res.redirect(302, cached)
            }
        }
    } catch (err) {
        // If Redis is not available, continue to DB lookup
        console.warn('Redis unavailable, falling back to DB', err && err.message)
    }

    const url = await getShortUrl(id)
    if (!url) {
        throw new NotFoundError("Short URL not found")
    }

    // cache for 1 hour
    try {
        const client = getRedisClient()
        if (client) {
            await client.setEx(`short:${id}`, 3600, url.full_url)
        }
    } catch (err) {
        console.warn('Failed to set redis cache', err && err.message)
    }

    res.redirect(url.full_url)
})

export const resolveShortUrl = wrapAsync(async (req, res) => {
    const { id } = req.params

    // try redis cache first
    try {
        const client = getRedisClient()
        if (client) {
            const cacheKey = `short:${id}`
            const cached = await client.get(cacheKey)
            if (cached) {
                return res.status(200).json({ full_url: cached })
            }
        }
    } catch (err) {
        console.warn('Redis unavailable, falling back to DB', err && err.message)
    }

    const url = await getShortUrl(id)
    if (!url) return res.status(404).json({ error: 'Short URL not found' })

    // cache for 1 hour
    try {
        const client = getRedisClient()
        if (client) {
            await client.setEx(`short:${id}`, 3600, url.full_url)
        }
    } catch (err) {
        console.warn('Failed to set redis cache', err && err.message)
    }

    res.status(200).json({ full_url: url.full_url })
})

export const createCustomShortUrl = wrapAsync(async (req, res) => {
    const { url, slug } = req.body
    const shortUrl = await createShortUrlWithoutUser(url, slug)
    const baseUrl = (process.env.APP_URL && process.env.APP_URL.trim()) || 'https://urlify.co.in'
    res.status(200).json({ shortUrl: baseUrl.replace(/\/$/, '') + '/' + shortUrl })
})