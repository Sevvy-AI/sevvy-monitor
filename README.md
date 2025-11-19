# Sevvy Monitor

AWS Lambda functions for monitoring logs from various cloud providers and services. Part of the Sevvy AI monitoring ecosystem.

## Overview

Sevvy Monitor is a collection of AWS Lambda functions designed to poll logs from CloudWatch, Cloudflare, Vercel, and Datadog at regular intervals. Each function monitors specific integration providers and detects errors using configurable regex patterns. When errors are detected, alerts are sent to an SQS queue for processing.

## Architecture

```
EventBridge (1-min trigger) → Lambda Handler → Parameter Validation
                                    ↓
                              Log Fetching (API/S3)
                                    ↓
                              Error Detection (Regex Patterns)
                                    ↓
                              SQS Alert Queue
                                    ↓
                              DynamoDB (State Tracking)
```

## Features

- **Multi-provider support**: CloudWatch, Cloudflare, Vercel, and Datadog integrations
- **Minute-by-minute monitoring**: Processes logs in 1-minute intervals
- **DynamoDB state tracking**: Persists last read timestamps to avoid duplication
- **Error detection**: Configurable regex patterns for error identification
- **Pagination support**: Handles large log volumes efficiently
- **Backfill logic**: Recovers from delayed/missing logs automatically
- **SQS alerting**: Sends detected errors to queue for downstream processing
- **TypeScript**: Fully typed codebase with comprehensive error handling

## Project Structure

