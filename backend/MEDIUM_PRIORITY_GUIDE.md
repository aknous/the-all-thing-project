# Medium Priority Improvements - Migration Guide

## Overview
This document explains the medium priority improvements implemented and how to use them.

## 1. Redis Failover Handling ✅

### What Changed
- Added safe wrapper functions around Redis operations
- System gracefully degrades when Redis is unavailable
- Rate limiting, caching, and vote tracking fail open (allow requests) when Redis is down
- Database constraints still prevent duplicate votes even if Redis fails

### Safe Functions Available
```python
from app.redisClient import safeRedisGet, safeRedisSet, safeRedisDelete, safeRedisIncr, safeRedisExpire

# Returns None if Redis is down
value = await safeRedisGet("key")

# Returns False if Redis is down
success = await safeRedisSet("key", "value", ex=60)
```

### Behavior When Redis is Down
- **Rate limiting**: Allows requests (logged as warning)
- **Vote tracking**: Falls back to database unique constraint
- **Caching**: Bypasses cache, computes fresh data
- **Health checks**: Reports Redis as "unhealthy" but continues serving

## 2. Improved Database Connection Pooling ✅

### What Changed
- **Pool size**: Increased from 5 to 20 connections
- **Max overflow**: Increased from 5 to 10 additional connections
- **Command timeout**: 60 second timeout for long queries
- **Application name**: Tagged as "allthing-api" for easier monitoring
- **Automatic rollback**: Sessions auto-rollback on exceptions

### Benefits
- Handles 20-30 concurrent database operations
- Better performance under load
- Easier to identify queries in PostgreSQL logs
- Prevents connection leaks with auto-cleanup

## 3. Docker Security Improvements ✅

### What Changed
- **Multi-stage build**: Smaller final image (~200MB reduction)
- **Non-root user**: Runs as 'appuser' instead of root
- **Health check**: Built-in Docker health monitoring
- **Minimal dependencies**: Only runtime dependencies in final image

### Security Benefits
- Container breakout is less severe (non-root user)
- Smaller attack surface (fewer packages)
- Better resource isolation
- Automatic container restart on health check failure

### Health Check
Docker will automatically check `/healthz` every 30 seconds:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3
```

## 4. Admin Audit Logging ✅

### Database Table
New table `adminAuditLogs` tracks all admin actions:

```sql
CREATE TABLE adminAuditLogs (
    id VARCHAR(36) PRIMARY KEY,
    action VARCHAR(128) NOT NULL,
    entityType VARCHAR(64),
    entityId VARCHAR(36),
    adminKeyHash VARCHAR(64),
    ipAddress VARCHAR(45),
    userAgent VARCHAR(256),
    changes JSONB,
    metadata JSONB,
    success BOOLEAN NOT NULL DEFAULT true,
    errorMessage TEXT,
    createdAt TIMESTAMP WITH TIME ZONE NOT NULL
);
```

### Usage in Admin Routes
```python
from app.auditLog import logAdminAction
from app.adminAuth import requireAdmin, AdminContext

@router.post("/categories")
async def createCategory(
    payload: CategoryCreateInput,
    db: AsyncSession = Depends(getDb),
    admin: AdminContext = Depends(requireAdmin)  # Now returns context
):
    category = PollCategory(...)
    db.add(category)
    
    # Log the action
    await logAdminAction(
        db=db,
        action="category_created",
        entityType="category",
        entityId=category.id,
        adminKeyHash=admin.adminKeyHash,
        ipAddress=admin.ipAddress,
        userAgent=admin.userAgent,
        changes={"key": "new-category", "name": "New Category"}
    )
    
    await db.commit()
```

### Querying Audit Logs
```python
# Get all actions by an admin
logs = await db.execute(
    select(AdminAuditLog)
    .where(AdminAuditLog.adminKeyHash == "hash")
    .order_by(AdminAuditLog.createdAt.desc())
)

# Get all changes to a specific entity
logs = await db.execute(
    select(AdminAuditLog)
    .where(AdminAuditLog.entityType == "template")
    .where(AdminAuditLog.entityId == "template-id")
)

# Get failed actions
logs = await db.execute(
    select(AdminAuditLog)
    .where(AdminAuditLog.success == False)
)
```

## Migration Required

You need to create a database migration for the audit log table:

```bash
cd backend
alembic revision --autogenerate -m "add_admin_audit_logs"
alembic upgrade head
```

## Testing

### Test Redis Failover
```bash
# Stop Redis
docker stop redis  # or brew services stop redis

# Make requests - should still work but slower
curl http://localhost:8080/polls/today

# Check logs for warnings about Redis being unavailable
```

### Test Database Pool
```bash
# Simulate concurrent load
for i in {1..30}; do
  curl http://localhost:8080/polls/today &
done
wait

# Should handle all 30 concurrent requests
```

### Test Docker Security
```bash
# Build new image
docker build -t allthing-api .

# Run and check user
docker run --rm allthing-api whoami
# Output: appuser (not root!)

# Test health check
docker run -d -p 8080:8080 allthing-api
docker ps  # Should show "healthy" status after 30 seconds
```

### Test Audit Logging
```bash
# Create a category via admin endpoint
curl -X POST http://localhost:8080/admin/categories \
  -H "x-admin-key: your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"key":"test","name":"Test Category","sortOrder":1}'

# Check database
psql -d allthing_dev -c "SELECT * FROM \"adminAuditLogs\" ORDER BY \"createdAt\" DESC LIMIT 5;"
```

## Rollback Plan

If issues occur, you can rollback:

1. **Redis failover**: No rollback needed, backward compatible
2. **Database pooling**: Reduce pool_size back to 5 in `db.py`
3. **Docker**: Use old Dockerfile (commit before changes)
4. **Audit logging**: Drop table if not needed:
   ```sql
   DROP TABLE IF EXISTS "adminAuditLogs";
   ```

## Next Steps

To fully utilize these improvements:

1. **Add audit logging to remaining admin endpoints** (currently only category creation logs)
2. **Monitor Redis health** and set up alerts for when it's down
3. **Tune database pool sizes** based on actual load patterns
4. **Set up log aggregation** to analyze audit logs and Redis failures
