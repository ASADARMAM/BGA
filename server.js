// WeCloud Server - Enterprise Edition
const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const cluster = require('cluster');
const os = require('os');

// Constants
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const WORKERS = IS_PRODUCTION ? os.cpus().length : 1;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // limit each IP to 100 requests per windowMs

// Cluster configuration for enterprise-scale
if (cluster.isMaster && WORKERS > 1) {
  console.log(`Master ${process.pid} is running`);
  
  // Fork workers based on CPU count
  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }
  
  // Handle worker events
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    cluster.fork(); // Replace dead worker
  });
} else {
  // Worker process - actual server code
  const app = express();
  
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: IS_PRODUCTION ? undefined : false,
    crossOriginEmbedderPolicy: IS_PRODUCTION
  }));
  
  // CORS configuration
  app.use(cors({
    origin: IS_PRODUCTION ? ['https://wecloud.com', /\.wecloud\.com$/] : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  
  // Rate limiting to prevent abuse
  const limiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use('/api/', limiter);
  
  // Compression for faster response times
  app.use(compression({
    level: 6,
    threshold: 1024, // only compress responses larger than 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  
  // Body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Serve static files with cache control
  const staticOptions = {
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // Set cache control headers based on file type
      if (path.endsWith('.html')) {
        // HTML files - short cache
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
      } else if (path.match(/\.(css|js)$/)) {
        // CSS/JS files - longer cache with revalidation
        res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate'); // 1 day
      } else if (path.match(/\.(jpg|jpeg|png|gif|ico|svg)$/)) {
        // Images - long cache
        res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days
      } else {
        // Other assets
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
      }
    }
  };
  
  app.use(express.static(path.join(__dirname, './'), staticOptions));
  
  // Basic health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
      workerId: cluster.worker ? cluster.worker.id : 'single'
    });
  });
  
  // API routes
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'operational',
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  });
  
  // Serve main HTML files
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
  
  app.get('/users', (req, res) => {
    res.sendFile(path.join(__dirname, 'users.html'));
  });
  
  app.get('/packages', (req, res) => {
    res.sendFile(path.join(__dirname, 'packages.html'));
  });
  
  app.get('/invoices', (req, res) => {
    res.sendFile(path.join(__dirname, 'invoices.html'));
  });
  
  app.get('/messages', (req, res) => {
    res.sendFile(path.join(__dirname, 'messages.html'));
  });
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
      error: IS_PRODUCTION ? 'Internal Server Error' : err.message,
      status: err.status || 500
    });
  });
  
  // Handle 404
  app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
  });
  
  // Start server
  app.listen(PORT, () => {
    console.log(`WeCloud server worker ${cluster.worker ? cluster.worker.id : 'single'} running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Server time: ${new Date().toISOString()}`);
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  function gracefulShutdown() {
    console.log(`Worker ${cluster.worker ? cluster.worker.id : 'single'} shutting down...`);
    // Close server connections
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    
    // Force close after 10s
    setTimeout(() => {
      console.error('Forcing server shutdown after timeout');
      process.exit(1);
    }, 10000);
  }
} 