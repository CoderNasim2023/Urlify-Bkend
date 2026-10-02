import express from "express";
import logger from "./src/utils/logger.js";
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { nanoid } from "nanoid"
import dotenv from "dotenv"
dotenv.config()
import connectDB from "./src/config/monogo.config.js"
import short_url from "./src/routes/short_url.route.js"
import user_routes from "./src/routes/user.routes.js"
import auth_routes from "./src/routes/auth.routes.js"
import { redirectFromShortUrl } from "./src/controller/short_url.controller.js";
import { errorHandler } from "./src/utils/errorHandler.js";
import cors from "cors"
import { attachUser } from "./src/utils/attachUser.js";
import cookieParser from "cookie-parser"
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import compression from 'compression'
import { initRedis } from './src/config/redis.config.js'
import client from 'prom-client'

// Initialize Prometheus metrics
const register = new client.Registry()
client.collectDefaultMetrics({ register })

const httpRequestDurationMicroseconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
})
register.registerMetric(httpRequestDurationMicroseconds)

const app = express();

// Middleware to track metrics
app.use((req, res, next) => {
    const end = httpRequestDurationMicroseconds.startTimer()
    res.on('finish', () => {
        end({
            method: req.method,
            route: req.route ? req.route.path : req.path,
            code: res.statusCode
        })
    })
    next()
})

// 1. Compression must be one of the first middlewares
app.use(compression());

// CORS configuration - must be before other middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        const allowedOrigins = [
            'http://shorturl.urlify.co.in',
            'https://shorturl.urlify.co.in',
            'http://www.shorturl.urlify.co.in',
            'https://www.shorturl.urlify.co.in',
            'http://urlify.co.in',
            'https://urlify.co.in',
            'http://www.urlify.co.in',
            'https://www.urlify.co.in',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:3000'
        ];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,       //👈 this allows cookies to be sent
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Set-Cookie'],
    exposedHeaders: ['Set-Cookie']
}));

app.use(helmet());
app.use(morgan('combined'));

// 2. Adjust rate limit for higher concurrency
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: Number(process.env.RATE_LIMIT_MAX) || 1000, // Increased to 1000 default
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);

app.use(express.json({ limit: '10kb' })) // Body limit for security
app.use(express.urlencoded({ extended: true, limit: '10kb' }))
app.use(cookieParser())

app.use("/api/auth", auth_routes)
app.use(attachUser)
app.use("/api/user", user_routes)
app.use("/api/create", short_url)

// Swagger setup
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: { title: 'Urlify API', version: '1.0.0', description: 'API for URL Shortener' },
    },
    apis: ['./src/routes/*.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Home route
app.get('/', (req, res) => {
    res.send("Backend Default home route is running succesfully")
})

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() })
})

// Metrics for Prometheus - MUST BE BEFORE CATCH-ALL ROUTE
app.get('/metrics', async (req, res) => {
    // Basic protection for production
    const metricsKey = process.env.METRICS_KEY;
    const providedKey = req.headers['x-metrics-key'] || req.query.key;

    // In dev or if key matches, allow access
    if (process.env.NODE_ENV === 'production' && metricsKey && providedKey !== metricsKey) {
        return res.status(403).send('Forbidden: Invalid Metrics Key');
    }

    res.set('Content-Type', register.contentType)
    res.end(await register.metrics())
})

// Catch-all route for short URL redirection
app.get("/:id", redirectFromShortUrl)

// Error handler must be the last middleware
app.use(errorHandler)

// Prevent server crash on unhandled errors
process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(`${err.name}: ${err.message}`);
    process.exit(1);
});

const PORT = process.env.PORT || 3000
const server = app.listen(PORT, async () => {
    await connectDB()
    try {
        await initRedis()
    } catch (err) {
        logger.error(`Redis initialization failed: ${err}`);
    }
    logger.info(` Backend Server is running on http://localhost:${PORT}`);
})

// Termination signal handling
process.on('SIGTERM', () => {
    logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
    server.close(() => {
        logger.info('💥 Process terminated!');
    });
});