```
src/
├── handlers/              # Lambda function handlers
│   ├── cloudwatch.ts      # AWS CloudWatch monitoring
│   ├── cloudflare.ts      # Cloudflare Workers monitoring
│   ├── vercel.ts          # Vercel deployments monitoring
│   └── datadog.ts         # Datadog logs monitoring
├── integrations/          # Provider-specific integrations
│   ├── cloudwatch/        # CloudWatch integration (role assumption)
│   ├── cloudflare/        # Cloudflare integration (S3-based)
│   ├── vercel/            # Vercel integration (S3-based)
│   └── datadog/           # Datadog integration (API-based)
├── shared/                # Shared utilities
│   ├── dynamodb.ts        # DynamoDB state management
│   ├── sqs-queue.ts       # SQS alert queue client
│   ├── error-detector.ts  # Error detection patterns
│   └── error-patterns.ts  # Default error regex patterns
└── types/                 # TypeScript type definitions
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- AWS CLI configured (for deployment)
- GitHub CLI (for automated deployments)

### Installation

```bash
cd sevvy-monitor
npm install
```

### Development Commands

#### Build & Development

```bash
npm run build              # TypeScript compilation
npm run build:lambda       # Build + bundle + package for Lambda
npm run dev               # Hot reload with tsx (CloudWatch)
npm run dev:cloudflare    # Hot reload (Cloudflare)
npm run dev:vercel        # Hot reload (Vercel)
npm run dev:datadog       # Hot reload (Datadog)
```

#### Testing

```bash
npm test                  # Run all tests
npm run test:watch        # Run tests in watch mode
```

#### Linting & Formatting

```bash
npm run lint              # Run ESLint
npm run lint:fix          # Fix ESLint issues
npm run format:fix        # Fix Prettier formatting
npm run lint:format:fix   # Fix both linting and formatting
```

#### Local Testing Scripts

```bash
npm run run:cloudwatch    # Test CloudWatch locally
npm run run:cloudflare    # Test Cloudflare locally
npm run run:vercel        # Test Vercel locally
npm run run:datadog       # Test Datadog locally
```

## Lambda Functions

### CloudWatch Handler

**File**: `src/handlers/cloudwatch.ts`  
**Handler**: `cloudwatch.handler`

Monitors AWS CloudWatch Logs with cross-account role assumption.

**Event Parameters**:

```typescript
{
  "logGroupName": "/aws/lambda/my-function",
  "awsAccountNumber": "123456789012",
  "roleArn": "arn:aws:iam::123456789012:role/LogMonitoringRole",
  "externalId": "external-id",
  "orgId": "org-id",
  "groupId": "group-id",
  "resourceId": "resource-id",
  "startTime": 1640995200000,    // Optional
  "endTime": 1640995260000       // Optional
}
```

### Cloudflare Handler

**File**: `src/handlers/cloudflare.ts`  
**Handler**: `cloudflare.handler`

Monitors Cloudflare Workers logs from S3.

**Event Parameters**:

```typescript
{
  "s3Bucket": "cloudflare-logs-bucket",
  "s3Prefix": "logs/",
  "cloudflareAccountId": "account-id",
  "workerScriptName": "worker-name",
  "orgId": "org-id",
  "groupId": "group-id",
  "resourceId": "resource-id",
  "startTime": 1640995200000,    // Optional
  "endTime": 1640995260000       // Optional
}
```

### Vercel Handler

**File**: `src/handlers/vercel.ts`  
**Handler**: `vercel.handler`

Monitors Vercel deployment logs from S3.

**Event Parameters**:

```typescript
{
  "projectName": "my-project",
  "orgId": "org-id",
  "groupId": "group-id",
  "resourceId": "resource-id",
  "startTime": 1640995200000,    // Optional
  "endTime": 1640995260000       // Optional
}
```

**Environment Variable**: `VERCEL_LOGS_S3_BUCKET`

### Datadog Handler

**File**: `src/handlers/datadog.ts`  
**Handler**: `datadog.handler`

Monitors Datadog logs via Datadog Logs API.

**Event Parameters**:

```typescript
{
  "secretArn": "arn:aws:secretsmanager:...",
  "datadogSite": "https://api.datadoghq.com",
  "logIndex": "main",
  "orgId": "org-id",
  "groupId": "group-id",
  "resourceId": "resource-id",
  "startTime": 1640995200000,    // Optional
  "endTime": 1640995260000       // Optional
}
```

**Secrets Manager Secret Structure**:

```json
{
  "apiKey": "dd_api_key_value",
  "appKey": "dd_app_key_value"
}
```

**Local Testing**:

```bash
# Create .env file
DATADOG_SECRET_ARN=arn:aws:secretsmanager:us-east-1:...
DATADOG_SITE=https://api.datadoghq.com
DATADOG_LOG_INDEX=main
TEST_ORG_ID=your-org-id
TEST_GROUP_ID=your-group-id
TEST_RESOURCE_ID=your-resource-id

