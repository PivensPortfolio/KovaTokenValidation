---
name: "TypeScript Auto-Build"
description: "Automatically compiles TypeScript to JavaScript when .ts files are saved"
trigger: "file-save"
filePattern: "**/*.ts"
enabled: false
---

# TypeScript Auto-Build Hook

## Description
Automatically compiles TypeScript to JavaScript and updates the Figma plugin code whenever a TypeScript file is saved.

## Trigger
- **Event**: File Save
- **File Pattern**: `**/*.ts`

## Actions
1. Run `npm run build` to compile TypeScript
2. Copy the compiled `dist/code.js` to root `code.js` for Figma
3. Notify when build is complete

## Purpose
Eliminates the manual build step when developing Figma plugins with TypeScript. Just save your `.ts` files and the plugin JavaScript is automatically updated.

---

You are helping with a Figma plugin development workflow. When TypeScript files are saved, you need to:

1. **Build the TypeScript**: Run `npm run build` to compile all TypeScript files
2. **Update the plugin file**: Copy `dist/code.js` to `code.js` (root) so Figma uses the latest compiled code
3. **Provide feedback**: Let the user know the build completed successfully

The build process compiles TypeScript files according to `tsconfig.json` configuration, which outputs to the `dist/` directory. However, Figma reads from the root `code.js` file, so we need to copy the compiled version.

Handle any build errors gracefully and report them to the user.