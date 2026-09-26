# GitHub Actions Workflow

This directory contains the GitHub Actions workflow configuration for automated testing.

## 📋 **Available Workflows**

### `playwright.yml`
Automated testing workflow that runs on every pull request to `main`, every push to `main`, and on demand (Actions tab → Run workflow).

**Jobs:**

| Job | Runs on | What it does |
|-----|---------|--------------|
| `Checks` | PRs and pushes | ESLint and Prettier, strict type check, `npm audit --audit-level=high`, framework unit tests with coverage thresholds, test list and policy lint (allowed tags, quarantine tickets) |
| `Burn-in` | PRs only | Tests affected by the PR (`--only-changed=origin/<base>`), once and then 10 times with no retries. Needs full git history (`fetch-depth: 0`) |
| `Tests (shard N/2)` | PRs and pushes | The suite split across machines (`--shard`), each with a MySQL service container, writing blob reports. Then `@quarantine` tests (shard 1, non-blocking) and the leftover-data check |
| `Tests` | PRs and pushes | Merges the blob reports (HTML + JSON), writes the results summary to the job summary and as a PR comment, and fails if any shard failed |
| `Visual` | PRs and pushes | Screenshot comparison inside the Playwright Docker image (`npm run test:visual`). Uploads expected/actual/diff images on failure |
| `Publish Allure Report` | Pushes to `main` only | Builds the Allure report (with trend history) and deploys it to GitHub Pages |

`Checks`, `Burn-in`, `Tests` and `Visual` are the required status checks for merging into `main`. `Burn-in` is skipped on pushes to `main`, which GitHub counts as passing. To shard further, add numbers to the `test-shard` job's `matrix.shard`; the shard count follows automatically. PR runs never publish a report and need no secrets.

### `nightly.yml`
Runs both suites on Chromium, Firefox and WebKit every day at 06:00 UTC, and on demand from the Actions tab. Each browser is a separate job, and all three finish even if one fails. Allure results are uploaded per browser. It isn't a required check: PRs stay on Chromium for speed, and this catches browser-specific breakage within a day. To be notified, enable failed-workflow emails for scheduled runs in your GitHub notification settings.

### `dependabot.yml`
Opens weekly PRs for npm and GitHub Actions updates. Minor and patch npm updates are grouped into one PR.

## 🚀 **Setup Instructions**

### 1. **Enable GitHub Pages** (for Allure reports)
1. Go to your repository Settings
2. Navigate to Pages section
3. Set Source to "GitHub Actions"

No personal access token is needed. The workflow deploys with the built-in `GITHUB_TOKEN`.

### 2. **Point the Tests at Your Application**
The examples run against the bundled demo app (`demo-app/`), which the tests start automatically, so the pipeline is green out of the box. To test your real app, set these in the `Tests` job's `env`, with credentials stored as repository secrets (Settings → Secrets and variables → Actions):

```yaml
env:
  BASE_URL: https://qa.your-app.example.com
  APP_USERNAME: ${{ secrets.APP_USERNAME }}
  APP_PASSWORD: ${{ secrets.APP_PASSWORD }}
```

Remove the `services.mysql` block and the `DB_*` variables if you don't test a database, or point `DB_*` at your test database (password from a secret).

### 3. **Customize the Workflow** (Optional)

#### **Change Test Tags:**
Edit the `Run Playwright Tests` step in `.github/workflows/playwright.yml`:
```yaml
# Run all tests
run: npx playwright test

# Or run specific tags
# run: npx playwright test --grep @smoke
```

#### **Change Operating System:**
Edit `runs-on` for the `test` job in `.github/workflows/playwright.yml`:
```yaml
# Ubuntu (recommended - faster)
runs-on: ubuntu-latest

# Windows
# runs-on: windows-latest

# macOS
# runs-on: macos-latest
```

#### **Enable Scheduled Runs:**
Uncomment the `schedule` block at the top of `.github/workflows/playwright.yml`:
```yaml
schedule:
  - cron: '0 4 * * *'  # Daily at 4 AM UTC
```

## 📊 **Reports**

After each workflow run:
- **Allure Report** (pushes to `main`): `https://yourusername.github.io/your-repo-name/allure-report/`
- **Test Artifacts** (every run): videos, traces, screenshots and the Playwright HTML report, downloadable from the run summary for 14 days
- **Workflow Logs**: Available in the Actions tab of your repository

## 🔧 **Troubleshooting**

### **Workflow Fails:**
1. Check the Actions tab for detailed error logs
2. Ensure all dependencies are properly installed
3. Verify your test configuration is correct

### **`Checks` Fails on npm audit:**
A dependency has a new high or critical advisory. Run `npm audit` locally, then `npm audit fix` (or merge the Dependabot PR if one is open).

### **Reports Not Deploying:**
1. Ensure Pages Source is set to "GitHub Actions"
2. Reports only publish from pushes to `main`, not from PRs
3. Check the `github-pages` environment allows deployments from `main` (Settings → Environments)

### **Performance Issues:**
1. The workflow uses caching to improve performance
2. Consider using self-hosted runners for faster execution
3. Optimize test execution time by using parallel jobs

## 📝 **Customization Examples**

### **Add Environment Variables:**
```yaml
- name: Run Tests with Environment
  run: npx playwright test
  env:
    NODE_ENV: production
    API_URL: ${{ secrets.API_URL }}
```

### **Run Tests in Parallel:**
```yaml
strategy:
  matrix:
    browser: [chromium, firefox, webkit]
```

### **Add Slack Notifications:**
```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
``` 