# Run locally
npm run run:datadog
```

## Environment Variables

### Required for All Lambdas

```bash
AWS_REGION=us-east-1                    # AWS region
SQS_QUEUE_URL=https://sqs...            # SQS alert queue URL
```

### Optional Configuration

```bash
MAX_MINUTES_PER_RUN=120                 # Max minutes per invocation (default: 120)
SAFETY_MINUTES=1                        # Safety buffer (default: 1)
```

### Vercel-Specific

```bash
VERCEL_LOGS_S3_BUCKET=sevvy-logs        # S3 bucket for Vercel logs
```

## Error Detection

The system includes built-in error patterns in `src/shared/error-detector.ts`:

- **Generic Error**: `error`, `ERROR`, `Error` (excluding URLs/paths)
- **Exception**: `exception`, `Exception`, `EXCEPTION`
- **Failed**: `failed`, `Failed`, `FAILED`, `failure`
- **Timeout**: `timeout`, `timed out`, `TIMEOUT`
- **Connection Error**: `connection error/failed/refused`
- **HTTP Error**: `4xx`, `5xx`, status codes
- **Database Error**: `database error`, `sql/query failed`
- **AWS Error**: `AccessDenied`, `ThrottlingException`, `ServiceUnavailable`

Custom patterns can be added per integration by extending the `customErrorPatterns` parameter.

## State Management

State tracking is implemented using **DynamoDB** (`src/shared/dynamodb.ts`):

- **Table**: `ResourceMonitoring`
- **Keys**: `orgId` (partition key), `resourceId` (sort key)
- **Attributes**: `LastReadTime` (timestamp), `UpdatedAt` (timestamp)

Each Lambda maintains its progress by:

1. Reading `LastReadTime` from DynamoDB at start
2. Processing logs minute-by-minute
3. Updating `LastReadTime` after each successful minute
4. Resuming from last successful timestamp on next invocation

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

Tests cover:

- Error pattern matching
- Error detection logic
- Alert API functionality
- AWS utilities (mocked)

## Deployment

### GitHub Actions CI/CD

Automated deployment via `.github/workflows/deploy.yml`:

- **On Pull Request**: Deploys to non-prod environment
- **On Main Branch**: Deploys to prod environment
- **Steps**: Test → Lint → Build → Bundle → Deploy

All Lambda functions are deployed from a single `deployment.zip` package.

### AWS Lambda Configuration

Recommended settings for all handlers:

- **Runtime**: Node.js 20
- **Memory**: 512 MB
- **Timeout**: 300 seconds (5 minutes)
- **Architecture**: x86_64

### IAM Permissions

**Lambda Execution Role** needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sts:AssumeRole"],
      "Resource": "arn:aws:iam::*:role/LogMonitoringRole*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::log-buckets/*", "arn:aws:s3:::log-buckets"]
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem"],
      "Resource": "arn:aws:dynamodb:*:*:table/ResourceMonitoring"
    },
    {
      "Effect": "Allow",
      "Action": ["sqs:SendMessage"],
      "Resource": "arn:aws:sqs:*:*:sevvy-agent-analysis-queue"
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:*:*:secret:sevvy/*"
    }
  ]
}
```

**Cross-Account Roles** (for CloudWatch) need:

- `logs:FilterLogEvents` - For reading CloudWatch logs
- `logs:DescribeLogGroups` - For log group metadata

## TypeScript Configuration

### Strict Typing

- **Zero `any` types** - All interfaces explicitly defined
- **Comprehensive error handling** - Type-safe error casting
- **AWS SDK types** - Proper typing for all AWS service interactions
- **Lambda types** - Full typing for event handling and responses

### Module System

- **ES Modules** - Uses `"type": "module"` in package.json
- **Import Extensions** - All imports use `.js` extensions for compiled output
- **Path Aliases** - `@/*` aliases configured for cleaner imports

### Build System

- **TypeScript Compilation**: `tsc` compiles to `dist/` directory
- **esbuild Bundling**: Creates optimized single-file bundles per handler
- **External Dependencies**: AWS SDK marked as external (provided by Lambda runtime)
- **Minification**: Enabled for production builds
- **ZIP Packaging**: Automated deployment package creation

## Adding New Integration Providers

1. Create new directory under `src/integrations/<provider>/`
2. Implement provider-specific log fetching in `fetch.ts`
3. Implement monitoring orchestration in `monitor.ts`
4. Create validation utilities in `utils.ts`
5. Create new Lambda handler in `src/handlers/<provider>.ts`
6. Update `src/shared/types.ts` with new event interfaces
7. Add bundling script to `package.json`
8. Update `.github/workflows/deploy.yml` with deployment steps

## Contributing

1. Follow existing TypeScript patterns and file structures
2. Match naming conventions from existing integrations
3. Add tests for new functionality in `tests/`
4. Run linting before committing: `npm run lint:format:fix`
5. Update this README for API/feature changes
6. Test locally before submitting PR

## Future Enhancements

- [ ] Additional integration providers (GCP, Azure Monitor)
- [ ] Alert deduplication based on pattern + time window
- [ ] Alert severity levels based on error pattern types
- [ ] Metrics and monitoring dashboard
- [ ] Alert throttling to prevent spam
- [ ] Multiple alert channels (Slack, email, PagerDuty)
