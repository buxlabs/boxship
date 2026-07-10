# Boxship

**Boxship** is a flexible deployment tool for Node.js and static web applications. It provides a simple CLI for automating deployments to various hosting environments, including static file servers and MyDevilNet hosting.

## Features

- Config-file based deployments with multiple named targets
- Supports multiple deployment strategies
- Incremental deploys — only changed files are transferred, stale files are removed
- Excluded directories (e.g. user uploads) are preserved on the server
- Dry-run mode to preview commands before running them
- Zero dependencies
- Verbose logging for troubleshooting

## Quick Start

Install Boxship as a development dependency:

```bash
npm install boxship --save-dev
```

Create a `boxship.config.json` in your project root:

```json
{
  "targets": {
    "production": {
      "strategy": "MyDevilNet",
      "username": "someuser",
      "host": "s1.mydevil.net",
      "domain": "example.com",
      "location": "~/domains/example.com/public_nodejs",
      "exclude": ["node_modules"]
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
```

The target name can be omitted when the config defines exactly one target.

### CLI Options

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
- `exclude` – Directories to skip, as an array or comma-separated string; excluded directories are neither uploaded nor deleted, so server-side data like `uploads` survives deploys
- `npm` – npm binary to use for installs (defaults to `npm`)

Deploys are incremental: files are synced with `rsync --delete`, so only changed files are transferred and files removed locally are removed from the server. Note that when deploying from a project root (the default `./` source), directories like `.git` should be listed in `exclude`.

## Deployment Strategies

### Static

For static hosting environments that serve files from a public directory. This strategy syncs your build output to the specified folder.

### MyDevilNet

For MyDevilNet hosting, this strategy syncs the files, installs production dependencies, and restarts the server using the provider's built-in commands. Add `node_modules` to `exclude` to keep the server-side install between deploys. Node.js hosting is managed via Passenger and relies on file naming/location conventions.

To log in to the server manually:

```bash
ssh -l <user> <server_number>.mydevil.net
```

## Contributing

Contributions are welcome! Please open issues or submit pull requests for new features, bug fixes, or documentation improvements.

## License

MIT
