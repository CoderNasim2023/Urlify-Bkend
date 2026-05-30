import wrapAsync from "../utils/tryCatchWrapper.js"
import { getAllUserUrlsDao } from "../dao/user.dao.js"

export const getAllUserUrls = wrapAsync(async (req, res) => {
    const {_id} = req.user
    const urls = await getAllUserUrlsDao(_id)
    const baseUrl = (process.env.APP_URL && process.env.APP_URL.trim()) || 'https://urlify.co.in'
    const safeBase = baseUrl.replace(/\/$/, '')
    const urlsWithFull = urls.map(u => ({ ...u.toObject(), shortFullUrl: `${safeBase}/${u.short_url}` }))
    res.status(200).json({message:"success",urls: urlsWithFull})
})