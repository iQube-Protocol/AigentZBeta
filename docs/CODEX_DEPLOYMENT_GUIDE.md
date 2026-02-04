# Multi-Codex System - Deployment Guide

## Pre-Deployment Checklist

### 1. Code Quality
- [x] Build completes successfully (`npm run build`)
- [x] No TypeScript errors
- [x] No ESLint critical warnings
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing

### 2. Database Preparation
- [ ] Supabase migrations applied
- [ ] RLS policies configured
- [ ] Initial codex data seeded
- [ ] Database backups created
- [ ] Connection pooling configured

### 3. Environment Configuration
- [ ] Production environment variables set
- [ ] API keys configured
- [ ] CORS settings updated
- [ ] Rate limiting configured
- [ ] CDN endpoints configured

### 4. API Testing
- [ ] All codex registry endpoints tested
- [ ] Content APIs responding
- [ ] Authentication working
- [ ] Permission checks functional
- [ ] Error handling verified

### 5. Performance Optimization
- [ ] Images optimized
- [ ] Code splitting configured
- [ ] Lazy loading implemented
- [ ] Cache headers set
- [ ] CDN configured

### 6. Security Audit
- [ ] RLS policies reviewed
- [ ] API authentication verified
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented
- [ ] Rate limiting active

### 7. Monitoring Setup
- [ ] Error tracking configured (Sentry)
- [ ] Analytics implemented
- [ ] Performance monitoring active
- [ ] Uptime monitoring configured
- [ ] Alert thresholds set

## Deployment Steps

### Step 1: Database Migration

```bash
# Apply Supabase migrations
supabase db push

# Verify migration
supabase db diff

# Seed initial data
npm run db:seed
```

**Verification**:
```sql
-- Check codex_registry table
SELECT * FROM codex_registry;

-- Check codex_tabs table
SELECT * FROM codex_tabs;

-- Verify RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('codex_registry', 'codex_tabs');
```

### Step 2: Environment Variables

**Required Variables**:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Configuration
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Feature Flags
NEXT_PUBLIC_ENABLE_CODEX_MANAGEMENT=true
NEXT_PUBLIC_ENABLE_COPILOT_ACTIONS=false

# Analytics
NEXT_PUBLIC_GA_ID=your-ga-id
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

### Step 3: Build Production Bundle

```bash
# Clean previous builds
rm -rf .next

# Build for production
npm run build

# Verify build output
ls -la .next/

# Test production build locally
npm run start
```

**Build Verification**:
- [ ] No build errors
- [ ] Bundle size acceptable (<500KB initial)
- [ ] All routes accessible
- [ ] Static assets loading

### Step 4: Deploy to Vercel/Netlify

#### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

**Vercel Configuration** (`vercel.json`):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key"
  }
}
```

#### Netlify Deployment

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy to preview
netlify deploy

# Deploy to production
netlify deploy --prod
```

**Netlify Configuration** (`netlify.toml`):
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Step 5: DNS & SSL Configuration

**DNS Records**:
```
A     @           76.76.21.21
CNAME www         your-app.vercel.app
CNAME api         your-api.vercel.app
```

**SSL Certificate**:
- [ ] SSL certificate issued
- [ ] HTTPS redirect enabled
- [ ] HSTS header configured
- [ ] Certificate auto-renewal enabled

### Step 6: CDN Configuration

**Cloudflare Settings**:
- [ ] Caching rules configured
- [ ] Page rules set
- [ ] Firewall rules active
- [ ] DDoS protection enabled
- [ ] Bot management configured

**Cache Rules**:
```
/api/*              - No cache
/triad/embed/*      - Cache 1 hour
/_next/static/*     - Cache 1 year
/images/*           - Cache 1 month
```

### Step 7: Monitoring & Alerts

**Sentry Configuration**:
```typescript
// sentry.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filter sensitive data
    return event;
  }
});
```

**Alert Configuration**:
- [ ] Error rate > 1% triggers alert
- [ ] Response time > 3s triggers alert
- [ ] Uptime < 99.9% triggers alert
- [ ] Database connection failures alert

### Step 8: Post-Deployment Verification

**Smoke Tests**:
```bash
# Test homepage
curl -I https://your-domain.com

# Test codex registry API
curl https://your-domain.com/api/codex/registry

# Test KNYT Codex embed
curl https://your-domain.com/triad/embed/codex/knyt

# Test admin UI
curl https://your-domain.com/admin/codex
```

**Functional Tests**:
- [ ] All three codexes load
- [ ] Tab navigation works
- [ ] Content displays correctly
- [ ] SmartActions functional
- [ ] Admin UI accessible
- [ ] API responses valid

## Rollback Procedure

### Quick Rollback

```bash
# Vercel
vercel rollback

# Netlify
netlify rollback
```

### Manual Rollback

1. **Identify Last Good Deployment**:
   ```bash
   vercel ls
   ```

2. **Promote Previous Deployment**:
   ```bash
   vercel promote <deployment-url>
   ```

3. **Verify Rollback**:
   ```bash
   curl -I https://your-domain.com
   ```

4. **Database Rollback** (if needed):
   ```bash
   supabase db reset
   supabase db push --include-seed
   ```

