---
inclusion: fileMatch
fileMatchPattern: "code.ts|ui.html"
---

# Auto-Compile on Save

When the user saves `code.ts` or `ui.html` files, automatically run the TypeScript compilation to ensure the plugin is ready for testing.

## Auto-Compile Instructions

Whenever `code.ts` or `ui.html` is saved:

1. **Always run compilation**: Execute `npm run build` to compile TypeScript
2. **Check for errors**: Report any compilation errors clearly
3. **Confirm success**: Notify when compilation completes successfully
4. **No manual prompting**: Run automatically without asking

## Commands to Execute

```bash
npm run build
```

This ensures the Figma plugin is always compiled and ready for testing after any code changes.

## Why This Matters

- **Immediate feedback**: Catch TypeScript errors right after saving
- **Ready for testing**: Plugin is always compiled and ready to run in Figma
- **Smooth workflow**: No need to manually remember to compile
- **Error prevention**: Avoid running outdated compiled code

Execute the build command automatically every time these files are saved.