# Neo N3 MCP Production Deployment Checklist

This checklist ensures your Neo N3 MCP server is properly configured and secured for production use.

## Pre-Deployment Checklist

### ✅ Configuration

- [ ] **Network Configuration**
  - [ ] Set appropriate network mode (`mainnet` for production)
  - [ ] Configure reliable RPC endpoints
  - [ ] Test RPC endpoint connectivity and performance
  - [ ] Set up backup RPC endpoints

- [ ] **Security Configuration**
  - [ ] Enable rate limiting (`RATE_LIMITING_ENABLED=true`)
  - [ ] Set appropriate rate limits for your use case
  - [ ] Configure secure logging (no sensitive data in logs)
  - [ ] Set up proper access controls

- [ ] **Environment Variables**
  ```bash
  # Required for production
  NEO_NETWORK=mainnet
  NEO_MAINNET_RPC=https://mainnet1.neo.coz.io:443
  NEO_TESTNET_RPC=https://testnet1.neo.coz.io:443
  
  # Rate limiting
  RATE_LIMITING_ENABLED=true
  MAX_REQUESTS_PER_MINUTE=60
  MAX_REQUESTS_PER_HOUR=1000
  
  # Logging
  LOG_LEVEL=info
  LOG_FILE=/var/log/neo-mcp/server.log
  LOG_CONSOLE=false
  ```

### ✅ Infrastructure

- [ ] **Server Requirements**
  - [ ] Minimum 2GB RAM
  - [ ] Minimum 2 CPU cores
  - [ ] SSD storage for logs
  - [ ] Stable internet connection

- [ ] **Monitoring Setup**
  - [ ] Health check endpoints configured
  - [ ] Log aggregation setup
  - [ ] Performance monitoring
  - [ ] Error alerting

- [ ] **Backup & Recovery**
  - [ ] Log rotation configured
  - [ ] Backup strategy for configuration
  - [ ] Disaster recovery plan

### ✅ Testing

- [ ] **Functional Testing**
  - [ ] All tools tested on target network
  - [ ] Contract interactions verified
  - [ ] Error handling tested
  - [ ] Performance benchmarks completed

- [ ] **Security Testing**
  - [ ] Input validation tested
  - [ ] Rate limiting verified
  - [ ] Access control tested
  - [ ] No sensitive data exposure

## Deployment Steps

### 1. Install Dependencies

```bash
# Install Node.js 18+ and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install the MCP server
npm install -g @r3e/neo-n3-mcp
```

### 2. Create Configuration

```bash
# Create configuration directory
sudo mkdir -p /etc/neo-mcp
sudo mkdir -p /var/log/neo-mcp

# Create configuration file
sudo tee /etc/neo-mcp/config.json << EOF
{
  "network": "mainnet",
  "rpc": {
    "mainnet": "https://mainnet1.neo.coz.io:443",
    "testnet": "https://testnet1.neo.coz.io:443"
  },
  "logging": {
    "level": "info",
    "file": "/var/log/neo-mcp/server.log",
    "console": false
  },
  "rateLimiting": {
    "enabled": true,
    "maxRequestsPerMinute": 60,
    "maxRequestsPerHour": 1000
  }
}
EOF
```

### 3. Create Systemd Service

```bash
# Create service file
sudo tee /etc/systemd/system/neo-mcp.service << EOF
[Unit]
Description=Neo N3 MCP Server
After=network.target

[Service]
Type=simple
User=neo-mcp
Group=neo-mcp
WorkingDirectory=/opt/neo-mcp
ExecStart=/usr/bin/neo-n3-mcp --config /etc/neo-mcp/config.json
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=neo-mcp

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/neo-mcp

# Environment
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
```

### 4. Create User and Set Permissions

```bash
# Create dedicated user
sudo useradd --system --shell /bin/false neo-mcp

# Set permissions
sudo chown -R neo-mcp:neo-mcp /var/log/neo-mcp
sudo chmod 755 /var/log/neo-mcp
sudo chmod 644 /etc/neo-mcp/config.json
```

### 5. Configure Log Rotation

```bash
# Create logrotate configuration
sudo tee /etc/logrotate.d/neo-mcp << EOF
/var/log/neo-mcp/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 neo-mcp neo-mcp
    postrotate
        systemctl reload neo-mcp
    endscript
}
EOF
```

