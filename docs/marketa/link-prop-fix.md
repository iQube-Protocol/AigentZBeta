# Link Component Prop Fix

## Problem
After migrating from React Router to Next.js, the Link components were still using the `to` prop instead of the `href` prop, causing:
```
Failed prop type: The prop `href` expects a `string` or `object` in `<Link>`, but got `undefined` instead.
```

#### Root Cause
- Next.js `Link` component expects `href` prop
- React Router `Link` component uses `to` prop
- Migration was incomplete - only imports were changed, not prop usage

#### Solution Applied

### Files Fixed:

1. **`/app/(shell)/marketa/page.tsx`**
   - Changed all `<Link to="/path">` to `<Link href="/path">`
  - Fixed 8 Link components in Campaign Management section

2. **`/app/(shell)/marketa/campaigns/page.tsx`**
  - Changed `<Link to="/marketa/campaigns/${campaign.id}">` to `<Link href="/marketa/campaigns/${campaign.id}">`
  - Fixed 1 Link component in campaign list

3. **`/app/(shell)/marketa/campaigns/[id]/page.tsx`**
  - Changed `<Link to="/marketa/campaigns">` to `<Link href="/marketa/campaigns">`
  - Fixed 2 Link components in back navigation

### Changes Made:

#### Before:
```jsx
<Link to="/marketa/campaigns">
  <Target className="w-4 h-4 mr-2" />
  Manage Campaigns
</Link>
```

#### After:
```jsx
<Link href="/marketa/campaigns">
  <Target className="w-4 h-4 mr-2" />
  Manage Campaigns
</Link>
```

### Total Components Fixed: 11 Link components

## Result
✅ **Fixed**: All Link components now use correct Next.js `href` prop
✅ **Fixed**: No more "undefined href" prop errors
✅ **Fixed**: Navigation works correctly throughout Marketa Admin UI
✅ **Verified**: No remaining React Router imports or `to` props

The Marketa Admin UI should now work without any Link component prop errors.
