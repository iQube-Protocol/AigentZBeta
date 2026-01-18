# React Router to Next.js Migration Fix

## Problem
The Marketa Admin UI implementation was using `react-router-dom` components in a Next.js application, causing the error:
```
react__WEBPACK_IMPORTED_MODULE_0__.useContext(...) is null
```

## Root Cause
- Next.js App Router uses its own routing system
- `react-router-dom`'s `Link` component and `useParams` hook are incompatible with Next.js
- The conflict caused React context to be null during component rendering

## Solution Applied

### 1. Replace React Router imports with Next.js equivalents

#### Before (React Router):
```typescript
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
```

#### After (Next.js):
```typescript
import Link from 'next/link';
// useParams handled differently in Next.js App Router
```

### 2. Fix dynamic routing in campaign detail page

#### Before (React Router):
```typescript
const { id } = useParams<{ id: string }>();
```

#### After (Next.js App Router):
```typescript
export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>('');

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
    };
    getParams();
  }, [params]);

  useEffect(() => {
    if (id) {
      loadCampaignData();
    }
  }, [id]);
```

### 3. Files Modified

1. **`/app/(shell)/marketa/page.tsx`**
   - Replaced `import { Link } from 'react-router-dom'` with `import Link from 'next/link'`

2. **`/app/(shell)/marketa/campaigns/page.tsx`**
   - Replaced `import { Link } from 'react-router-dom'` with `import Link from 'next/link'`

3. **`/app/(shell)/marketa/campaigns/[id]/page.tsx`**
   - Replaced `import { Link } from 'react-router-dom'` with `import Link from 'next/link'`
   - Removed `import { useParams } from 'react-router-dom'`
   - Updated component to handle Next.js App Router async params pattern

4. **`/app/(shell)/marketa/assets/page.tsx`**
   - No changes needed (didn't use React Router)

## Key Differences Between React Router and Next.js

### Navigation Components
- **React Router**: `<Link to="/path">`
- **Next.js**: `<Link href="/path">`

### Dynamic Route Parameters
- **React Router**: `const { id } = useParams()`
- **Next.js App Router**: `params` prop is a Promise, requires async handling

### Route Structure
- **React Router**: Client-side routing only
- **Next.js**: Server-side + client-side hybrid routing

## Result
✅ **Fixed**: React context null error resolved
✅ **Fixed**: Navigation works correctly with Next.js routing
✅ **Fixed**: Dynamic route parameters properly resolved
✅ **Maintained**: All functionality preserved with Next.js-compatible implementation

The Marketa Admin UI now works seamlessly within the Next.js App Router architecture without any React Router conflicts.
