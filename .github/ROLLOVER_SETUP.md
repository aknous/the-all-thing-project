# GitHub Actions Rollover Setup

This project uses GitHub Actions to automatically close polls and run rollover daily.

## Setup Instructions

### 1. Add Admin Key Secret

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `ADMIN_KEY`
5. Value: Your admin key (the same one you use to log into the admin portal)
6. Click **Add secret**

### 2. Workflow Configuration

The workflow runs at **10:00 UTC** which is:
- **5:00 AM EST** (Eastern Standard Time - winter)
- **6:00 AM EDT** (Eastern Daylight Time - summer)

To change the time, edit `.github/workflows/daily-rollover.yml` and modify the cron schedule:
```yaml
- cron: '0 10 * * *'  # minute hour day month weekday (UTC)
```

For example:
- `'0 12 * * *'` = 12:00 UTC (7:00 AM EST / 8:00 AM EDT)
- `'0 14 * * *'` = 14:00 UTC (9:00 AM EST / 10:00 AM EDT)

### 3. What It Does

Every day, the workflow:
1. **Closes yesterday's polls** - Creates snapshots and marks polls as CLOSED
2. **Runs rollover for today** - Creates poll instances for all active templates

### 4. Manual Trigger

You can manually trigger the workflow:
1. Go to **Actions** tab in your GitHub repo
2. Click **Daily Poll Rollover** workflow
3. Click **Run workflow**
4. Optionally specify a custom date (YYYY-MM-DD)

### 5. Monitoring

To check if it's working:
- Go to **Actions** tab to see workflow runs
- Each run shows logs and success/failure status
- Failed runs will send you an email notification

### 6. Testing

To test before the scheduled time:
1. Use the manual trigger (see step 4)
2. Check the logs to ensure it completes successfully
3. Verify in your admin portal that polls were closed/created

## Troubleshooting

**If the workflow fails:**
- Check that `ADMIN_KEY` secret is set correctly
- Verify your backend is accessible at `https://the-all-thing-backend.fly.dev`
- Check the workflow logs in the Actions tab

**If polls aren't being created:**
- Ensure templates are set to `isActive = true`
- Check that templates don't have plans with `isEnabled = false` for today
- Verify rollover succeeded in the workflow logs
