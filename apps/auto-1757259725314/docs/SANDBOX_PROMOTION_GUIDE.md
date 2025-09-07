# Sandbox Promotion Guide

This guide explains how to promote (integrate) code from the sandbox environment to your main development project.

## Overview

The sandbox environment (`apps/auto-*`) is designed for safe experimentation and development. Once your code is ready, you can integrate it into your main project using the steps below.

## Prerequisites

- Code has been tested and validated in sandbox
- All dependencies are documented
- Breaking changes are identified and documented
- Performance impact has been assessed

## Platform-Specific Integration Steps

### macOS Integration

#### Step 1: Prepare for Integration
```bash
# Navigate to your main project root
cd /path/to/your/main/project

# Create a backup branch
git checkout -b backup-before-integration-$(date +%Y%m%d)
git push origin backup-before-integration-$(date +%Y%m%d)

# Return to main development branch
git checkout develop  # or your main branch
```

#### Step 2: Copy Enhanced WebSocket Components
```bash
# Copy the enhanced WebSocket service
cp /path/to/sandbox/src/services/websocketService.ts ./src/services/

# Copy WebSocket utilities
cp /path/to/sandbox/src/utils/websocketUtils.ts ./src/utils/

# Copy React components (if using React)
cp /path/to/sandbox/src/components/ConnectionStatus.tsx ./src/components/
cp /path/to/sandbox/src/components/MessageBadge.tsx ./src/components/
```

#### Step 3: Update Dependencies
```bash
# Review and merge package.json changes
# Compare sandbox package.json with your project's package.json
diff ./package.json /path/to/sandbox/package.json

# Install any new dependencies
npm install  # or yarn install
```

#### Step 4: Integration Testing
```bash
# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run unit tests
npm test

# Run build
npm run build

# Start development server for manual testing
npm run dev
```

### Windows Integration

#### Step 1: Prepare for Integration
```cmd
# Navigate to your main project root
cd C:\path\to\your\main\project

# Create a backup branch
git checkout -b backup-before-integration-%date:~6,4%%date:~3,2%%date:~0,2%
git push origin backup-before-integration-%date:~6,4%%date:~3,2%%date:~0,2%

# Return to main development branch
git checkout develop
```

#### Step 2: Copy Enhanced WebSocket Components
```cmd
# Copy the enhanced WebSocket service
copy "C:\path\to\sandbox\src\services\websocketService.ts" ".\src\services\"

# Copy WebSocket utilities  
copy "C:\path\to\sandbox\src\utils\websocketUtils.ts" ".\src\utils\"

# Copy React components (if using React)
copy "C:\path\to\sandbox\src\components\ConnectionStatus.tsx" ".\src\components\"
copy "C:\path\to\sandbox\src\components\MessageBadge.tsx" ".\src\components\"
```

#### Step 3: Update Dependencies
```cmd
# Review package.json changes manually or using a diff tool
# Install any new dependencies
npm install
```

#### Step 4: Integration Testing
```cmd
# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run unit tests
npm test

# Run build
npm run build

# Start development server
npm run dev
```

## Integration Checklist

### Pre-Integration
- [ ] All sandbox tests pass
- [ ] Code follows project conventions
- [ ] Dependencies are documented
- [ ] Breaking changes identified
- [ ] Performance benchmarks completed

### During Integration
- [ ] Backup branch created
- [ ] Files copied to correct locations
- [ ] Import paths updated
- [ ] Dependencies merged
- [ ] Configuration files updated

### Post-Integration Testing
- [ ] TypeScript compilation passes
- [ ] Linting passes
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] Build process completes
- [ ] Manual testing in development environment
- [ ] Performance regression testing

### Production Readiness
- [ ] Staging environment testing
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Rollback plan prepared
- [ ] Monitoring and alerts configured

## Common Integration Issues

### Import Path Issues
If you encounter import path errors after integration:

```typescript
// Update relative imports
import { websocketService } from '../services/websocketService'  // ❌ Old
import { enhancedWebSocketService } from '../services/websocketService'  // ✅ New

// Update utility imports
import { generateWebSocketURL } from '../utils/websocketUtils'  // ✅ Correct
```

### Dependency Conflicts
If dependency versions conflict:

```bash
# Check for conflicts
npm ls

# Resolve conflicts by updating package.json
# Consider using exact versions for critical dependencies
```

### TypeScript Configuration
Ensure your tsconfig.json includes:

```json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  },
  "include": [
    "src/**/*"
  ]
}
```

## Rollback Procedure

If integration causes issues:

```bash
# Quick rollback to backup branch
git checkout backup-before-integration-YYYYMMDD
git checkout -b hotfix-rollback
git push origin hotfix-rollback

# Or selective rollback of specific files
git checkout HEAD~1 -- src/services/websocketService.ts
git checkout HEAD~1 -- src/utils/websocketUtils.ts
```

## Best Practices

1. **Gradual Integration**: Integrate components one at a time
2. **Feature Flags**: Use feature flags for gradual rollout
3. **Monitoring**: Monitor application performance post-integration
4. **Documentation**: Update all relevant documentation
5. **Team Communication**: Notify team members of changes

## Support

If you encounter issues during integration:

1. Check the integration checklist
2. Review common integration issues
3. Test in isolation using the sandbox environment
4. Consult the main project's development team

## Version Compatibility

This integration guide is compatible with:
- React 18+
- TypeScript 4.9+
- Node.js 16+
- Modern browsers with WebSocket support