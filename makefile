install:
	uv sync

install-dev:
	uv sync --all-extras
	cd frontend && bun install

MIGRATIONS_DIR = postgres/migrations

check-migrations:
	@invalid=$$( \
		ls $(MIGRATIONS_DIR) \
		| grep -vE '^[0-9]{4}\.[A-Za-z0-9_]+\.sql$$' \
		|| true \
	); \
	dups=$$( \
		ls $(MIGRATIONS_DIR) \
		| sed -n 's/^\([0-9]\{4\}\)\..*/\1/p' \
		| sort \
		| uniq -d \
	); \
	if [ -n "$$invalid" ]; then \
		echo "Invalid migration names:"; \
		echo "$$invalid"; \
		exit 1; \
	fi; \
	if [ -n "$$dups" ]; then \
		echo "Duplicate migration versions:"; \
		echo "$$dups"; \
		exit 1; \
	fi

check-schema:
	docker compose stop lvdb
	docker compose rm -f -v lvdb
	docker compose up -d --wait lvdb
	uv run lv-backend migrate
	bunx schemalint@2.3.2

check:
	@output=$$(copier check-update --answers-file .template.yaml 2>&1) || true; \
	if echo "$$output" | grep -q "up-to-date"; then \
		true; \
	elif echo "$$output" | grep -q "New template version"; then \
		echo "Template update available, run make update-template"; \
	else \
		echo "$$output"; \
	fi

	@find . \
		-name "*.py" \
		-not -path "./.venv/*" \
		-not -path "./.git/*" \
		-exec uv run python -m py_compile {} +
	@echo "Compilation ok."

	@uv run ruff format \
		--quiet \
		--config=pyproject.toml \
		--check
	@echo "Formatting ok."

	@uv run ruff check \
		--quiet \
		--config=pyproject.toml
	@echo "Linter ok."

	@output=$$(uv run basedpyright 2>&1); exit_code=$$?; \
	if [ $$exit_code -ne 0 ]; then echo "$$output"; fi; \
	exit $$exit_code
	@echo "Typechecking ok."

	@$(MAKE) check-migrations
	@echo "Migrations ok."

	@uv run pytest \
		--quiet \
		--config-file=pyproject.toml
	@echo "Testing ok."

	@cd frontend && bun --silent run prettier --check src
	@echo "Frontend formatting ok."

	@cd frontend && bun --silent run lint
	@echo "Frontend linter ok."

fix:
	@uv run ruff format \
		--quiet \
		--config=pyproject.toml

	@uv run ruff check \
		--quiet \
		--config=pyproject.toml \
		--fix

	@cd frontend && bun --silent run prettier --write src
	@cd frontend && bun --silent run oxlint --fix

wheel:
	uv build --wheel

new-branch:
	@read -p "Branch name: " branch_name && \
	branch_name=$${branch_name// /-} && \
	base=$$(git remote show origin | sed -n '/HEAD branch/s/.*: //p') && \
	echo "Selecting $$base branch as default" && \
	git fetch origin $$base && \
	git checkout -b $$branch_name origin/$$base && \
	git push -u origin $$branch_name

update-template:
	copier update \
		--skip-answered \
		--conflict inline \
		--answers-file .template.yaml

start-db:
	docker compose up -d

stop-db:
	docker compose down

restart-db:
	make stop-db
	make start-db

run-frontend:
	bun run --cwd frontend dev
