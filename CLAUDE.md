# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build & Development

- `npm run build` - TypeScript compilation for local development
- `npm run build:lambda` - Full Lambda deployment pipeline (build + bundle + package)
- `npm run dev` - Development server with hot reload using tsx
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode

### Linting & Formatting

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format:fix` - Fix Prettier formatting issues
- `npm run lint:format:fix` - Run both linting and formatting fixes

### Deployment

- `npm run deploy:dev` - Deploy to development Lambda function
- `npm run deploy:prod` - Deploy to production Lambda function

## Architecture Overview

### Core Design: Log Monitoring Architecture

The system implements a serverless log monitoring architecture:

```
Lambda Trigger → Parameter Validation → Role Assumption → Log Fetching
                                                             ↓
Alert API ← Error Detection ← Pattern Matching ← Log Processing
```

### Key Components

**Lambda Handlers** (`src/handlers/`)

- Entry points for Lambda functions
- Handle both API Gateway and direct invocation
- Parameter validation and error handling
- Response formatting

**CloudWatch Integration** (`src/integrations/cloudwatch/`)

- `log-fetcher.ts` - Fetches logs using AWS SDK with role assumption
- `error-detector.ts` - Applies regex patterns to detect errors
- `cloudwatch-monitor.ts` - Orchestrates the monitoring workflow

**Shared Utilities** (`src/shared/`)

- `aws-utils.ts` - AWS SDK helpers for role assumption and client creation
- `error-patterns.ts` - Default and custom error pattern definitions
- `alert-api.ts` - Alert API client (currently stubbed)

**Type System** (`src/types/`)

- Comprehensive TypeScript interfaces for all data structures
- Lambda event/response types
- AWS service response types

### Data Flow

1. **Parameter Input**: Lambda receives monitoring parameters (log group, account, role ARN)
2. **Role Assumption**: Uses STS to assume cross-account role for log access
3. **Log Fetching**: Retrieves logs from CloudWatch for specified time range
4. **Error Detection**: Applies regex patterns to identify error messages
5. **Alert Generation**: Sends alerts via API if errors are detected
6. **Response**: Returns structured monitoring result

## Environment Variables

### Required for Deployment

```bash
AWS_REGION=us-east-1                    # AWS region for Lambda and services
```

### Optional Configuration

```bash
ALERT_API_URL=https://api.example.com/alerts  # Alert API endpoint
ALERT_API_KEY=your-secret-key                # Alert API authentication key
```

### Cloudflare Monitoring Configuration

```bash
MAX_MINUTES_PER_RUN=120                 # Maximum minutes to process per Lambda invocation (default: 120)
SAFETY_MINUTES=1                        # Safety buffer minutes before current time (default: 1)
```

## Lambda Function Configuration

### CloudWatch Handler

- **File**: `src/handlers/cloudwatch.ts`
- **Runtime**: Node.js 18
- **Memory**: 256 MB recommended
- **Timeout**: 30 seconds recommended
- **Trigger**: EventBridge (for scheduled execution) or API Gateway

### Required IAM Permissions

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
    }
  ]
}
```

## TypeScript Configuration

### Strict Typing

- **Zero `any` types** - All interfaces explicitly defined
- **Comprehensive error handling** - Type-safe error casting throughout
- **AWS SDK types** - Proper typing for all AWS service interactions
- **Lambda types** - Full typing for event handling and responses

### Key Interfaces

- `MonitoringEvent` - Lambda input parameters
- `MonitoringResult` - Lambda output structure
- `LogEvent` - CloudWatch log event structure
- `ErrorMatch` - Detected error with pattern information
- `AlertPayload` - Alert API request structure

### Module System

- **ES Modules** - Uses `"type": "module"` in package.json
- **Import Extensions** - All imports use `.js` extensions for compiled output
- **Path Aliases** - `@/*` aliases configured for cleaner imports

## Testing Strategy

### Test Structure

- `tests/` - All test files in dedicated directory
- `*.test.ts` - Test file naming convention
- **Vitest** - Test runner with Node.js environment

### Test Coverage

- **Error Patterns** - Regex pattern matching and custom pattern creation
- **Error Detection** - Log processing and error identification logic
- **Alert API** - API client functionality (stubbed)
- **Utilities** - AWS SDK utilities (mocked)

### Running Tests

```bash
npm test              # Single run
npm run test:watch    # Watch mode
```

## Development Guidelines

### Code Style

- **NO COMMENTS** - Do not add comments unless explicitly requested
- **Functional Programming** - Prefer pure functions where possible
- **Error Handling** - Always use try/catch with meaningful error messages
- **Logging** - Use console.log for debugging, structured logging for production

### Error Handling Patterns

```typescript
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  console.error("Operation failed:", error);
  throw new Error(
    `Operation failed: ${error instanceof Error ? error.message : "Unknown error"}`
  );
}
```

### Adding New Integration Providers

1. Create new directory under `src/integrations/`
2. Implement provider-specific log fetching
3. Add provider-specific error patterns if needed
4. Create new Lambda handler in `src/handlers/`
5. Update types and shared utilities as needed

## Stubbed Functionality

### State Management (`log-fetcher.ts`)

```typescript
// TODO: Implement persistent storage (DynamoDB, Parameter Store, etc.)
export function getLastReadTime(
  logGroupName: string,
  awsAccountId: string
): number {
  // Currently returns simple time-based approach
  return subMinutes(Date.now(), 1).getTime();
}
```

### Alert API (`alert-api.ts`)

```typescript
// TODO: Implement actual HTTP API calls
async sendAlert(payload: AlertPayload): Promise<boolean> {
  console.log('[STUB] Would send alert to:', this.apiUrl);
  // Simulate API call
  return true;
}
```

## Build System

### Local Development

- **TypeScript Compilation**: `tsc` compiles to `dist/` directory
- **Hot Reload**: `tsx` provides development server with file watching
- **Source Maps**: Enabled for debugging

### Lambda Deployment

- **esbuild Bundling**: Creates optimized single-file bundles
- **External Dependencies**: AWS SDK marked as external (provided by Lambda runtime)
- **Minification**: Enabled for production builds
- **ZIP Packaging**: Automated deployment package creation

### Bundle Analysis

```bash
npm run build:lambda
ls -la deployment.zip  # Check package size
```

## Future Development Notes

### State Management Implementation

Consider these options for persistent state tracking:

- **DynamoDB**: Scalable, serverless
- **Parameter Store**: Simple key-value storage
- **S3**: For larger state objects
- **ElastiCache**: For high-frequency access

### Additional Integration Providers

Structure for new providers:

```
src/integrations/
├── cloudwatch/     # Current implementation
├── gcp/           # Future: Google Cloud Logging
├── bql/           # Future: BigQuery logs
└── generic/       # Future: Generic HTTP log sources
```

### Alert Enhancement Ideas

- Alert deduplication based on pattern + time window
- Alert severity levels based on error pattern types
- Multiple alert channels (Slack, email, PagerDuty)
- Alert throttling to prevent spam

## Deployment Pipeline

### Manual Deployment

```bash
npm run build:lambda    # Build and package
npm run deploy:dev      # Deploy to development
npm run deploy:prod     # Deploy to production
```

### CI/CD Integration

Consider adding GitHub Actions workflow:

- Automated testing on pull requests
- Automated deployment on merge to main
- Environment-specific deployments
- Security scanning and dependency updates
