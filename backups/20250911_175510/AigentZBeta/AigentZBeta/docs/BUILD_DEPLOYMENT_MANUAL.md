# Build & Deployment Manual

## Prerequisites

### System Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher (or pnpm 8.0.0+)
- **Python**: 3.8+ (for backend services)
- **Git**: Latest version
- **tmux**: For unified development environment (optional)

### Development Tools
- **TypeScript**: 5.0+
- **Next.js**: 14.2+
- **React**: 18.0+
- **Tailwind CSS**: 3.0+

## Installation

### 1. Clone Repository
```bash
git clone https://github.com/your-organization/AigentZBeta.git
cd AigentZBeta
```

### 2. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# Or using pnpm (recommended)
pnpm install

# Install Python dependencies (if backend is needed)
pip install -r requirements.txt
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env.local

# Edit environment variables
nano .env.local
```

### Required Environment Variables
```env
# Core API Configuration
NEXT_PUBLIC_CORE_API_URL=http://localhost:8000
CORE_API_KEY=your_api_key_here

# Registry API Configuration  
NEXT_PUBLIC_REGISTRY_API_URL=http://localhost:8001
REGISTRY_API_KEY=your_registry_api_key_here

# Aigent Configuration
NEXT_PUBLIC_AIGENT_API_URL=http://localhost:8002
AIGENT_API_KEY=your_aigent_api_key_here

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/aigent_db

# Blockchain Configuration
WEB3_PROVIDER_URL=https://mainnet.infura.io/v3/your_project_id
PRIVATE_KEY=your_private_key_here
```

## Development

### Local Development Server
```bash
# Start development server
npm run dev

# Or with pnpm
pnpm dev

# Server will start on http://localhost:3000
```

### Unified Development Environment
```bash
# Make script executable
chmod +x start_dev.sh

# Start both frontend and backend
./start_dev.sh
```

### Development Commands
```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Testing
npm run test
npm run test:watch
npm run test:coverage

# Build for production
npm run build

# Start production server
npm start
```

## Build Process

### 1. Pre-build Validation
```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Run tests
npm run test
```

### 2. Production Build
```bash
# Create optimized production build
npm run build

# Verify build output
ls -la .next/
```

### 3. Build Optimization
The build process includes:
- **TypeScript compilation** with strict type checking
- **Code splitting** for optimal loading
- **Bundle optimization** and minification
- **Static asset optimization** (images, fonts, etc.)
- **CSS optimization** with Tailwind CSS purging

## Deployment

### Vercel Deployment (Recommended)

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Deploy to Vercel
```bash
# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Or deploy preview
vercel
```

#### 3. Environment Variables
Set environment variables in Vercel dashboard:
1. Go to Project Settings
2. Navigate to Environment Variables
3. Add all required variables from `.env.local`

### Docker Deployment

#### 1. Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

#### 2. Build and Run Docker Container
```bash
# Build Docker image
docker build -t aigent-zbeta .

# Run container
docker run -p 3000:3000 --env-file .env.local aigent-zbeta
```

### Manual Server Deployment

#### 1. Build Application
```bash
npm run build
```

#### 2. Transfer Files
```bash
# Copy build files to server
scp -r .next/ package.json user@server:/path/to/app/
```

#### 3. Server Setup
```bash
# On server - install dependencies
npm ci --only=production

# Start with PM2
pm2 start npm --name "aigent-zbeta" -- start

# Or with systemd
sudo systemctl start aigent-zbeta
```

## Production Configuration

### Performance Optimization
```javascript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
    optimizeImages: true,
  },
  images: {
    domains: ['your-cdn-domain.com'],
    formats: ['image/webp', 'image/avif'],
  },
  compress: true,
  poweredByHeader: false,
}
```

### Security Headers
```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}
```

## Monitoring & Maintenance

### Health Checks
```bash
# Check application status
curl http://localhost:3000/api/health

# Monitor logs
tail -f logs/application.log

# Check performance
npm run analyze
```

### Database Maintenance
```bash
# Run migrations
npm run db:migrate

# Backup database
pg_dump aigent_db > backup_$(date +%Y%m%d).sql

# Restore database
psql aigent_db < backup_20240101.sql
```

### Updates and Patches
```bash
# Update dependencies
npm update

# Security audit
npm audit
npm audit fix

# Update Next.js
npm install next@latest react@latest react-dom@latest
```

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear Next.js cache
rm -rf .next/

# Clear node_modules
rm -rf node_modules/
npm install

# Check Node.js version
node --version
```

#### Runtime Errors
```bash
# Check logs
npm run logs

# Debug mode
DEBUG=* npm run dev

# Memory issues
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

#### Performance Issues
```bash
# Analyze bundle
npm run analyze

# Check lighthouse score
npx lighthouse http://localhost:3000

# Profile application
npm run profile
```

### Error Resolution

#### TypeScript Errors
- Ensure all dependencies are up to date
- Check `tsconfig.json` configuration
- Verify type definitions are installed

#### CSS/Styling Issues
- Clear Tailwind CSS cache
- Verify PostCSS configuration
- Check for conflicting styles

#### API Connection Issues
- Verify environment variables
- Check API endpoint availability
- Review CORS configuration

## Backup & Recovery

### Backup Strategy
```bash
# Backup source code
git push origin main

# Backup database
pg_dump -h localhost -U user aigent_db > backup.sql

# Backup environment files
cp .env.local .env.backup

# Backup user uploads
tar -czf uploads_backup.tar.gz public/uploads/
```

### Recovery Process
```bash
# Restore from git
git clone https://github.com/your-org/AigentZBeta.git
cd AigentZBeta

# Restore database
psql -h localhost -U user -d aigent_db < backup.sql

# Restore environment
cp .env.backup .env.local

# Rebuild application
npm install
npm run build
```

## Security Considerations

### Production Security
- Use HTTPS in production
- Implement proper CORS policies
- Secure API endpoints with authentication
- Regular security audits and updates
- Monitor for vulnerabilities

### Environment Security
- Never commit `.env` files
- Use secure key management
- Implement proper access controls
- Regular password rotation

## Support & Documentation

### Getting Help
- Check documentation in `/docs/` directory
- Review GitHub issues and discussions
- Contact development team for critical issues

### Contributing
- Follow contribution guidelines
- Submit pull requests for improvements
- Report bugs with detailed information
- Suggest enhancements through issues

---

**Note**: This manual is updated regularly. Always refer to the latest version for current procedures and best practices.
