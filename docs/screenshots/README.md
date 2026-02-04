# Screenshots Directory

This directory contains screenshots for the AigentZ documentation.

## Screenshot Guidelines

### Required Screenshots

1. **Registry Interface** (`registry-overview.png`)
   - Main registry page with template grid
   - Show filter controls and search
   - Include header with "Add New iQube" button
   - Display various template cards

2. **Template Card States** (`template-card-states.png`)
   - Show all three badge states side by side:
     - Library (Private) - Blue badge
     - Registry (Public) - Green badge  
     - Registry (Private) - Orange badge
   - Include hover states and action buttons

3. **Minting Dialog** (`minting-dialog.png`)
   - Confirmation dialog for minting
   - Show Public/Private selection options
   - Include cancel and confirm buttons

4. **Operations Console** (`ops-console.png`)
   - Network monitoring dashboard
   - Show status cards for different networks
   - Include health indicators

5. **Cross-Chain Status** (`cross-chain-status.png`)
   - DVN monitoring interface
   - Transaction status indicators
   - Network connectivity status

### Screenshot Standards

- **Dimensions**: 1920x1080 (desktop) or equivalent
- **Format**: PNG with compression
- **Quality**: High resolution, readable text
- **Browser**: Chrome/Firefox with developer tools hidden
- **Theme**: Dark mode (default application theme)

### Capture Instructions

1. **Preparation**:
   ```bash
   # Start development server
   make dev
   
   # Navigate to desired page
   # Clear browser cache
   # Ensure proper data is loaded
   ```

2. **Capture Tools**:
   - macOS: Cmd+Shift+4 (selection) or Cmd+Shift+3 (full screen)
   - Windows: Win+Shift+S (selection) or Snipping Tool
   - Browser extensions: GoFullPage, FireShot

3. **Editing**:
   - Remove sensitive information (API keys, personal data)
   - Ensure consistent sizing across screenshots
   - Add subtle shadows or borders if needed
   - Optimize file size without losing quality

### File Naming Convention

- Use kebab-case for filenames
- Include descriptive names
- Maintain consistent style:
  ```
  registry-overview.png
  template-card-states.png
  minting-dialog.png
  ops-console.png
  cross-chain-status.png
  ```

### Alt Text Guidelines

Each screenshot should include descriptive alt text:

```markdown
![Registry Interface showing template grid with filters and action buttons](./registry-overview.png)
```

### Updating Screenshots

When the UI changes:

1. Update screenshots in this directory
2. Update references in documentation
3. Test all documentation links
4. Update version number in this README

### Current Status

- [ ] registry-overview.png
- [ ] template-card-states.png  
- [ ] minting-dialog.png
- [ ] ops-console.png
- [ ] cross-chain-status.png

### Automated Screenshot Generation

For future development, consider implementing automated screenshot testing:

```bash
# Playwright example
npx playwright test --update-snapshots
```

This would ensure screenshots stay synchronized with UI changes.
