# GitHub Actions Configuration

## Required Secrets and Variables

To use the CI/CD workflows in this repository, configure the following in your GitHub repository settings:

### Repository Variables
Navigate to: **Settings → Secrets and variables → Actions → Variables**

| Variable | Value | Description |
|----------|-------|-------------|
| `DOCKER_USER` | `pinizov` | Your Docker Hub username |

### Repository Secrets
Navigate to: **Settings → Secrets and variables → Actions → Secrets**

| Secret | Description | How to Generate |
|--------|-------------|-----------------|
| `DOCKER_PAT` | Docker Hub Personal Access Token | 1. Log into [Docker Hub](https://hub.docker.com/)<br>2. Go to Account Settings → Security<br>3. Click "New Access Token"<br>4. Name: "GitHub Actions"<br>5. Permissions: Read, Write, Delete<br>6. Copy the token and add to GitHub secrets |

### Optional Secrets (for deployment)
| Secret | Description |
|--------|-------------|
| `PRODUCTION_HOST` | IP or hostname of production server |
| `PRODUCTION_USER` | SSH username for deployment |
| `PRODUCTION_SSH_KEY` | Private SSH key for server access |
| `PRODUCTION_DOMAIN` | Production domain for health checks |
| `SLACK_WEBHOOK` | Slack webhook URL for notifications |

## Workflows

### build.yml
- **Trigger**: Push to `main` branch or pull requests
- **Purpose**: Build multi-arch Docker images (linux/amd64, linux/arm64)
- **Behavior**:
  - PRs: Cache-only build (no push)
  - Main branch: Build and push to Docker Hub
- **Docker Build Cloud**: Uses `pinizov/payemst` cloud builder endpoint

### main.yml
- **Trigger**: Push to `main`/`develop`, pull requests, daily schedule
- **Purpose**: Full CI/CD pipeline
  - Run tests and linting
  - Security scanning (npm audit, Trivy)
  - Build Docker images
  - Deploy to production
  - Send notifications

## How to Set Up

1. **Add Variables**:
```bash
# In GitHub repo: Settings → Secrets and variables → Actions → Variables
# Click "New repository variable"
Name: DOCKER_USER
Value: pinizov
```

2. **Add Secrets**:
```bash
# In GitHub repo: Settings → Secrets and variables → Actions → Secrets
# Click "New repository secret"
Name: DOCKER_PAT
Value: <paste your Docker Hub token>
```

3. **Test the workflow**:
```bash
# Push to main to trigger build
git add .
git commit -m "test: trigger CI build"
git push origin main

# Or create a PR to test cache-only build
git checkout -b test-pr
git push origin test-pr
# Create PR on GitHub
```

## Verifying Setup

After pushing code:
1. Go to **Actions** tab in your GitHub repository
2. Click on the latest workflow run
3. Verify all steps complete successfully
4. Check Docker Hub for the pushed image: `pinizov/docker-build-cloud-demo:latest`

## Troubleshooting

### "Error: Unable to locate credentials"
- Ensure `DOCKER_PAT` secret is set correctly
- Verify the token has not expired
- Check token permissions include Read & Write

### "Error: failed to solve: failed to compute cache key"
- Ensure Docker Build Cloud endpoint is correct: `pinizov/payemst`
- Verify you have access to the cloud builder

### Build fails on ARM64
- Add `--platform linux/amd64` to docker-compose.yml if you only need x86
- Or keep multi-arch for broader compatibility

## Additional Resources

- [Docker Build Cloud Documentation](https://docs.docker.com/build/cloud/)
- [GitHub Actions Docker Guide](https://docs.github.com/en/actions/publishing-packages/publishing-docker-images)
- [Docker Hub Token Management](https://docs.docker.com/docker-hub/access-tokens/)
