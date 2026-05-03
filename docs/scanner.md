# Dependency Scanner

The scanner inspects local project files and maps dependencies to verified funding metadata from `registry/projects.json`.

## Supported Inputs

```text
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
pyproject.toml
requirements.txt
Cargo.toml
Cargo.lock
go.mod
composer.json
Gemfile
pom.xml
*.csproj
Dockerfile
.github/workflows/*.yml
```

## Output

The scanner emits:

- Dependencies by ecosystem
- Direct, development, runtime, and transitive relationships
- Source files where a dependency appeared
- Verification status from the static registry
- Missing funding metadata count

The scanner is intentionally local-first. It does not call external package registries in this MVP.
