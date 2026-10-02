import { getShortUrl } from "../dao/short_url.js"
import { createShortUrlWithoutUser, createShortUrlWithUser } from "../services/short_url.service.js"
import wrapAsync from "../utils/tryCatchWrapper.js"
import { getRedisClient } from "../config/redis.config.js"
import { NotFoundError } from "../utils/errorHandler.js"
import QRCode from "qrcode"
import useragent from "useragent"
import geoip from "geoip-lite"
import Analytics from "../models/analytics.model.js"

export const createShortUrl = wrapAsync(async (req, res) => {
    const { url, slug, expiresAt } = req.body
    let shortUrl
    if (req.user) {
        shortUrl = await createShortUrlWithUser(url, req.user._id, slug, expiresAt)
    } else {
        shortUrl = await createShortUrlWithoutUser(url, slug, expiresAt)
    }
    const baseUrl = (process.env.APP_URL && process.env.APP_URL.trim()) || 'https://urlify.co.in'
    const fullShortUrl = baseUrl.replace(/\/$/, '') + '/' + shortUrl
    const qrCode = await QRCode.toDataURL(fullShortUrl)
    res.status(200).json({ shortUrl: fullShortUrl, qrCode })
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

    if (url.expiresAt && new Date() > url.expiresAt) {
        return res.status(410).json({ error: "This link has expired" })
    }

    // cache for 1 hour if not expired
    try {
        const client = getRedisClient()
        if (client) {
            await client.setEx(`short:${id}`, 3600, url.full_url)
        }
    } catch (err) {
        console.warn('Failed to set redis cache', err && err.message)
    }

    // Analytics Tracking (Fire & Forget)
    try {
        const agent = useragent.parse(req.headers['user-agent']);
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        if(ip && ip.includes(',')) ip = ip.split(',')[0].trim();
        const geo = geoip.lookup(ip);
        
        Analytics.create({
            shortUrlId: url._id,
            ipAddress: ip,
            country: geo ? geo.country : 'Unknown',
            city: geo ? geo.city : 'Unknown',
            browser: agent.family,
            os: agent.os.family,
            device: agent.device.family
        }).catch(err => console.error("Analytics Error", err));
    } catch(e) {
        console.error("Analytics Parsing Error", e);
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
    const { url, slug, expiresAt } = req.body
    const shortUrl = await createShortUrlWithoutUser(url, slug, expiresAt)
    const baseUrl = (process.env.APP_URL && process.env.APP_URL.trim()) || 'https://urlify.co.in'
    const fullShortUrl = baseUrl.replace(/\/$/, '') + '/' + shortUrl
    const qrCode = await QRCode.toDataURL(fullShortUrl)
    res.status(200).json({ shortUrl: fullShortUrl, qrCode })
})