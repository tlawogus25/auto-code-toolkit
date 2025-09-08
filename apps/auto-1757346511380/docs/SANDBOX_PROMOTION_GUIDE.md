# Sandbox Promotion Guide

This document outlines how to promote code from a sandbox environment to the main repository.

## Overview

Sandbox environments allow for isolated development and testing of features before they're integrated into the main codebase. This guide provides step-by-step instructions for safely promoting sandbox code to production.

## Prerequisites

- [ ] All code has been thoroughly tested in the sandbox environment
- [ ] Code follows project coding standards and conventions
- [ ] All tests pass (unit, integration, and e2e where applicable)
- [ ] Code has been reviewed by at least one other developer
- [ ] Documentation has been updated to reflect changes
- [ ] Security implications have been considered and addressed

## Promotion Steps

### 1. Code Review and Testing

Before promotion, ensure your sandbox code meets quality standards:

```bash
# Run all tests
npm run test

# Check linting and formatting
npm run lint
npm run typecheck

# Build the project to ensure no build errors
npm run build
```

### 2. Create Feature Branch

Create a new branch in the main repository for your feature:

```bash
cd /path/to/main/repository
git checkout -b feature/websocket-improvements
```

### 3. Copy Files Systematically

Copy files from sandbox to the main repository, maintaining the directory structure:

```bash
# Copy source files
cp -r /path/to/sandbox/src/* /path/to/main/repository/src/

# Copy configuration files
cp /path/to/sandbox/websocket.config.sample.js /path/to/main/repository/

# Copy tests
cp -r /path/to/sandbox/tests/* /path/to/main/repository/tests/

# Copy documentation
cp -r /path/to/sandbox/docs/* /path/to/main/repository/docs/
```

### 4. Update Dependencies

Update package.json with any new dependencies:

```bash
# Install new dependencies if any were added
npm install

# Update package.json scripts if needed
```

### 5. Integration Testing

Test the integrated code in the main repository environment:

```bash
# Install dependencies
npm install

# Run full test suite
npm run test

# Start development server and test manually
npm run dev
```

### 6. Commit Changes

Create meaningful commits that explain the changes:

```bash
git add .
git commit -m "feat: add enhanced WebSocket utilities with StrictMode support

- Add dynamic WebSocket URL generation utilities
- Implement race condition prevention for StrictMode
- Add connection status and error visibility to UI
- Improve message handling with ROOM_LIST optimization
- Add periodic ping/pong for connection health monitoring"
```

### 7. Create Pull Request

Push your branch and create a pull request:

```bash
git push origin feature/websocket-improvements
```

Create a PR with:
- **Clear title**: Summarize the main improvement
- **Detailed description**: Explain what was changed and why
- **Testing notes**: How to test the changes
- **Breaking changes**: List any breaking changes
- **Screenshots**: If UI changes are involved

### 8. Code Review Process

- Request reviews from relevant team members
- Address feedback and make necessary changes
- Ensure CI/CD pipeline passes all checks
- Get required approvals before merging

### 9. Deployment

After PR approval:
- Merge using the team's preferred strategy (merge commit, squash, or rebase)
- Verify deployment in staging environment
- Monitor for any issues in production
- Update documentation if needed

## Post-Promotion Checklist

- [ ] Feature works correctly in production
- [ ] No performance regressions observed
- [ ] Monitoring/logging shows expected behavior
- [ ] Users can successfully use new features
- [ ] Documentation is updated and accessible
- [ ] Team is informed about new features/changes

## Rollback Plan

In case issues are discovered after promotion:

1. **Immediate**: Revert the PR if critical issues occur
2. **Short-term**: Create hotfix branch to address specific issues
3. **Long-term**: Re-evaluate the feature and improve testing procedures

```bash
# Emergency rollback
git revert <commit-hash>
git push origin main
```

## Best Practices

- **Small, focused changes**: Promote features in small, manageable chunks
- **Comprehensive testing**: Test thoroughly in sandbox before promotion
- **Clear communication**: Keep team informed about major changes
- **Documentation**: Always update relevant documentation
- **Monitoring**: Monitor production after deployment for issues

## Common Issues and Solutions

### Dependency Conflicts
- Use `npm ls` to check for dependency conflicts
- Update package-lock.json if needed
- Test with fresh node_modules installation

### Environment Differences
- Check environment variables and configuration
- Verify API endpoints and WebSocket URLs
- Test in staging environment before production

### Test Failures
- Run tests locally before pushing
- Check for test environment differences
- Update test configurations if needed

### Build Failures
- Ensure all imports and exports are correct
- Check TypeScript configurations
- Verify build scripts work in target environment

## Contact and Support

For questions about the promotion process:
- **Technical issues**: Contact the development team lead
- **Process questions**: Refer to team documentation
- **Emergency issues**: Follow the incident response procedure

---

**Note**: This guide should be customized based on your team's specific workflows, tools, and requirements.