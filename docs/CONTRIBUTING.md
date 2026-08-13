## Quick Start

### 1. Clone e Setup

```bash
git clone https://github.com/yourusername/betwin.git
cd betwin
npm install
```

### 2. Configurar Ambiente

```bash
# Backend
cp packages/backend/.env.example packages/backend/.env.local
# Editar .env.local com Betfair credentials

# Frontend
cp packages/frontend/.env.local.example packages/frontend/.env.local
```

### 3. Docker

```bash
docker-compose up -d
```

Aguarde ~30s para todos os services iniciarem.

### 4. Migrações

```bash
npm run migrate --workspace=@betwin/backend
```

### 5. Acessar

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Database**: localhost:5432 (betwin_user / betwin_pass)
- **Redis**: localhost:6379

## Development Workflow

### Estrutura de Código

```
src/
├── modules/          # Feature modules
│   ├── auth/
│   ├── betfair/
│   ├── trading/
│   ├── signals/
│   ├── risk/
│   ├── analytics/
│   ├── database/
│   ├── backtest/
│   ├── monitoring/
│   └── api/
├── infrastructure/   # Core services
│   ├── config.ts
│   ├── errors.ts
│   ├── logger.ts
│   └── middleware.ts
└── index.ts          # Entry point
```

### Naming Conventions

- **Files**: `camelCase.ts` ou `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Types**: `PascalCase` (interfaces/types)
- **Enums**: `PascalCase`

### Error Handling

Sempre estender `AppError`:

```typescript
throw new AppError(
  'SOME_ERROR_CODE',
  400,
  'User-friendly message',
  { context: 'data' }
)

// Ou usar específicas:
throw new ValidationError('Invalid input', { field: 'odds' })
throw new RateLimitError('Too many requests', 60)
throw new AuthenticationError()
throw new AuthorizationError()
throw new NotFoundError('Market')
throw new RiskManagerError('EXPOSURE_EXCEEDED', 'Exposure limit exceeded')
```

### Logging

Usar logger do módulo `infrastructure/logger.ts`:

```typescript
import { logger } from '../../infrastructure/logger'

logger.debug('Message', { context: 'data' })
logger.info('Message', { context: 'data' })
logger.warn('Message', { context: 'data' })
logger.error('Message', error, { context: 'data' })
```

### Tipos

Sempre validar entrada com schemas Zod:

```typescript
import { TradeDataSchema } from '@betwin/shared/utils/validation'

const tradeData = TradeDataSchema.parse(req.body)
// ou
const result = TradeDataSchema.safeParse(req.body)
if (!result.success) {
  throw new ValidationError('Invalid trade data', result.error.format())
}
```

### Testing

```bash
# Run tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test -- --coverage
```

Estrutura:

```
packages/backend/tests/
├── unit/
│   ├── modules/
│   │   ├── analytics/
│   │   ├── trading/
│   │   └── risk/
│   └── infrastructure/
├── integration/
│   └── api/
└── fixtures/
```

Test template:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('FeatureName', () => {
  beforeEach(() => {
    // Setup
  })

  it('should do something', () => {
    // Arrange
    const input = { /* ... */ }

    // Act
    const result = functionUnderTest(input)

    // Assert
    expect(result).toBe(expected)
  })
})
```

## Commits e PRs

### Commit Messages

```
feat: Add feature description
fix: Fix bug description
docs: Update documentation
refactor: Refactor code
test: Add tests
ci: Update CI/CD
```

### PR Template

```markdown
## Changes
- Change 1
- Change 2

## Testing
- [ ] Unit tests added
- [ ] Integration tests pass
- [ ] Manual testing done

## Checklist
- [ ] Code follows style guide
- [ ] No breaking changes
- [ ] Documentation updated
```

## Performance

### Monitoring

Monitor com:

```bash
# Check slow queries
SELECT * FROM logs WHERE query_time > 1000

# Check Redis
redis-cli INFO stats

# Check Node memory
node --max-old-space-size=4096
```

### Optimization Guidelines

1. **Database**: Use índices apropriados
2. **Cache**: Redis para dados frequentes
3. **API**: Rate limiting respeitado
4. **Frontend**: Code splitting, lazy loading
5. **Logging**: Não log em loops/hot paths

## Troubleshooting

### PostgreSQL connection failed

```bash
docker-compose restart postgres
# ou
docker-compose logs postgres
```

### Redis connection failed

```bash
docker-compose restart redis
docker-compose logs redis
```

### npm install fails

```bash
rm -rf node_modules package-lock.json
npm install
```

### Build fails

```bash
npm run type-check
npm run lint
npm run test
```

### Frontend not updating

```bash
# Limpar cache
rm -rf node_modules/.vite
npm run dev
```

## Resources

- [Betfair API Docs](https://docs.betfair.com)
- [Express.js Guide](https://expressjs.com)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs)
