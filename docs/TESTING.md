# Testing Guide

This document outlines the testing setup and strategy for PronoFootball.Club.

## Test Framework

We use **Jest** as our testing framework with the following setup:
- **Jest** - Test runner and assertion library
- **@testing-library/react** - React component testing utilities
- **@testing-library/jest-dom** - Custom Jest matchers for DOM
- **jest-environment-jsdom** - DOM environment for tests

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

Tests are located alongside the code they test:
- `lib/__tests__/` - Tests for library utilities
- `components/__tests__/` - Tests for React components (when added)
- `pages/__tests__/` - Tests for page components (when added)

## Current Test Coverage

### ✅ Scoring Systems (`lib/__tests__/scoring-systems.test.ts`)

Comprehensive tests for the core business logic:

**Football Standard Scoring:**
- Exact score predictions (3 points)
- Correct result predictions (1 point)
- Wrong result predictions (0 points)
- Edge cases (draws, high scores, zero scores)

**Rugby Proximity Scoring:**
- Exact or close score predictions (≤5 difference = 3 points)
- Correct result but far score (1 point)
- Wrong result (0 points)
- Edge cases (threshold boundaries, high scores)

**Test Count:** 62 tests covering all scoring scenarios

### ✅ API Client Utilities (`lib/__tests__/football-data-api.test.ts`)

Tests for critical API integration logic:

**Team Name Normalization:**
- Lowercase conversion
- Prefix/suffix removal (FC, CF, AC, AS, etc.)
- Special team name variations (Inter Milan, Sporting CP, etc.)
- Accent and special character handling
- Space cleanup

**Team Matching:**
- Exact matching
- Fuzzy matching with similarity scores
- Advanced multi-strategy matching
- Threshold-based matching

**Status Mapping:**
- External API status to internal status conversion
- All status types (SCHEDULED, IN_PLAY, FINISHED, etc.)
- Default behavior for unknown statuses

**Test Count:** 30+ tests covering team matching and status mapping

## Test Coverage Goals

Current coverage focuses on **critical business logic**:
- ✅ Scoring calculations (100% coverage)
- ✅ Team matching algorithms (100% coverage)
- ✅ Status mapping (100% coverage)

### Priority Areas for Future Tests

1. **High Priority:**
   - Live score sync logic (`pages/api/update-live-scores-*.ts`)
   - Bet validation and creation
   - User authentication flows
   - Competition management

2. **Medium Priority:**
   - API route handlers
   - Database query functions
   - Utility functions

3. **Low Priority:**
   - React components (UI testing)
   - Integration tests
   - E2E tests

## Writing Tests

### Test File Naming

- Test files should be named `*.test.ts` or `*.test.tsx`
- Place test files in `__tests__` directories or alongside source files

### Test Structure

```typescript
import { functionToTest } from '../module';

describe('Module Name', () => {
  describe('Function Name', () => {
    it('should do something specific', () => {
      // Arrange
      const input = { ... };
      
      // Act
      const result = functionToTest(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Best Practices

1. **Test one thing at a time** - Each test should verify a single behavior
2. **Use descriptive names** - Test names should clearly describe what they test
3. **Arrange-Act-Assert** - Structure tests with clear sections
4. **Test edge cases** - Include boundary conditions and error cases
5. **Keep tests independent** - Tests should not depend on each other
6. **Mock external dependencies** - Use mocks for API calls, database, etc.

### Example Test

```typescript
describe('calculateBetPoints', () => {
  it('should award 3 points for exact score match', () => {
    const bet: BetScore = { score1: 2, score2: 1 };
    const actual: ActualScore = { home: 2, away: 1 };
    expect(calculateBetPoints(bet, actual, 'FOOTBALL_STANDARD')).toBe(3);
  });
});
```

## Continuous Integration

Tests should be run:
- Before committing code (pre-commit hook recommended)
- In CI/CD pipeline before deployment
- As part of code review process

## Coverage Thresholds

Current coverage thresholds (in `jest.config.js`):
- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%

These thresholds will be increased as more tests are added.

## Debugging Tests

To debug a specific test:

```bash
# Run a specific test file
npm test -- scoring-systems.test.ts

# Run tests matching a pattern
npm test -- -t "exact score"

# Run in watch mode with verbose output
npm run test:watch -- --verbose
```

## Next Steps

1. Add tests for live score sync logic
2. Add tests for API route handlers
3. Add integration tests for critical user flows
4. Increase coverage thresholds as tests are added
5. Set up pre-commit hooks to run tests automatically
