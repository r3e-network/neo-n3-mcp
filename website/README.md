# Neo N3 MCP Website

This is the official website for the Neo N3 MCP Server, built with modern HTML, CSS, and JavaScript. The site is designed to be deployed on Netlify.

## 📁 Structure

```
website/
├── index.html              # Main landing page
├── 404.html               # Custom 404 error page
├── docs/
│   └── index.html         # Documentation index
├── assets/
│   ├── css/
│   │   └── style.css      # Main stylesheet
│   ├── js/
│   │   └── main.js        # Main JavaScript functionality
│   ├── images/
│   │   └── neo-logo.svg   # Neo N3 logo
│   └── favicon.svg        # Site favicon
├── netlify.toml           # Netlify deployment configuration
├── robots.txt             # SEO robots file
├── sitemap.xml            # Site sitemap
└── README.md              # This file
```

## 🚀 Deployment to Netlify

### Automatic Deployment (Recommended)

1. **Connect your repository to Netlify:**
   - Go to [Netlify](https://netlify.com)
   - Click "New site from Git"
   - Connect your GitHub repository
   - Set the base directory to `website`
   - Set the publish directory to `.` (current directory)

2. **Configuration:**
   - The `netlify.toml` file is already configured
   - No build command needed (static site)
   - Custom headers and redirects are pre-configured

3. **Deploy:**
   - Netlify will automatically deploy when you push to the main branch
   - The site will be available at your Netlify subdomain

### Manual Deployment

1. **Build the site** (if needed):
   ```bash
   # No build step required - it's a static site
   ```

2. **Deploy to Netlify:**
   - Zip the `website` folder contents
   - Upload to Netlify dashboard
   - Or use Netlify CLI:
   ```bash
   npm install -g netlify-cli
   netlify deploy --dir=website --prod
   ```

## 🔧 Local Development

### Simple HTTP Server

```bash
# Python 3
cd website
python -m http.server 3000

# Node.js
cd website
npx serve -p 3000

# PHP
cd website
php -S localhost:3000
```

### Netlify Dev (Recommended)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Run local development server with Netlify features
cd website
netlify dev
```

This provides:
- Local server with redirects and headers
- Environment variables
- Function testing (if added later)

## 📝 Content Management

### Updating Documentation

The website includes links to documentation that should be created in the `docs/` directory:

- `/docs/api` - API Reference (link to your API.md)
- `/docs/getting-started` - Getting Started Guide
- `/docs/architecture` - Architecture Documentation (link to your ARCHITECTURE.md)
- `/docs/deployment` - Deployment Guide (link to your DEPLOYMENT.md)
- `/docs/testing` - Testing Guide (link to your TESTING.md)
- `/docs/networks` - Networks Guide (link to your NETWORKS.md)

You can either:
1. Create HTML versions of your markdown files
2. Use a static site generator like Jekyll or Hugo
3. Link directly to your GitHub repository files

### Adding New Pages

1. Create HTML files following the existing structure
2. Include the same CSS and JS files
3. Update navigation menus
4. Add to `sitemap.xml`

### Updating Styles

Edit `assets/css/style.css` for styling changes. The CSS uses:
- CSS Custom Properties (variables)
- Modern CSS Grid and Flexbox
- Responsive design patterns
- Neo N3 brand colors

### Adding Functionality

Edit `assets/js/main.js` for JavaScript functionality. Current features:
- Responsive navigation
- Smooth scrolling
- Copy code buttons
- Tab switching
- Scroll animations

## 🎨 Customization

### Brand Colors

Update the CSS custom properties in `style.css`:

```css
:root {
  --neo-green: #00ff88;
  --neo-dark-green: #00cc6a;
  --neo-dark: #0a0e1a;
  /* ... other colors */
}
```

### Logo and Images

- Replace `assets/images/neo-logo.svg` with your logo
- Update `assets/favicon.svg` with your favicon
- Add new images to `assets/images/`

### Content

- Update links to point to your actual GitHub repository
- Update NPM package links
- Modify text content in HTML files
- Update meta tags for SEO

## 🔍 SEO Optimization

The site includes:
- Semantic HTML structure
- Meta tags for social sharing
- Structured data potential
- Sitemap and robots.txt
- Performance optimizations

### Analytics Setup

Add analytics tracking code to the JavaScript files or HTML templates:

```javascript
// Google Analytics 4
gtag('config', 'GA_MEASUREMENT_ID');

// Or other analytics providers
```

## 📊 Performance

The site is optimized for performance:
- Minimal dependencies
- Optimized images (SVG for logos)
- CSS and JS minification (via Netlify)
- Modern browser features
- Lazy loading potential

## 🔒 Security

Security features included:
- Content Security Policy headers
- XSS protection headers
- HTTPS enforcement (via Netlify)
- Input sanitization in JavaScript

## 🐛 Troubleshooting

### Common Issues

1. **404 errors on deployment:**
   - Check `netlify.toml` redirects
   - Ensure file paths are correct

2. **Images not loading:**
   - Check file paths (use absolute paths starting with `/`)
   - Ensure images are in the `assets/images/` directory

3. **JavaScript not working:**
   - Check browser console for errors
   - Ensure all script files are included

4. **CSS not applying:**
   - Check for syntax errors in CSS
   - Ensure CSS file is linked correctly

### Development Tips

- Use browser developer tools for debugging
- Test on multiple devices and browsers
- Use Lighthouse for performance auditing
- Test form submissions and interactive features

## 📞 Support

For website-specific issues:
- Check this README
- Review Netlify documentation
- Check browser console for errors

For Neo N3 MCP Server issues:
- See the main project documentation
- Open issues on the GitHub repository

## 📄 License

This website is part of the Neo N3 MCP Server project and follows the same MIT license. 