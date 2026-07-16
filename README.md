# Boxship

**Boxship** is a flexible deployment tool for Node.js and static web applications. It provides a simple CLI for automating deployments to various hosting environments, including static file servers and MyDevilNet hosting.

## Features

- Config-file based deployments with multiple named targets
- Supports multiple deployment strategies
- Incremental deploys — only changed files are transferred, stale files are removed
- Excluded directories (e.g. user uploads) are preserved on the server
- Dry-run and diff modes to preview commands and file changes before deploying
- Post-deploy verification via an HTTP status check
- Zero dependencies
- Verbose logging for troubleshooting

## Requirements

- macOS, Linux or WSL (Windows is not supported natively)
- `ssh` and `rsync` available on the `PATH` (preinstalled on most systems; boxship checks before deploying)
- Node.js 20 or newer

## Quick Start

Install Boxship as a development dependency:

```bash
npm install boxship --save-dev
```

Create a `boxship.config.json` in your project root — `npx boxship init` scaffolds one:

```json
{
  "$schema": "https://unpkg.com/boxship/boxship.schema.json",
  "targets": {
    "production": {
      "strategy": "MyDevilNet",
      "username": "someuser",
      "host": "s1.mydevil.net",
      "domain": "example.com",
      "location": "~/domains/example.com/public_nodejs",
      "exclude": ["uploads"]
    },
    "staging": {
      "strategy": "Static",
      "username": "someuser",
      "host": "staging.example.com",
      "location": "~/public",
      "port": 2222
    }
  }
}
```

Add a deploy script to your `package.json`:

```json
"scripts": {
    "predeploy": "npm run build:production",
    "deploy": "boxship production"
}
```

Run the deployment:

```bash
npm run deploy
```

## Usage

```bash
boxship [target] [options]
boxship init [options]
```

The target name can be omitted when the config defines exactly one target. `boxship init` creates a starter config (respecting `--config` for the location) and refuses to overwrite an existing one.

### CLI Options

- `--config` – Path to the config file or its directory, resolved from the current directory (defaults to `boxship.config.json` in the current directory); useful when deploying from a directory that doesn't hold the config, e.g. `boxship --config ..`
- `--diff` – Show which files would be transferred and deleted, without deploying
- `--dry-run` – Print the commands without executing them
- `--verbose` – Log each command and its output
- `--help` – Show help message

### Target Options

- `strategy` – Deployment strategy (`Static` or `MyDevilNet`)
- `username` – SSH username for the remote server
- `host` – Hostname or IP address of the server
- `location` – Target directory on the server
- `domain` – Domain name for deployment (required for `MyDevilNet`)
- `port` – SSH port (`Static` only)
- `source` – Local directory to sync, with a trailing slash (defaults to `./`)
- `exclude` – Additional paths to skip, as an array or comma-separated string; excluded paths are neither uploaded nor deleted, so server-side data like `uploads` survives deploys
- `npm` – npm binary to use for installs (defaults to `npm`)
- `url` – when set, the deploy is verified by fetching this address afterwards and fails unless it responds with a success status; the check is retried a few times to give the server time to restart
- `before` / `after` – remote commands (a string or an array) run in `location` over ssh, before the files are synced and after the deploy finishes; use these for migrations, cache clears, or custom restarts instead of changing boxship — single quotes are not allowed in hook commands

Values are passed to `ssh` and `rsync` as-is, so they must not contain whitespace, quotes, or shell symbols — the config is validated and deploys are refused otherwise.

The package ships a JSON schema (`boxship.schema.json`); keep the `$schema` line from the starter config to get autocomplete and validation in editors that support it.

Deploys are incremental: files are synced with `rsync --delete`, so only changed files are transferred and files removed locally are removed from the server.

### Default Excludes

These paths are always excluded, in addition to anything in `exclude`:

`.git`, `.env`, `.vscode`, `.idea`, `.DS_Store`, `.claude`, `node_modules`, `test`, `temp`, `tmp`, `coverage`, `boxship.config.json`

Excludes match exact names, so `.env` stays local (and the server's copy is preserved) while `.env.example` still gets deployed.

## Deployment Strategies

### Static

For static hosting environments that serve files from a public directory. This strategy syncs your build output to the specified folder.

### MyDevilNet

For MyDevilNet hosting, this strategy verifies a `.env` exists on the server, syncs the files, installs production dependencies, and restarts the server using the provider's built-in commands. Since `node_modules` is excluded by default, the server-side install is kept between deploys.

On a first deploy, when no `.env` exists yet, the local `.env.example` is uploaded as `.env` and an editor (`$EDITOR`, falling back to `nano`) opens on the server over ssh — fill in the real values, save, and the deploy continues. When run without a terminal, the deploy seeds the file and aborts instead. Secrets stay on the server: they are typed directly into the remote editor, never appearing in local files, command arguments, or shell history, and `.env` is never uploaded, deleted, or overwritten.

Before the files are synced, the keys of the server's `.env` are compared against the local `.env.example` — only key names, never values. When new variables have appeared in `.env.example`, they are appended to `.env` with their example values and the editor opens again (or the deploy aborts without a terminal), so no code ships and nothing restarts until the configuration is complete. Node.js hosting is managed via Passenger and relies on file naming/location conventions.

To log in to the server manually:

```bash
ssh -l <user> <server_number>.mydevil.net
```

## Contributing

Contributions are welcome! Please open issues or submit pull requests for new features, bug fixes, or documentation improvements.

## License

MIT
