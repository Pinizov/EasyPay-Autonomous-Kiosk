# Repository Management Guide

This guide explains how to manage GitHub repositories, including how to delete them safely.

## Table of Contents
- [How to Delete a GitHub Repository](#how-to-delete-a-github-repository)
- [Before Deleting](#before-deleting)
- [Alternative Options](#alternative-options)
- [Recovery Options](#recovery-options)

---

## How to Delete a GitHub Repository

### Prerequisites
- You must be the repository owner or have admin access
- The repository must not be the only fork (if it's a fork network)

### Step-by-Step Instructions

#### Option 1: Delete via GitHub Web Interface

1. **Navigate to Your Repository**
   - Go to `https://github.com/USERNAME/REPOSITORY-NAME`
   - Replace `USERNAME` with your GitHub username
   - Replace `REPOSITORY-NAME` with the repository name

2. **Access Repository Settings**
   - Click the **Settings** tab (⚙️ icon) at the top right of the repository page
   - Scroll down to the bottom of the page

3. **Find the Danger Zone**
   - Locate the **"Danger Zone"** section at the bottom
   - This section has a red background

4. **Delete Repository**
   - Click the **"Delete this repository"** button
   - A confirmation dialog will appear

5. **Confirm Deletion**
   - Type the full repository name in the format: `USERNAME/REPOSITORY-NAME`
   - Example: `Pinizov/EasyPay-Autonomous-Kiosk`
   - Click **"I understand the consequences, delete this repository"**

6. **Authenticate** (if prompted)
   - You may need to enter your GitHub password
   - Or authenticate with 2FA if enabled

#### Option 2: Delete via GitHub CLI

If you have [GitHub CLI](https://cli.github.com/) installed:

```bash
# Delete a repository
gh repo delete USERNAME/REPOSITORY-NAME

# With confirmation skip (use with caution)
gh repo delete USERNAME/REPOSITORY-NAME --yes
```

#### Option 3: Delete via GitHub API

Using curl or any HTTP client:

```bash
# Delete a repository using GitHub API
curl -X DELETE \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/USERNAME/REPOSITORY-NAME
```

---

## Before Deleting

⚠️ **IMPORTANT**: Deleting a repository is **permanent** and **cannot be undone**. Before deleting:

### 1. Backup Your Repository
```bash
# Clone the repository locally
git clone https://github.com/USERNAME/REPOSITORY-NAME.git

# Or create a bare backup
git clone --mirror https://github.com/USERNAME/REPOSITORY-NAME.git
```

### 2. Export Important Data
- Download release assets
- Save Wiki content (if exists)
- Export Issues and Pull Requests (if needed)
- Save project boards
- Download GitHub Actions artifacts

### 3. Check Dependencies
- Are other repositories or services depending on this repo?
- Are there any webhooks configured?
- Are there any GitHub Actions workflows in other repos referencing this?
- Are there any GitHub Pages sites linked to this repository?

### 4. Notify Collaborators
- Inform team members and contributors
- Give them time to backup their work
- Remove their access before deletion if needed

### 5. Remove External Integrations
- CI/CD services (Travis CI, CircleCI, etc.)
- Deployment services (Heroku, Netlify, Vercel)
- Monitoring tools
- Package registries (npm, Docker Hub, etc.)

---

## Alternative Options

Instead of deleting, consider these alternatives:

### 1. Archive the Repository
Makes the repository read-only but keeps it accessible:
- Go to **Settings** → **General**
- Scroll to **"Danger Zone"**
- Click **"Archive this repository"**
- Confirm the action

### 2. Make Repository Private
Hide it from public view while keeping it:
- Go to **Settings** → **General**
- Under **"Danger Zone"**
- Click **"Change repository visibility"**
- Select **"Make private"**

### 3. Transfer Ownership
Move the repository to another user or organization:
- Go to **Settings** → **General**
- Scroll to **"Danger Zone"**
- Click **"Transfer ownership"**
- Enter the new owner's username

### 4. Rename the Repository
Give it a different name to repurpose it:
- Go to **Settings** → **General**
- Change the **"Repository name"** field
- Click **"Rename"**

---

## Recovery Options

### Can I Recover a Deleted Repository?

**Short answer**: Maybe, but only within 90 days and only by contacting GitHub Support.

### How to Attempt Recovery

1. **Contact GitHub Support Immediately**
   - Go to https://support.github.com/
   - Select **"Contact Us"**
   - Choose **"Account and Profile"**
   - Explain your situation

2. **Provide Required Information**
   - Repository name (username/repository)
   - Approximate deletion date
   - Reason for recovery request
   - Your relationship to the repository

3. **Timeline**
   - GitHub may be able to restore repositories within **90 days** of deletion
   - After 90 days, recovery is **not possible**
   - Response time varies (usually 24-48 hours)

### What Gets Restored?
If recovery is successful, you'll get back:
- ✅ Git repository (code, branches, tags)
- ✅ Issues
- ✅ Pull requests
- ✅ Wiki
- ✅ Project boards
- ❌ Stars, watchers, and forks (these are lost permanently)
- ❌ GitHub Actions workflow runs
- ❌ Releases (binaries may be lost)

---

## FAQ

### Q: Can I delete a repository I don't own?
**A**: No, only repository owners and administrators can delete repositories.

### Q: What happens to forks when I delete my repository?
**A**: Forks remain independent and will not be deleted. The fork network will be restructured.

### Q: Will deleting a repository delete my local copy?
**A**: No, local clones on your computer are unaffected. Only the GitHub remote repository is deleted.

### Q: Can I delete multiple repositories at once?
**A**: Not through the web interface. You can use GitHub CLI or API to script bulk deletions:
```bash
# Example: Delete multiple repos (be very careful!)
for repo in repo1 repo2 repo3; do
  gh repo delete USERNAME/$repo --yes
done
```

### Q: Does deleting a repository delete associated Docker images?
**A**: No, if you've pushed Docker images to Docker Hub or GitHub Container Registry, you need to delete them separately.

### Q: What happens to Issues and PRs that mention the deleted repository?
**A**: Links to the deleted repository will become broken (404 errors).

---

## Best Practices

1. **Archive First**: Before deleting, archive the repository for 30 days to ensure no one needs it
2. **Backup Everything**: Always keep local backups before deletion
3. **Document the Deletion**: Keep a record of why and when you deleted the repository
4. **Clean Up Related Services**: Remove CI/CD configs, webhooks, and deployment services
5. **Use Scripts Carefully**: When using CLI or API for deletion, test with a dummy repository first

---

## Resources

- [GitHub Documentation: Deleting a Repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository)
- [GitHub CLI Documentation](https://cli.github.com/manual/gh_repo_delete)
- [GitHub REST API: Delete Repository](https://docs.github.com/en/rest/repos/repos#delete-a-repository)
- [GitHub Support](https://support.github.com/)

---

## Need Help?

If you have questions about managing this specific repository (EasyPay-Autonomous-Kiosk), please:
1. Check the main [README.md](README.md)
2. Review [PRODUCTION.md](PRODUCTION.md) for deployment guidance
3. See [TESTING.md](TESTING.md) for testing information
4. Open an issue in the repository for specific questions

---

**⚠️ Remember**: Repository deletion is permanent. Always backup first!
