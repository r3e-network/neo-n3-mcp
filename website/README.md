# Neo N3 MCP Server Website

This is the official website for the Neo N3 MCP Server, powered by R3E Network. It provides comprehensive documentation, user guides, and integration resources for the Neo N3 MCP Server.

## Website Structure

The website consists of the following pages:

- **Home**: Overview of the Neo N3 MCP Server
- **Documentation**: Detailed documentation of the server and its features
- **User Guide**: Step-by-step guide for using the server
- **Integration Guide**: Instructions for integrating the server with AI systems

## Local Development

To run the website locally, follow these steps:

1. Clone the repository:
   ```bash
   git clone https://github.com/R3E-Network/neo-n3-mcp.git
   cd neo-n3-mcp/website
   ```

2. Install dependencies:
   ```bash
   npm install -g serve
   ```

3. Start the development server:
   ```bash
   serve
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

## Deploying to Netlify

The website is configured for easy deployment to Netlify:

### Method 1: Deploy via Netlify UI

1. Log in to your Netlify account
2. Click "New site from Git"
3. Connect to your Git provider and select the repository
4. Set the following configuration:
   - Base directory: `website`
   - Publish directory: `.`
   - Build command: (leave empty)
5. Click "Deploy site"

### Method 2: Deploy via Netlify CLI

1. Install the Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Log in to your Netlify account:
   ```bash
   netlify login
   ```

3. Navigate to the website directory:
   ```bash
   cd website
   ```

4. Deploy the site:
   ```bash
   netlify deploy --prod
   ```

### Method 3: One-Click Deploy

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/R3E-Network/neo-n3-mcp)

## Customization

To customize the website:

- **Styles**: Edit `css/styles.css` to modify the website's appearance
- **Content**: Update the HTML files to change the content
- **Scripts**: Modify `js/main.js` to change the website's behavior

## License

This website is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.

## Credits

- Neo N3 MCP Server by R3E Network
- Website design and development by R3E Network 