---
inclusion: always
---

# No Emoji - Use Lucide React Icons

**CRITICAL RULE**: Never use emoji in code, UI, or user-facing text. Always use Lucide React icons instead.

## Why No Emoji

1. **Accessibility**: Screen readers handle SVG icons better than emoji
2. **Consistency**: Lucide icons provide consistent visual language
3. **Scalability**: SVG icons scale perfectly at any size
4. **Customization**: Icons can be styled with CSS (color, size, etc.)
5. **Professional**: Icons look more professional than emoji

## Emoji → Lucide Icon Replacements

### Status Icons
- ❌ → `<X />` or `<AlertCircle />`
- ✅ → `<Check />` or `<CheckCircle />`
- ⚠️ → `<AlertTriangle />`
- ℹ️ → `<Info />`

### Action Icons
- 🎯 → `<Target />` or `<Zap />`
- 🔍 → `<Search />` or `<Eye />`
- 📦 → `<Package />` or `<Box />`
- 🚀 → `<Rocket />`
- ⚡ → `<Zap />`

### UI Elements
- 🔄 → `<RotateCcw />` or `<RefreshCw />`
- 📝 → `<Edit />` or `<FileText />`
- 🎨 → `<Palette />`
- 📏 → `<Ruler />`

## Implementation

### In HTML/JavaScript
```html
<!-- Bad -->
<span>✅ Success!</span>

<!-- Good -->
<span>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="20,6 9,17 4,12"></polyline>
  </svg>
  Success!
</span>
```

### In Console Logs (Development Only)
```javascript
// Bad
console.log('✅ Success');

// Good  
console.log('✓ Success'); // Use simple ASCII characters for logs
```

## Lucide Icon Reference

Common icons to use:
- **Check**: `<polyline points="20,6 9,17 4,12"></polyline>`
- **X**: `<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>`
- **AlertCircle**: `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>`
- **Search**: `<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>`

## Enforcement

- **Code Reviews**: Reject any PR with emoji
- **Linting**: Add rules to detect emoji usage
- **Documentation**: Update style guides to reference this rule

**Remember**: Professional applications use icons, not emoji.