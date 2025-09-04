const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

// Rate limiting configuration
const createRateLimiter = (windowMs, max, message) => {
	return rateLimit({
		windowMs,
		max,
		message: {
			success: false,
			message:
				message || 'Too many requests from this IP, please try again later.',
		},
		standardHeaders: true,
		legacyHeaders: false,
	});
};

// General API rate limiter
const apiLimiter = createRateLimiter(
	15 * 60 * 1000, // 15 minutes
	100, // limit each IP to 100 requests per windowMs
	'Too many API requests from this IP, please try again later.'
);

// Strict rate limiter for sensitive endpoints
const strictLimiter = createRateLimiter(
	15 * 60 * 1000, // 15 minutes
	5, // limit each IP to 5 requests per windowMs
	'Too many requests for this endpoint, please try again later.'
);

// CORS configuration - allow all origins
const corsOptions = {
	origin: true, // Allow all origins
	credentials: true,
	optionsSuccessStatus: 200,
};

// Security middleware setup
const setupSecurity = (app) => {
	// Basic security headers
	app.use(helmet());

	// CORS
	app.use(cors(corsOptions));

	// Rate limiting - relaxed for development
	// Removed strict rate limiting for chambers and alarms endpoints

	// Additional security headers
	app.use((req, res, next) => {
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.setHeader('X-Frame-Options', 'DENY');
		res.setHeader('X-XSS-Protection', '1; mode=block');
		next();
	});
};

module.exports = {
	setupSecurity,
	apiLimiter,
	strictLimiter,
};
