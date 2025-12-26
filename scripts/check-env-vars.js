// Diagnostic script to check if env vars are loaded
console.log('=== ENV VAR CHECK ===');
console.log('PAYPAL_MODE:', process.env.PAYPAL_MODE || 'UNDEFINED');
console.log('PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID ? 'DEFINED (len=' + process.env.PAYPAL_CLIENT_ID.length + ')' : 'UNDEFINED');
console.log('PAYPAL_CLIENT_SECRET:', process.env.PAYPAL_CLIENT_SECRET ? 'DEFINED (len=' + process.env.PAYPAL_CLIENT_SECRET.length + ')' : 'UNDEFINED');
console.log('====================');
