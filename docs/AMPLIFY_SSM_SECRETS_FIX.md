# Amplify SSM Secrets Permission Fix

## Problem

Build logs show:
```
!Failed to set up process.env.secrets
```

This means Amplify cannot read SSM Parameter Store secrets, causing environment variables to be undefined at build and runtime.

## Root Cause

The Amplify app service role lacks required IAM permissions to read SSM parameters under `/amplify/<appId>/...`.

Reference: https://github.com/aws-amplify/amplify-hosting/issues/3966

## Solution A: Fix IAM Role (Recommended for Production)

### Step 1: Find Your Amplify Service Role

1. Go to AWS Amplify Console → Your App → App settings → General
2. Note the **Service role** name (e.g., `amplifyconsole-backend-role`)

### Step 2: Add SSM Permissions

1. Go to AWS IAM Console → Roles
2. Search for your Amplify service role
3. Click **Add permissions** → **Create inline policy**
4. Switch to **JSON** tab and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AmplifyReadSSMSecrets",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParametersByPath",
        "ssm:GetParameters",
        "ssm:GetParameter"
      ],
      "Resource": [
        "arn:aws:ssm:*:*:parameter/amplify/*"
      ]
    },
    {
      "Sid": "DecryptIfSecureString",
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "*"
    }
  ]
}
```

5. Name the policy: `AmplifySSMSecretsAccess`
6. Click **Create policy**

### Step 3: Redeploy

Trigger a new deployment. The `!Failed to set up process.env.secrets` warning should disappear, and the diagnostic output should show `[SET]` for all variables.

## Solution B: Fallback (Fast but Less Secure)

If you need to unblock immediately and IAM changes are delayed:

1. Go to AWS Amplify Console → Your App → Environment variables
2. Add variables as **plain environment variables** (not Secrets Manager):
   - `PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`
   - `PAYPAL_MODE`
3. Redeploy

**Note:** This makes secrets visible in the Amplify Console. Use Solution A for production.

## Verification

After applying the fix, check the build logs for:

```
=== .env.production keys + empty-check (REDACTED) ===
PAYPAL_MODE=[SET]
PAYPAL_CLIENT_ID=[SET]
PAYPAL_CLIENT_SECRET=[SET]
...
```

All critical variables should show `[SET]` instead of `[EMPTY]`.

## AWS Documentation

- [Making environment variables accessible to server-side runtimes](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-environment-variables.html)
- [Known issue: SSM secrets not accessible](https://github.com/aws-amplify/amplify-hosting/issues/3966)
