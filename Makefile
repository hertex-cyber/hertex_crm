# TZAHU CRM — Development Makefile

.PHONY: help dev test lint typecheck migrate shell seed clean docker-up docker-down docker-build

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Start local development servers
	@echo "Starting development servers..."
	@cd backend && python manage.py runserver 0.0.0.0:8000 &

test: ## Run all tests
	@cd backend && python -m pytest $(ARGS)

test-coverage: ## Run tests with coverage report
	@cd backend && python -m pytest --cov=apps --cov-report=term --cov-report=html

lint: ## Run linters
	@cd backend && ruff check .
	@cd backend && ruff format --check .

typecheck: ## Run type checker
	@cd backend && mypy apps config --strict

format: ## Format code
	@cd backend && ruff format .
	@cd backend && ruff check --fix .

migrate: ## Run database migrations
	@cd backend && python manage.py migrate

makemigrations: ## Create new migrations
	@cd backend && python manage.py makemigrations

shell: ## Django shell
	@cd backend && python manage.py shell_plus

seed: ## Seed development database
	@cd backend && python manage.py seed_data

clean: ## Clean build artifacts
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete
	@rm -rf .coverage htmlcov .mypy_cache

docker-up: ## Start Docker Compose environment
	@docker compose up -d

docker-down: ## Stop Docker Compose environment
	@docker compose down

docker-build: ## Build Docker images
	@docker compose build

docker-logs: ## View Docker logs
	@docker compose logs -f

import-lint: ## Check module import rules
	@cd backend && lint-imports

pre-commit: ## Run pre-commit hooks on all files
	@pre-commit run --all-files
