# AA API Proxy Architectural Rule (MUST NOT BE BYPASSED)

**Status**: ENFORCED - Permanent Architecture Decision  
**Effective**: 2026-02-24  
**Reason**: Prevent iframe 404 errors and ensure fallback protection

---

## 🚨 **CRITICAL RULE: NEVER USE RAILWAY DIRECTLY**

### **✅ CORRECT: Always use aa-proxy**
```
https://bsjhfvctmduxhohtllly.supabase.co/functions/v1/aa-proxy/aa/v1/runtime/*
```

### **🚫 FORBIDDEN: Never use Railway directly**
```
https://aigentzbeta-production.up.railway.app/aa/v1/runtime/*
```

---

## **Why This Rule Exists**

1. **Iframe URL Normalization**: aa-proxy fixes bad `/runtime` → `/metame/runtime?embed=1`
2. **Fallback Protection**: Railway fails → dev-beta.aigentz.me automatically
3. **CORS Safety**: Proper headers for cross-origin requests
4. **Safety Net**: Protection against upstream deployment lag

---

## **Implementation Evidence**

### **Runtime Fix Commit**
- **File**: `services/aa-api/src/routes/runtime.ts:338`
- **Commit**: `215ede4` - "Fix iframe URL normalization in runtime shell-config"
- **Normalization**: `/runtime` and `/` → `/metame/runtime` + `embed=1`

### **Proxy Safety Net**
- **File**: `supabase/functions/aa-proxy/index.ts`
- **Function**: `normalizeShellConfigResponse()`
- **Purpose**: In-flight URL normalization for upstream protection

---

## **Enforcement Points**

1. **Documentation**: This file is referenced in multiple locations
2. **Code Comments**: Added to all relevant API integration points
3. **QubeTalk Memory**: Posted as persistent channel memory
4. **Build Checks**: Consider adding validation to prevent direct Railway URLs

---

## **Violations to Watch For**

- Any code containing `aigentzbeta-production.up.railway.app`
- Environment variables pointing directly to Railway
- API clients configured to bypass aa-proxy
- Documentation showing Railway endpoints as primary

---

## **Valid Use Cases for Railway Direct**

1. **Testing/Debugging**: Temporary direct testing ONLY
2. **Infrastructure Monitoring**: Health checks of Railway itself
3. **Migration**: During controlled cutover periods (with announcement)

---

## **Recovery Process**

If direct Railway usage is discovered:
1. **Immediate**: Switch to aa-proxy endpoint
2. **Investigation**: Why bypass occurred
3. **Documentation**: Update any misleading docs
4. **Communication**: Notify all teams of correct usage

---

**This rule is permanent and cannot be overridden without explicit architectural review.**
