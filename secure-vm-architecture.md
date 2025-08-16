# 🔒 Secure VM Infrastructure for Kiff AI

## **Security Threat Model & Controls**

### **1. Code Execution Isolation**
**Threat**: Users executing malicious code, shell access, privilege escalation

**Controls**:
```dockerfile
# Secure Container Runtime (code-execution-vm)
FROM python:3.11-slim

# Create non-root user with minimal privileges
RUN groupadd -r kiffuser && useradd -r -g kiffuser kiffuser
RUN mkdir -p /workspace && chown kiffuser:kiffuser /workspace

# Drop all capabilities except essential ones
USER kiffuser
WORKDIR /workspace

# No shell access - only Python/Node execution
CMD ["python", "-c", "import sys; sys.exit('Direct shell access denied')"]
```

**Runtime Security**:
- **gVisor/Firecracker**: Kernel-level isolation
- **seccomp-bpf**: Block dangerous syscalls
- **AppArmor/SELinux**: Mandatory access control
- **Resource limits**: CPU/memory/disk quotas

### **2. Credential & Metadata Protection**
**Threat**: Access to AWS credentials, instance metadata, secrets

**Controls**:
```yaml
# ECS Task Definition Security
taskDefinition:
  containerDefinitions:
    - name: code-execution
      environment:
        - name: AWS_METADATA_SERVICE_TIMEOUT
          value: "1"
        - name: AWS_METADATA_SERVICE_NUM_ATTEMPTS  
          value: "1"
      # Block IMDS completely
      linuxParameters:
        capabilities:
          drop: ["ALL"]
        readonlyRootFilesystem: true
        tmpfs:
          - containerPath: "/tmp"
            size: 100
      # No IAM roles for user containers
      taskRoleArn: null
```

**IAM Security**:
- **Zero IAM permissions** for user VMs
- **Secrets Manager**: All credentials via SM, not env vars
- **IMDS v2 only**: Block metadata access entirely
- **VPC endpoints**: No internet access to AWS APIs

### **3. Network Isolation & Egress Control**
**Threat**: Data exfiltration, scanning, lateral movement

**Controls**:
```yaml
# VPC Security Architecture
VPC:
  PrivateSubnets:
    - 10.0.1.0/24  # VM execution subnet
    - 10.0.2.0/24  # ML service subnet
  
  SecurityGroups:
    UserVMSecurityGroup:
      ingress: []  # No inbound access
      egress:
        # ONLY specific package registries
        - protocol: HTTPS
          port: 443
          destinations:
            - registry.npmjs.org
            - pypi.org
            - cdn.jsdelivr.net
        # Block everything else
        - protocol: ALL
          action: DENY

  NACLs:
    # Network-level egress filtering
    - rule: 100
      action: ALLOW
      protocol: HTTPS
      destination: npm/pypi registries
    - rule: 200
      action: DENY
      protocol: ALL
```

**WAF & Rate Limiting**:
```yaml
WAF:
  rules:
    - name: RateLimitPerTenant
      rateLimit: 100 requests/minute/tenant
    - name: BlockMaliciousPayloads
      patterns: ["../", "<?php", "<script>", "eval("]
    - name: FileSizeLimit
      maxSize: 10MB per file
```

### **4. Data Isolation & Encryption**
**Threat**: Cross-tenant data access, data persistence, encryption bypass

**Controls**:
```yaml
# Tenant Isolation Strategy
Storage:
  EFS:
    # Per-tenant mount targets with encryption
    mountTargets:
      - tenantId: ${TENANT_ID}
        path: /workspace/${TENANT_ID}
        encryption: AES-256
        accessPoint:
          uid: 1001
          gid: 1001
          permissions: 0750

  # Ephemeral storage only
  Container:
    tmpfs: "/workspace"
    size: 2GB
    # Auto-destroyed after session
```

**Data Protection**:
- **No persistent storage** between sessions
- **Tenant namespacing**: /workspace/${tenant_id}/${session_id}
- **Encryption at rest**: EFS encrypted volumes
- **Memory encryption**: Intel TME/AMD SME
- **Garbage collection**: Force cleanup after timeout

### **5. Input Validation & Poisoning Protection**
**Threat**: Code injection, dependency confusion, supply chain attacks

