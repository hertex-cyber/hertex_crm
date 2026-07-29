# ADR-013: Testing Framework — pytest + pytest-django

- **Status:** Accepted
- **Date:** 2025-07-27
- **Authors:** Chief Architect, QA Lead

## Context

TZAHU CRM requires a comprehensive testing strategy covering unit tests, integration tests, API tests, and end-to-end tests. The testing framework must support Django ORM test fixtures, database rollback, test parallelization, code coverage, and CI integration.

## Options Considered

### 1. pytest + pytest-django (Selected)
- **Pros:** Most popular Python test framework, concise syntax (fixtures, parametrize, asserts), pytest-django provides Django test integration (database, client, settings), plugin ecosystem (pytest-cov, pytest-xdist for parallel, pytest-mock, pytest-freezegun, pytest-socket), fixture scoping for performance, automatic test discovery, excellent CI compatibility, readable output, Django's TestCase + pytest features combined.
- **Cons:** Requires understanding of pytest fixture scope (db re-creation), conftest files can become complex, fixture dependency can be hard to debug, must configure pytest-django settings module.

### 2. Django TestCase (unittest-based)
- **Pros:** Built-in, no additional dependency, works out of the box, well documented, Django-specific assertions (assertContains, assertTemplateUsed).
- **Cons:** Verbose (class-based, method naming), no fixture scoping (slower), no parametrization, no test ordering, less readable output, weaker assertion introspection, less community momentum (pytest is standard).

### 3. Doctest
- **Pros:** Embedded in docstrings, self-documenting, simple.
- **Cons:** Not suitable for complex test setup (database, API), no mocking, no coverage, no parametrization, not maintainable at scale.

### 4. Nose2
- **Pros:** Plugin-based, test discovery, parallel execution.
- **Cons:** Effectively abandoned (maintenance mode), community migrated to pytest, fewer plugins, no longer recommended.

## Decision

**Use pytest + pytest-django** as the sole testing framework.

Testing pyramid:
1. **Unit tests** (70% of tests): Service layer, domain logic, validators, utils. No database. Use `pytest-mock`.
2. **Integration tests** (20%): Repository layer, database queries, Celery tasks, external services (mocked via responses/respx).
3. **API tests** (8%): DRF endpoint tests with `pytest-django` client, authentication, permissions, validation.
4. **E2E tests** (2%): Playwright-based browser tests (separate CI workflow).

Key configuration:
- `pytest.ini`: `DJANGO_SETTINGS_MODULE=config.settings.test`
- `conftest.py`: Shared fixtures (user, tenant, auth_client)
- `pytest-xdist`: Parallel test execution (`-n auto`)
- `pytest-cov`: Coverage threshold 85% minimum (90% for domain layer)
- `pytest-socket`: Disable network access in unit tests
- `pytest-freezegun`: Time-dependent tests
- `pytest-django`: `--reuse-db` for local development speed

## Consequences

- **Positive:** Industry standard, excellent Django integration, rich plugin ecosystem, fast test execution.
- **Positive:** Fixture scoping reduces test boilerplate vs unittest.
- **Negative:** pytest fixture convention requires team learning.
- **Negative:** Database fixture scoping (db, transaction_db) must be understood to avoid performance pitfalls.
- **Negative:** pytest-django's `client` fixture creates a new database per test function by default.

## Compliance

- CI: `pytest --cov=modules --cov-fail-under=85 --timeout=60 -n auto`
- PR requirement: New code must include tests.
- Code review: Verify test coverage for new features.
- Weekly: `pytest --cov-report=html` published to build artifacts.
- No `unittest.TestCase` allowed in new code (migration path for existing).
