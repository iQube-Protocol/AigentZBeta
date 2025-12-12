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

## 🚨 MANDATORY PRE-DEPLOYMENT CHECKLIST

**⚠️ CRITICAL: Run these checks BEFORE every deployment to AWS Amplify or any production environment**

### Step 1: TypeScript Compilation Check
```bash
# Check ALL TypeScript files for type errors
npx tsc --noEmit

# This MUST return with exit code 0 (no errors)
# If errors appear, fix them BEFORE pushing to dev/main
```

**Why this is mandatory:**
- AWS Amplify uses a clean build environment
- Type errors that seem to work locally will fail in production
- Catches optional vs required property mismatches
- Identifies missing type guards and invalid property accesses
- Prevents iterative deployment failures (lesson learned: 33 failed builds)

### Step 2: Dependency Lock File Sync
```bash
# If you added/updated dependencies, regenerate lock file
npm install

# Verify both files will be committed
git status | grep -E "(package.json|package-lock.json)"

# BOTH package.json AND package-lock.json must be committed together
git add package.json package-lock.json
```

**Why this is mandatory:**
- AWS Amplify uses `npm ci` which requires perfect lock file sync
- Missing dependencies in lock file cause immediate build failure
- Ensures reproducible builds across environments

### Step 3: Local Build Verification
```bash
# Run production build locally
npm run build

# This should complete without errors
# Fix any build warnings or errors before deploying
```

### Step 4: Pre-Deployment Checklist
✅ `npx tsc --noEmit` returns 0 errors  
✅ `package-lock.json` is in sync with `package.json`  
✅ `npm run build` completes successfully  
✅ All environment variables documented in `.env.example`  
✅ No `console.log` or debug code in production files  
✅ All changes committed and pushed to correct branch  

**🛑 DO NOT DEPLOY if any checklist item fails**

---

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

### AWS Amplify Deployment

**⚠️ IMPORTANT: Complete the MANDATORY PRE-DEPLOYMENT CHECKLIST before deploying to Amplify**

#### 1. Initial Setup
```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Configure Amplify
amplify configure
```

#### 2. Connect Repository
1. Log into AWS Amplify Console
2. Click "New app" → "Host web app"
3. Connect your GitHub repository
4. Select the branch to deploy (typically `main` or `dev`)
5. Amplify will auto-detect Next.js framework

#### 3. Build Settings
Amplify will auto-generate `amplify.yml`. Verify it includes:
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        # CRITICAL: Uses npm ci which requires package-lock.json sync
        - npm ci
    build:
      commands:
        # TypeScript compilation happens here
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

#### 4. Environment Variables
In Amplify Console:
1. Go to App Settings → Environment variables
2. Add all variables from `.env.local`
3. Mark sensitive variables as "secret"
4. Save and redeploy

#### 5. Pre-Deployment Verification
**Run these commands locally BEFORE pushing:**
```bash
# 1. TypeScript check (MANDATORY)
npx tsc --noEmit

# 2. Verify lock file (if dependencies changed)
npm install
git add package.json package-lock.json

# 3. Local build test
npm run build

# 4. Commit and push
git commit -m "feat: your changes"
git push origin dev
```

#### 6. Common Amplify Build Issues

**Issue: "Missing: [package] from lock file"**
- **Cause:** `package-lock.json` out of sync with `package.json`
- **Fix:** Run `npm install` locally and commit both files

**Issue: TypeScript compilation errors**
- **Cause:** Type errors not caught locally
- **Fix:** Always run `npx tsc --noEmit` before pushing

**Issue: "Cannot find module 'xyz'"**
- **Cause:** Dependency missing from `package.json`
- **Fix:** Install and add to `package.json`, commit lock file

#### 7. Monitoring Deployment
```bash
# View build logs in Amplify Console
# Each phase shows detailed output:
# - Provision: Environment setup
# - Build: npm ci, npm run build
# - Deploy: Artifact deployment
# - Verify: Health checks
```

**Build typically takes 2-5 minutes for successful deployment**

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
