# 🎨 Next.js CSS Linter  

A tool for analyzing CSS modules in Next.js projects. The linter detects **unused classes** in styles and **references to non-existent classes** in `.tsx` files.  

## 🔹 Features  
- Project-wide analysis with warnings displayed in the editor  
- High performance thanks to Rust-based implementation  
- Support for `import aliases` from `tsconfig.json`  
- Ability to ignore specific warnings
- Find definitions for your CSS classes  

## 🔹 Usage  
Linting runs automatically **on file save**, and warnings are displayed in the workspace.  

### 🔹 Ignoring Warnings  
If a class is used correctly but still marked as unused, add a comment **directly above the class declaration**:  
```css
/* css-lint-disable-rule unused-class */
```
Alternatively, use the **Quick Fix** feature available in the editor.

---
**by AndcoolSystems, 04 March, 2025**