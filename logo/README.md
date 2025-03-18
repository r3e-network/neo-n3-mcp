# Neo N3 MCP Server Logo

This directory contains the logo for the Neo N3 MCP server.

## Logo Files

- `neo-n3-mcp-logo.txt` - SVG content in a text file
- `neo-n3-mcp-logo.svg` - SVG logo (to be created from the text file)
- `neo-n3-mcp-logo.png` - PNG logo for MCP Marketplace submission (to be created from the SVG)

## Logo Requirements

For submission to the MCP Marketplace, the logo should be:
- 400x400 pixels
- PNG format
- Clear and recognizable

## Creating the Logo Files

### Step 1: Create SVG from Text File

1. Copy the content of `neo-n3-mcp-logo.txt`
2. Create a new file named `neo-n3-mcp-logo.svg`
3. Paste the content into the SVG file
4. Save the file

### Step 2: Convert SVG to PNG

Option 1: Using a browser
1. Open the SVG file in a web browser
2. Right-click on the image and select "Save Image As..."
3. Save as PNG format with the name `neo-n3-mcp-logo.png`

Option 2: Using an online converter
1. Visit an online SVG to PNG converter (e.g., https://svgtopng.com/)
2. Upload the SVG file
3. Download the PNG file
4. Ensure the dimensions are 400x400 pixels

Option 3: Using command line tools (if available)
```bash
# Using Inkscape
inkscape -w 400 -h 400 neo-n3-mcp-logo.svg -o neo-n3-mcp-logo.png

# Using ImageMagick
convert -background none -size 400x400 neo-n3-mcp-logo.svg neo-n3-mcp-logo.png
```

## Logo Design

The logo combines elements from:
1. Neo N3 logo - The stylized "N3" in Neo green (#00e599)
2. MCP (Model Context Protocol) - Represented by interconnected nodes showing data exchange

## Usage

The logo is used in:
1. MCP Marketplace listing
2. GitHub repository
3. Documentation
