# Releasing a New Version

This document outlines the step-by-step process for releasing a new version of the **Coolify GitHub Actions**.

Because GitHub uses the actual repository source code to run actions, the compiled code inside the `deploy/dist` and `wait/dist` directories **must** be up to date and checked into the repository before publishing.

## Process Overview

There are two ways to release a new version in this repository:

1. **Automated (Recommended):** Using the integrated `release-please` workflow.
2. **Manual:** Creating and mapping Git tags manually via the terminal.

Both methods end with the same goal: releasing a specific semantic version (e.g., `v1.0.1`) and updating the floating major tag (e.g., `v1`) so users can continue importing `@v1` painlessly.

---

## Method 1: Automated Release (Release Please)

We use Google's [Release Please](https://github.com/googleapis/release-please) to automatically generate changelogs and handle versioning based on your commit messages.

### Step 1: Make your changes

1. Create a new branch:
   ```bash
   git checkout -b fix/my-awesome-fix
   ```
2. Make your code changes inside the `src/` directory.
3. Build the actions (this updates the `dist/` bundles):
   ```bash
   npm run build
   ```
4. Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) formats (e.g., starting with `fix:`, `feat:`, `chore:`):
   ```bash
   git add .
   git commit -m "fix(deploy): resolve issue with deployment statuses"
   git push -u origin fix/my-awesome-fix
   ```

### Step 2: Merge your changes to `main`

Open a Pull Request on GitHub and merge it into the `main` branch.

### Step 3: Approve the Release PR

As soon as your code is merged into `main`, GitHub Actions will silently run and open a **new Pull Request** titled something like `chore: release 1.0.1`.

1. Go to your **Pull requests** tab on GitHub.
2. Review the safely automated changes to `CHANGELOG.md` and `package.json`.
3. **Merge** this Release Pull Request.

**Behind the scenes:** Once merged, the GitHub Action in `.github/workflows/release.yml` will automatically:

- Create the official GitHub Release and Tag for `v1.0.1`.
- Move the floating `v1` tag to point directly at your new code, ensuring all users referencing `medeiroz/coolify-github-actions/deploy@v1` get the latest updates.

---

## Method 2: Manual Release

If you prefer to bypass the automated PR mechanism, you can release versions manually straight from your terminal.

1. Ensure you are on the `main` branch and have already built and committed your `dist/` artifacts:
   ```bash
   npx -y rimraf deploy/dist wait/dist
   npm run build
   git commit -am "chore: build for release"
   git push origin main
   ```
2. Create the specific version tag (e.g., `v1.0.1`):
   ```bash
   git tag v1.0.1
   ```
3. Force-update the floating major tag (`v1`) to point exactly to your current commit:
   ```bash
   git tag -fa v1 -m "Update main v1 tag"
   ```
4. Push both tags to GitHub simultaneously:
   ```bash
   git push origin v1.0.1
   git push origin v1 --force
   ```
5. _(Optional but Recommended)_: Go to the GitHub repository **Releases** page and click **Draft a new release** using your freshly pushed `v1.0.1` tag to officially list it on the Marketplace.
