/**
 * Simple test function to verify Netlify Functions deployment
 */

exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: "Neo N3 MCP Netlify Functions are working correctly!",
      timestamp: new Date().toISOString(),
      environment: process.env.NETLIFY ? "Netlify" : "Local development",
      nodeVersion: process.version
    })
  };
}; 