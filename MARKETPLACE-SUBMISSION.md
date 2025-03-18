# MCP Marketplace Submission Guide

This guide provides instructions for submitting the Neo N3 MCP server to the Cline MCP Marketplace.

## Prerequisites

Before submitting to the MCP Marketplace, ensure you have:

1. A GitHub account
2. A public GitHub repository containing the Neo N3 MCP server code
3. A 400×400 PNG logo image for the server

## Preparation Steps

1. **Push Code to GitHub**
   - Create a new GitHub repository (e.g., `neo-n3-mcp`)
   - Push all the code to the repository
   - Ensure the repository is public

2. **Create Logo**
   - Follow the instructions in `logo/README.md` to create the logo
   - Ensure the final PNG is 400×400 pixels

3. **Test with Cline**
   - Before submission, test that Cline can successfully set up the server using just the README.md and llms-install.md files
   - Ask Cline to install your Neo N3 MCP server using only the GitHub repository URL

## Submission Process

1. **Create a New Issue**
   - Go to [MCP Marketplace Repository](https://github.com/cline/mcp-marketplace)
   - Click on "Issues" tab
   - Click "New Issue"
   - Select the "MCP Server Submission" template

2. **Fill in the Issue Template**
   - **GitHub Repo URL**: Provide the direct link to your Neo N3 MCP server repository
   - **Logo Image**: Attach the 400×400 PNG logo image
   - **Reason for Addition**: Explain why your Neo N3 MCP server is valuable for Cline users

3. **Example Submission Text**

```
GitHub Repo URL: https://github.com/yourusername/neo-n3-mcp

Reason for Addition:
The Neo N3 MCP server provides seamless integration with the Neo N3 blockchain, allowing Cline to interact with blockchain data, manage wallets, transfer assets, and invoke smart contracts. This server enables users to leverage Cline's capabilities for blockchain development, asset management, and smart contract interaction without requiring specialized blockchain knowledge.

Key features include:
- Blockchain information querying
- Block and transaction data retrieval
- Wallet management
- Asset transfers
- Smart contract invocation
- Security-focused design

The server is designed to be easy to install and use, with comprehensive documentation and Docker support.
```

## After Submission

1. **Review Process**
   - The Cline team will review your submission
   - They may ask questions or request changes
   - The review process typically takes a few days

2. **Approval and Listing**
   - Once approved, your Neo N3 MCP server will be listed in the MCP Marketplace
   - It will become discoverable by Cline users

3. **Maintenance**
   - Keep your GitHub repository updated
   - Address any issues reported by users
   - Consider adding new features based on user feedback

## Support

If you have any questions or need help with the submission process, join the [Cline Discord](https://discord.gg/cline) and post in the `#mcp` channel.