## Monitoring Checklist

### Day 1 Post-Deployment
- [ ] Monitor error rates (target: <0.1%)
- [ ] Check response times (target: <1s)
- [ ] Verify uptime (target: 100%)
- [ ] Review user feedback
- [ ] Check database performance

### Week 1 Post-Deployment
- [ ] Analyze usage patterns
- [ ] Review performance metrics
- [ ] Check for memory leaks
- [ ] Optimize slow queries
- [ ] Update documentation

### Month 1 Post-Deployment
- [ ] Conduct security audit
- [ ] Review scaling needs
- [ ] Plan feature enhancements
- [ ] Gather user feedback
- [ ] Optimize costs

## Performance Benchmarks

### Target Metrics
- **Time to First Byte (TTFB)**: <200ms
- **First Contentful Paint (FCP)**: <1.5s
- **Largest Contentful Paint (LCP)**: <2.5s
- **Time to Interactive (TTI)**: <3.5s
- **Cumulative Layout Shift (CLS)**: <0.1

### API Response Times
- **GET /api/codex/registry**: <500ms
- **GET /api/codex/registry/{id}**: <300ms
- **POST /api/codex/registry**: <1s
- **Content APIs**: <800ms

### Database Performance
- **Query time**: <100ms (95th percentile)
- **Connection pool**: 10-20 connections
- **Cache hit rate**: >80%

## Scaling Strategy

### Horizontal Scaling
- **Vercel**: Auto-scales with serverless functions
- **Database**: Supabase connection pooling
- **CDN**: Cloudflare global distribution

### Vertical Scaling
- **Database**: Upgrade Supabase plan if needed
- **Compute**: Increase Vercel function memory
- **Storage**: Expand CDN cache size

### Load Testing
```bash
# Install k6
brew install k6

# Run load test
k6 run loadtest.js

# Test scenarios
- 100 concurrent users
- 1000 requests/second
- 10 minute duration
```

## Disaster Recovery

### Backup Strategy
- **Database**: Daily automated backups
- **Code**: Git repository + GitHub
- **Assets**: CDN + S3 backup
- **Configuration**: Environment variables documented

### Recovery Procedures

**Database Failure**:
1. Switch to Supabase backup
2. Restore from latest snapshot
3. Verify data integrity
4. Resume operations

**Application Failure**:
1. Rollback to previous deployment
2. Investigate root cause
3. Fix and redeploy
4. Monitor closely

**CDN Failure**:
1. Switch to backup CDN
2. Update DNS records
3. Verify asset delivery
4. Monitor performance

## Security Hardening

### Headers Configuration
```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ];
  }
};
```

### Rate Limiting
```typescript
// middleware.ts
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export async function middleware(request: Request) {
  const ip = request.headers.get('x-forwarded-for');
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return new Response('Too Many Requests', { status: 429 });
  }
}
```

## Compliance & Legal

### GDPR Compliance
- [ ] Privacy policy updated
- [ ] Cookie consent implemented
- [ ] Data retention policy defined
- [ ] User data export available
- [ ] Right to deletion implemented

### Accessibility
- [ ] WCAG 2.1 Level AA compliance
- [ ] Screen reader tested
- [ ] Keyboard navigation functional
- [ ] Color contrast verified
- [ ] Alt text for images

## Documentation Updates

### User Documentation
- [ ] User guide updated
- [ ] API documentation published
- [ ] Video tutorials created
- [ ] FAQ updated
- [ ] Changelog published

### Developer Documentation
- [ ] Architecture diagrams updated
- [ ] API reference complete
- [ ] Integration guides written
- [ ] Troubleshooting guide updated
- [ ] Contributing guidelines published

## Success Criteria

### Technical Success
- ✅ Zero downtime deployment
- ✅ All tests passing
- ✅ Performance benchmarks met
- ✅ Security audit passed
- ✅ Monitoring active

### Business Success
- ✅ User adoption > 80%
- ✅ Error rate < 0.1%
- ✅ User satisfaction > 4.5/5
- ✅ Support tickets < 10/week
- ✅ Revenue impact positive

## Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify all features working
- [ ] Respond to user feedback
- [ ] Document any issues

### Short-term (Week 1)
- [ ] Optimize based on metrics
- [ ] Fix any bugs discovered
- [ ] Update documentation
- [ ] Plan next iteration
- [ ] Gather user feedback

### Long-term (Month 1)
- [ ] Conduct retrospective
- [ ] Plan feature enhancements
- [ ] Review scaling needs
- [ ] Update roadmap
- [ ] Celebrate success! 🎉

## Contact Information

### On-Call Rotation
- **Primary**: DevOps Team
- **Secondary**: Backend Team
- **Escalation**: CTO

### Emergency Contacts
- **Vercel Support**: support@vercel.com
- **Supabase Support**: support@supabase.io
- **Cloudflare Support**: support@cloudflare.com

## Conclusion

This deployment guide ensures a smooth, secure, and successful rollout of the multi-codex system. Follow each step carefully, verify at each stage, and maintain comprehensive monitoring post-deployment.

**Remember**: It's better to delay deployment than to rush and encounter issues in production. Take your time, test thoroughly, and deploy with confidence.

Good luck! 🚀
