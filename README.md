# Sevvy Monitor

AWS Lambda functions for monitoring logs from various sources at fixed intervals. Part of the Sevvy AI monitoring ecosystem.

## Overview

Sevvy Monitor is a collection of AWS Lambda functions designed to poll logs from various cloud providers and services. Each function monitors specific integration providers (CloudWatch, GCP, BQL, etc.) and can detect errors or issues using configurable regex patterns. When errors are detected, alerts are sent via a configurable API.

## Architecture

```
Lambda Function → Role Assumption → Log Fetching → Error Detection → Alert API
     ↓                ↓                 ↓              ↓             ↓
Environment      AWS STS         CloudWatch Logs   Regex Patterns  Stubbed API
Variables                        (1-min chunks)
```

## Features

- **Multi-provider support**: Extensible architecture for different log sources
- **CloudWatch integration**: Role assumption for cross-account log access
- **Error detection**: Configurable regex patterns for error identification
- **Time-based chunking**: Processes logs in configurable intervals (default: 1 minute)
- **Alert system**: Configurable API integration for error notifications
- **TypeScript**: Fully typed codebase with comprehensive error handling

## Project Structure

```
src/
├── handlers/           # Lambda function handlers
│   └── cloudwatch.ts   # CloudWatch monitoring handler
├── integrations/       # Provider-specific integrations
│   └── cloudwatch/     # CloudWatch integration
├── shared/             # Shared utilities
│   ├── aws-utils.ts    # AWS SDK utilities
│   ├── error-patterns.ts # Error detection patterns
│   └── alert-api.ts    # Alert API client (stubbed)
└── types/              # TypeScript type definitions
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm
- AWS CLI configured (for deployment)

### Installation

```bash
cd sevvy-monitor
npm install
```

### Development

```bash
# TypeScript compilation
npm run build

# Development server with hot reload
npm run dev

# Run tests
npm test

# Linting and formatting
npm run lint:format:fix
```

### Lambda Deployment

```bash
# Build Lambda deployment package
npm run build:lambda

# Deploy to development environment
npm run deploy:dev

# Deploy to production environment  
npm run deploy:prod
```

## Usage

### CloudWatch Monitoring

The CloudWatch Lambda function accepts the following parameters:

```typescript
{
  "logGroupName": "/aws/lambda/my-function",
  "awsAccountId": "123456789012", 
  "roleArn": "arn:aws:iam::123456789012:role/LogMonitoringRole",
  "intervalMinutes": 1,          // Optional: defaults to 1
  "startTime": 1640995200000,    // Optional: Unix timestamp
  "endTime": 1640995260000       // Optional: Unix timestamp
}
```

### Environment Variables

Required for deployment:

```bash
AWS_REGION=us-east-1           # AWS region
ALERT_API_URL=https://...      # Alert API endpoint (optional)
ALERT_API_KEY=your-api-key     # Alert API authentication (optional)
```

## Error Detection

The system includes built-in error patterns:

- **Generic Error**: `error`, `ERROR`, `Error`
- **Exception**: `exception`, `Exception`, `EXCEPTION`
- **Failed**: `failed`, `Failed`, `FAILED`, `failure`
- **Timeout**: `timeout`, `timed out`
- **Connection Error**: `connection error`, `connection failed`
- **HTTP Error**: `404`, `500`, `bad request`, etc.
- **Database Error**: `database error`, `sql error`
- **AWS Error**: `AccessDenied`, `ThrottlingException`

Custom patterns can be added by extending the `ErrorPattern[]` configuration.

## State Management

The current implementation uses a simple time-based approach for tracking the last read time. This is stubbed out in `log-fetcher.ts` and can be replaced with persistent storage (DynamoDB, Parameter Store, etc.) in future iterations.

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

### AWS Lambda Configuration

Recommended Lambda settings:
- **Runtime**: Node.js 18
- **Memory**: 256 MB
- **Timeout**: 30 seconds  
- **Architecture**: x86_64

### IAM Permissions

The Lambda function needs:
- `sts:AssumeRole` - For cross-account access
- `logs:FilterLogEvents` - For reading CloudWatch logs

The assumed role in target accounts needs:
- `logs:FilterLogEvents` - For the specific log groups
- `logs:DescribeLogGroups` - For log group metadata

## Contributing

1. Follow existing TypeScript patterns
2. Add tests for new functionality
3. Run linting before committing: `npm run lint:format:fix`
4. Update documentation for API changes

## Future Enhancements

- [ ] Persistent state management for last read time tracking
- [ ] Additional integration providers (GCP, BQL)
- [ ] Advanced error pattern configuration via environment
- [ ] Metrics and monitoring dashboard
- [ ] Alert deduplication and throttling
- [ ] Webhook support for alert delivery