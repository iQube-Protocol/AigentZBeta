# Development Workflow

## 🎯 Git Branch Strategy

### Branch Structure
```
main (production)
  ↑
dev (staging/testing)
  ↑
feat/feature-name (feature branches)
fix/bug-name (bug fix branches)
```

---

## 📋 Standard Development Process

### 1. Create Feature Branch from Dev

```bash
# Make sure dev is up to date
git checkout dev
git pull origin dev

# Create new feature branch
git checkout -b feat/your-feature-name
```

**Branch Naming Convention:**
- `feat/` - New features (e.g., `feat/qct-reserve-system`)
- `fix/` - Bug fixes (e.g., `fix/eslint-errors`)
- `docs/` - Documentation only (e.g., `docs/api-reference`)
- `refactor/` - Code refactoring (e.g., `refactor/wallet-service`)
- `test/` - Test additions (e.g., `test/qct-mint-burn`)

---

### 2. Make Changes & Commit Locally

```bash
# Make your changes
# ...

# Check what changed
git status
git diff

# Stage changes
git add -A

# Commit with descriptive message
git commit -m "feat: Add QCT reserve system

- Created MockUSDC contract
- Created QCTReserve contract
- Added mint/burn UI
- Fixed ESLint errors"
```

---

### 3. Run Local Checks BEFORE Pushing

```bash
# Run linter
npm run lint

# Run build (if applicable)
npm run build

# Run tests (if applicable)
npm test
```

**✅ Only proceed if all checks pass!**

---

### 4. Push Feature Branch to GitHub

```bash
# Push feature branch (NOT dev)
git push origin feat/your-feature-name
```

---

### 5. Create Pull Request on GitHub

**Go to GitHub:**
1. Navigate to https://github.com/iQube-Protocol/AigentZBeta
2. Click "Pull requests" tab
3. Click "New pull request"
4. Set:
   - **Base:** `dev`
   - **Compare:** `feat/your-feature-name`
5. Review the diff
6. Click "Create pull request"
7. Fill in PR template:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Linter passes
- [ ] Build succeeds
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
```

---

### 6. Review PR & Check CI/CD

**GitHub will automatically:**
- Show file diffs
- Highlight conflicts (if any)
- Run CI checks (if configured)

**Review checklist:**
- ✅ All files look correct
- ✅ No unintended changes
- ✅ No merge conflicts
- ✅ CI checks pass (green)

---

### 7. Merge PR to Dev

**Options:**
1. **Merge commit** (preserves full history)
2. **Squash and merge** (cleaner history, recommended)
3. **Rebase and merge** (linear history)

**Recommended:** Squash and merge

```bash
# After PR is merged on GitHub, update local dev
git checkout dev
git pull origin dev

# Delete local feature branch
git branch -d feat/your-feature-name

# Delete remote feature branch (optional)
git push origin --delete feat/your-feature-name
```

---

### 8. Amplify Auto-Deploys Dev

**AWS Amplify watches `dev` branch:**
- Detects new commits
- Runs build automatically
- Deploys to https://dev-beta.aigentz.me
- Shows build logs

**Monitor deployment:**
1. Go to AWS Amplify console
2. Check build status
3. Review logs if failed
4. Test deployed changes

---

## 🚨 What We Did Wrong (Learning)

### ❌ Bad Practice (What We Did)
```bash
# Working directly on dev
git checkout dev
git add -A
git commit -m "changes"
git push origin dev  # ← Triggers immediate deployment!
```

**Problems:**
- No review before deployment
- Can't catch errors before they go live
- Hard to rollback
- No discussion/approval process

### ✅ Good Practice (What We Should Do)
```bash
# Work on feature branch
git checkout -b feat/new-feature
git add -A
git commit -m "changes"
git push origin feat/new-feature  # ← Safe, no deployment

# Create PR on GitHub
# Review changes
# Check for errors
# Merge when ready → THEN deploys
```

**Benefits:**
- Review changes before deployment
- Catch errors in PR review
- Easy to rollback (just close PR)
- Team can discuss changes
- CI/CD runs checks first

---

## 🔧 Emergency Hotfix Process

**For critical production bugs:**

```bash
# Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b fix/critical-bug

# Make fix
# Test thoroughly
git add -A
git commit -m "fix: Critical bug description"

# Push and create PR to main
git push origin fix/critical-bug

# After merge, also merge to dev
git checkout dev
git merge main
git push origin dev
```

---

## 📊 Branch Lifecycle Example

```
Day 1:
  dev (commit A)
    ↓
  feat/qct-reserve (commit B, C, D)
    ↓
  Push to GitHub
    ↓
  Create PR: feat/qct-reserve → dev
    ↓
  Review on GitHub (check diff, no errors)
    ↓
  Merge PR (squash commits B, C, D → E)
    ↓
  dev (commit A, E)
    ↓
  Amplify deploys automatically ✅

Day 2:
  Delete feat/qct-reserve branch
  Start new feat/next-feature from dev
```

---

## 🎯 Quick Reference Commands

```bash
# Start new feature
git checkout dev && git pull origin dev
git checkout -b feat/feature-name

# Check before pushing
npm run lint && npm run build

# Push feature branch
git push origin feat/feature-name

# After PR merged, cleanup
git checkout dev && git pull origin dev
git branch -d feat/feature-name

# Emergency: Undo last commit (before push)
git reset --soft HEAD~1

# Emergency: Revert pushed commit
git revert <commit-hash>
git push origin dev
```

---

## 🔍 PR Review Checklist

**Before creating PR:**
- [ ] Linter passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console errors
- [ ] No unintended file changes
- [ ] Commit messages are clear

**During PR review:**
- [ ] Read all file diffs
- [ ] Check for security issues
- [ ] Verify no secrets/keys committed
- [ ] Ensure tests pass
- [ ] Check for breaking changes

**After PR merged:**
- [ ] Monitor Amplify deployment
- [ ] Test on dev environment
- [ ] Update documentation if needed
- [ ] Notify team of changes

---

## 📝 Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

**Example:**
```
feat: Add QCT reserve mint/burn system

Created complete reserve infrastructure:
- MockUSDC contract for testing
- QCTReserve contract with 100:1 ratio
- Mint/burn UI modal
- Integration with QCT Trading Card

Closes #123
```

---

## 🎉 Summary

**Always:**
1. Create feature branch
2. Make changes locally
3. Test locally (lint + build)
4. Push feature branch
5. Create PR on GitHub
6. Review diff
7. Merge when ready
8. Amplify deploys automatically

**Never:**
- Push directly to `dev` or `main`
- Skip linting/building locally
- Merge without reviewing
- Deploy without testing

---

**This workflow prevents deployment failures and makes development safer!** ✅
