# Boxship

**Boxship** is a flexible deployment tool for Node.js and static web applications. It provides a simple CLI for automating deployments to various hosting environments, including static file servers and MyDevilNet hosting.

## Features

- Easy deployment via CLI
- Supports multiple deployment strategies
- Automates file copying, cleanup, and server restarts
- Integrates with npm scripts
- Verbose logging for troubleshooting

## Quick Start

Install Boxship as a development dependency:

```bash
npm install boxship --save-dev
```

Add a deploy script to your `package.json`:

```json
"scripts": {
    "predeploy": "npm run build:production",
	"deploy": "boxship --username=someuser --host=s1.mydevil.net --domain=example.com --location=~/domains/example.com/public_nodejs --strategy=MyDevilNet --verbose"
}
```

Run the deployment:

```bash
npm run deploy
```

## Usage

Boxship is used via the command line. The most common options are:

```bash
boxship --username=<user> --host=<host> --domain=<domain> --location=<path> --strategy=<strategy> [options]
```

### CLI Options

- `--username` – SSH username for the remote server
- `--host` – Hostname or IP address of the server
- `--domain` – Domain name for deployment
- `--location` – Target directory on the server
- `--strategy` – Deployment strategy (`Static` or `MyDevilNet`)
- `--verbose` – Enable verbose logging
- `--help` – Show help message

## Deployment Strategies

### Static

For static hosting environments that serve files from a public directory. This strategy copies your build output to the specified folder.

### MyDevilNet

For MyDevilNet hosting, this strategy removes old files, uploads new ones, and restarts the server using the provider's built-in commands. Node.js hosting is managed via Passenger and relies on file naming/location conventions.

To log in to the server manually:

```bash
ssh -l <user> <server_number>.mydevil.net
```

## Contributing

Contributions are welcome! Please open issues or submit pull requests for new features, bug fixes, or documentation improvements.

## License

MIT