### 6. Start and Enable Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable neo-mcp
sudo systemctl start neo-mcp

# Check status
sudo systemctl status neo-mcp
```

## Post-Deployment Verification

### ✅ Service Health

- [ ] **Service Status**
  ```bash
  # Check service is running
  sudo systemctl status neo-mcp
  
  # Check logs
  sudo journalctl -u neo-mcp -f
  ```

- [ ] **Connectivity Test**
  ```bash
  # Test MCP server response
  echo '{"name":"get_network_mode","arguments":{}}' | neo-n3-mcp
  ```

### ✅ Performance Monitoring

- [ ] **Resource Usage**
  ```bash
  # Monitor CPU and memory
  top -p $(pgrep -f neo-n3-mcp)
  
  # Check disk usage
  df -h /var/log/neo-mcp
  ```

- [ ] **Response Times**
  ```bash
  # Test response time
  time echo '{"name":"get_blockchain_info","arguments":{}}' | neo-n3-mcp
  ```

### ✅ Security Verification

- [ ] **Rate Limiting**
  ```bash
  # Test rate limiting (should fail after limit)
  for i in {1..70}; do
    echo '{"name":"get_network_mode","arguments":{}}' | neo-n3-mcp
  done
  ```

- [ ] **Input Validation**
  ```bash
  # Test invalid inputs (should return proper errors)
  echo '{"name":"get_balance","arguments":{"address":"invalid"}}' | neo-n3-mcp
  ```

## Monitoring and Maintenance

### Daily Checks

- [ ] Service status: `sudo systemctl status neo-mcp`
- [ ] Log file size: `ls -lh /var/log/neo-mcp/`
- [ ] Error count: `grep -c ERROR /var/log/neo-mcp/server.log`

### Weekly Checks

- [ ] Performance metrics review
- [ ] Security log analysis
- [ ] Backup verification
- [ ] Update availability check

### Monthly Checks

- [ ] Full security audit
- [ ] Performance optimization review
- [ ] Disaster recovery test
- [ ] Documentation updates

## Troubleshooting

### Common Issues

1. **Service Won't Start**
   ```bash
   # Check logs
   sudo journalctl -u neo-mcp --no-pager
   
   # Check configuration
   neo-n3-mcp --config /etc/neo-mcp/config.json --validate
   ```

2. **High Memory Usage**
   ```bash
   # Check for memory leaks
   sudo systemctl restart neo-mcp
   
   # Monitor memory usage
   watch -n 5 'ps aux | grep neo-n3-mcp'
   ```

3. **RPC Connection Issues**
   ```bash
   # Test RPC connectivity
   curl -X POST https://mainnet1.neo.coz.io:443 \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"getblockcount","params":[],"id":1}'
   ```

4. **Rate Limiting Issues**
   ```bash
   # Check rate limit configuration
   grep -i rate /etc/neo-mcp/config.json
   
   # Adjust limits if needed
   sudo systemctl restart neo-mcp
   ```

### Emergency Procedures

1. **Service Failure**
   ```bash
   # Immediate restart
   sudo systemctl restart neo-mcp
   
   # If restart fails, check logs and configuration
   sudo journalctl -u neo-mcp --since "1 hour ago"
   ```

2. **High Load**
   ```bash
   # Temporarily reduce rate limits
   # Edit /etc/neo-mcp/config.json
   # Restart service
   sudo systemctl restart neo-mcp
   ```

3. **Security Incident**
   ```bash
   # Stop service immediately
   sudo systemctl stop neo-mcp
   
   # Analyze logs
   sudo grep -i "error\|fail\|attack" /var/log/neo-mcp/server.log
   
   # Contact security team
   ```

## Support and Resources

- **Documentation**: [Neo N3 MCP Documentation](./README.md)
- **Examples**: [Usage Examples](./EXAMPLES.md)
- **API Reference**: [API Documentation](./API.md)
- **Neo N3 Documentation**: https://docs.neo.org/
- **Community Support**: https://discord.gg/neo

## Version Information

- **Neo N3 MCP Version**: 1.5.0
- **Neo N3 SDK Version**: @cityofzion/neon-js v5.3.0
- **MCP SDK Version**: @modelcontextprotocol/sdk v1.9.0
- **Node.js Version**: 18+ required