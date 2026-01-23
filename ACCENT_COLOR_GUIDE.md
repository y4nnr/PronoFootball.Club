# Accent Color System Guide

## Overview
The accent color system uses CSS variables to centralize color management. Change the accent color in **one place** and it updates everywhere in dark mode.

## How to Change the Accent Color

### Step 1: Open `styles/globals.css`
Find the CSS variables section (around line 157):

```css
:root {
  /* Accent Color Variables - Change these to update accent color everywhere */
  /* Current: Lime Green - Change these values to test different colors */
  --accent-400: rgb(163, 230, 53);  /* lime-400 */
  --accent-500: rgb(132, 204, 22);  /* lime-500 */
  --accent-600: rgb(101, 163, 13);  /* lime-600 */
  --accent-700: rgb(77, 124, 15);   /* lime-700 */
  --accent-900: rgb(54, 83, 20);    /* lime-900 */
}
```

### Step 2: Update the Color Values
Replace the RGB values with your new color. You can use:
- **RGB format**: `rgb(255, 0, 0)` for red
- **Hex format**: `#ff0000` for red
- **HSL format**: `hsl(0, 100%, 50%)` for red

### Step 3: Generate Color Shades (Optional)
If you have a base color and need shades:
- **400**: Lighter shade (for text, borders)
- **500**: Base color (most common)
- **600**: Medium shade (for backgrounds, buttons)
- **700**: Darker shade (for hover states)
- **900**: Darkest shade (for dark backgrounds)

You can use online tools like:
- [Coolors.co](https://coolors.co) - Generate color palettes
- [Tailwind Color Generator](https://tailwindcss.com/docs/customizing-colors)

### Step 4: Restart Development Server
After changing the colors, restart your dev server:
```bash
npm run dev
```

## Example: Changing to Blue

```css
:root {
  --accent-400: rgb(96, 165, 250);  /* blue-400 */
  --accent-500: rgb(59, 130, 246);  /* blue-500 */
  --accent-600: rgb(37, 99, 235);   /* blue-600 */
  --accent-700: rgb(29, 78, 216);   /* blue-700 */
  --accent-900: rgb(30, 58, 138);   /* blue-900 */
}
```

## Example: Changing to Purple

```css
:root {
  --accent-400: rgb(196, 181, 253);  /* purple-400 */
  --accent-500: rgb(168, 85, 247);   /* purple-500 */
  --accent-600: rgb(147, 51, 234);   /* purple-600 */
  --accent-700: rgb(126, 34, 206);   /* purple-700 */
  --accent-900: rgb(88, 28, 135);    /* purple-900 */
}
```

## Where the Accent Color is Used

The accent color appears in dark mode for:
- ✅ Widget icons and backgrounds
- ✅ Button backgrounds and hover states
- ✅ Borders and highlights
- ✅ Text colors for links and highlights
- ✅ Progress bars
- ✅ Navigation underlines
- ✅ Game card indicators
- ✅ Form focus states
- ✅ And more throughout the app

## Technical Details

- **CSS Variables**: Defined in `styles/globals.css`
- **Tailwind Integration**: Mapped to `accent-dark-*` colors in `tailwind.config.js`
- **Usage**: All components use `dark:bg-accent-dark-*`, `dark:text-accent-dark-*`, etc.
- **Light Mode**: Unaffected - uses original blue/primary colors

## Notes

- Only affects **dark mode** - light mode colors remain unchanged
- Changes are instant after server restart
- All 113+ accent color references are automatically updated
- No need to modify individual component files
