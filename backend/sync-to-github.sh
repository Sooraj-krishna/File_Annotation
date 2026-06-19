#!/bin/bash

set -e

# Variables
BRANCH="$BITBUCKET_BRANCH"

echo "Bitbucket branch: $BRANCH"

# Determine GitHub repository name based on Bitbucket repository details
GITHUB_REPO="$GITHUB_ORG_NAME/$(echo "$BITBUCKET_REPO_SLUG" | tr '[:upper:]' '[:lower:]')"

echo "GitHub repository: $GITHUB_REPO"
echo "GITHUB_TOKEN: ${GITHUB_TOKEN:0:4}..."

# Create a temporary directory for cloning
TEMP_DIR=$(mktemp -d)

# Clone the GitHub repository into the temporary directory
git clone "https://x-token-auth:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" "$TEMP_DIR"
REPO_NAME=$(basename "$GITHUB_REPO" .git)

# Navigate to the cloned repository
cd "$TEMP_DIR"

# Remove any previously created nested directories
if [ -d "$TEMP_DIR/$REPO_NAME" ]; then
    echo "Cleaning up nested directory: $TEMP_DIR/$REPO_NAME"
    rm -rf "$TEMP_DIR/$REPO_NAME"
fi

# Sync files directly into the root of the cloned repository
rsync -av --exclude='.git' --delete "${BITBUCKET_CLONE_DIR}/" "$TEMP_DIR/"

# Check out the branch
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git checkout "$BRANCH"
else
    git checkout -b "$BRANCH"
fi

# Configure Git user details
git config --global user.email "$GIT_USER_EMAIL"
git config --global user.name "$GITHUB_USERNAME"

# Commit and force push changes
git add .
git commit -m "Sync from Bitbucket" || true
git push --force origin "$BRANCH"

# Clean up the temporary directory
rm -rf "$TEMP_DIR"