**Controls**:
```python
# Secure Input Validation
class SecureVMProvider:
    def validate_files(self, files: List[Dict]) -> bool:
        for file in files:
            # Size limits
            if len(file['content']) > 1024 * 1024:  # 1MB max
                raise ValidationError("File too large")
            
            # Path traversal protection
            if '../' in file['path'] or file['path'].startswith('/'):
                raise ValidationError("Invalid file path")
            
            # Malicious content detection
            if self._contains_malicious_patterns(file['content']):
                raise ValidationError("Malicious content detected")
        
        return True
    
    def _contains_malicious_patterns(self, content: str) -> bool:
        malicious = [
            'eval(', 'exec(', '__import__',
            'subprocess.', 'os.system', 
            'fetch(', 'XMLHttpRequest',
            'document.cookie', 'localStorage'
        ]
        return any(pattern in content for pattern in malicious)
```

**Package Security**:
```yaml
# Dependency Scanning & Allowlisting
PackageSecurity:
  npm:
    allowlist: ["react", "react-dom", "vite", "@vitejs/*"]
    scanner: "npm audit"
    maxSeverity: "moderate"
  
  pip:
    allowlist: ["fastapi", "uvicorn", "pydantic"]
    scanner: "safety check"
    maxSeverity: "medium"
```

## **🏗️ Production Architecture**

### **Multi-Layer Security Model**:
```
┌─────────────────────────────────────────┐
│  ALB + WAF (Rate limiting, DDoS)        │
├─────────────────────────────────────────┤
│  ECS Fargate (VM Orchestrator)          │
│  - IAM: SecretsManager access only      │
│  - Network: Private subnet              │
├─────────────────────────────────────────┤
│  Firecracker MicroVMs (User Code)       │
│  - Zero IAM permissions                 │
│  - gVisor kernel isolation             │
│  - Egress allowlist only               │
│  - tmpfs storage (ephemeral)           │
├─────────────────────────────────────────┤
│  VPC Endpoints (Package registries)     │
│  - No internet gateway access          │
├─────────────────────────────────────────┤
│  CloudWatch + GuardDuty (Monitoring)    │
│  - Anomaly detection                   │
│  - Audit logging                      │
└─────────────────────────────────────────┘
```

### **Cost-Optimized Graviton Deployment**:
```yaml
# ECS Service on Graviton
ECSService:
  cluster: kiff-vm-cluster
  launchType: EC2
  instanceType: c7g.large  # 40% cost savings
  spot: true              # Additional 70% savings
  
  userdata: |
    #!/bin/bash
    # Secure EC2 setup
    yum update -y
    yum install -y docker amazon-cloudwatch-agent
    
    # Disable unnecessary services
    systemctl disable postfix cups bluetooth
    
    # Install security tools
    yum install -y rkhunter chkrootkit fail2ban
    
    # Configure Docker security
    echo '{"log-driver": "awslogs", "no-new-privileges": true}' > /etc/docker/daemon.json
    systemctl start docker
    systemctl enable docker
    
    # Join ECS cluster
    echo ECS_CLUSTER=kiff-vm-cluster >> /etc/ecs/ecs.config
    echo ECS_ENABLE_CONTAINER_METADATA=true >> /etc/ecs/ecs.config
```

## **🔍 Monitoring & Audit Framework**

```yaml
Security Monitoring:
  CloudWatch:
    - Container CPU/memory spikes (crypto mining detection)
    - Network egress anomalies
    - File access patterns
  
  GuardDuty:
    - Malicious IP communication
    - DNS tunneling detection
    - Crypto mining activities
  
  Custom Metrics:
    - code_execution_duration
    - package_install_attempts
    - file_size_violations
    - network_connection_attempts

Alerts:
  - CPU usage > 80% for > 5 minutes
  - Outbound connections to non-allowlisted IPs
  - File access outside /workspace/${tenant_id}
  - Process execution attempts outside Python/Node
```

## **🚦 Emergency Response**

```bash
# Kill switch for suspicious activity
aws ecs stop-task --cluster kiff-vm-cluster --task ${TASK_ARN}
aws ec2 terminate-instances --instance-ids ${INSTANCE_ID}

# Tenant isolation breach
aws iam put-user-policy --user-name tenant-${TENANT_ID} --policy-name EmergencyDeny --policy-document file://deny-all.json
```

This architecture provides **defense in depth** against all the threats you mentioned while maintaining the fast, E2B-like user experience. Want me to implement any specific part first?