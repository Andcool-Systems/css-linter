# 🎨 Next.js CSS Linter  
A tool for seamless work with CSS modules in Next.js and React.  

## 🔹 Key Features  
- Detects unused CSS classes  
- Finds undefined classes in `.tsx` files  
- Enables quick navigation to CSS class definitions  
- Provides autocomplete suggestions for CSS classes  
- Displays CSS class content on hover  
- Automatically extracts inline styles into CSS modules  

## 🔹 Usage  
Linting runs **on file save**, and warnings are displayed in the editor.  

### ✂️ Extracting Inline Styles  
1. Select the `style={{}}` prop in a JSX/TSX file.  
2. Open the context menu and choose **"Extract inline styles into CSS module"**.  
3. Select the CSS module where the styles should be moved.  
4. Enter a name for the new CSS class and press **Enter**.  
5. The inline styles will be converted into a CSS class and added to the selected module.  

## 🔹 Ignoring Warnings  
If a class is used correctly but still marked as unused, add a comment **above its declaration**:  
```css
/* css-lint-disable-rule unused-class */
```
Alternatively, use the **Quick Fix** feature available in the editor.  

---  
📌 **by AndcoolSystems, March 4, 2025**