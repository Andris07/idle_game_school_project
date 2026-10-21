# Cypress E2E Testing

## Overview

This project uses [Cypress](https://www.cypress.io/) for End-to-End (E2E) testing of web applications.

E2E tests verify that an application works correctly from the user's perspective by interacting with the application in a real browser.

## Prerequisites

* [Node.js](https://nodejs.org/) (LTS version recommended)
* npm (included with Node.js)
* [Just](https://just.systems/) (optional, for running commands using the `justfile`)

Verify your installation:

```bash
node --version
npm --version
```

## Installation

All Cypress-related files are stored in the `cypress_tests/` directory.

### 1. Navigate to the project directory

```bash
cd cypress_tests
```

### 2. Initialize npm (only if `package.json` does not exist)

```bash
npm init -y
```

### 3. Install Cypress

```bash
npm install --save-dev cypress
```

This installs Cypress as a development dependency and generates or updates `package-lock.json`.

### 4. Open Cypress

```bash
npx cypress open
```

On the first launch:

1. Select **E2E Testing**.
2. Follow the setup wizard.
3. Confirm the Cypress configuration files.
4. Select a browser.
5. Start the E2E testing environment.

Cypress will create the required configuration and support files.

## Project Structure

The directory should look similar to this:

```text
cypress_tests/
├── cypress/
│   ├── e2e/
│   │   └── first-test.cy.js
│   ├── fixtures/
│   └── support/
├── node_modules/          # Not committed to Git
├── cypress.config.js
├── package.json
├── package-lock.json
└── justfile               # Optional
```

The exact configuration files may vary depending on the Cypress setup.

## Creating Your First E2E Test

Create a new file inside:

```text
cypress_tests/cypress/e2e/
```

For example:

```text
first-test.cy.js
```

Add the following test:

```javascript
describe('My first E2E test', () => {
  it('opens the Cypress website', () => {
    cy.visit('https://www.cypress.io/');

    cy.contains('Cypress').should('be.visible');
  });
});
```

This test opens the Cypress website and verifies that an element containing the text `Cypress` is visible.

You can replace the URL with the address of your own application.

## Running Tests in the Browser

To run tests interactively:

```bash
cd cypress_tests
npx cypress open
```

Then:

1. Select **E2E Testing**.
2. Choose a browser.
3. Select `first-test.cy.js`.

Cypress will open the test in the selected browser and display the execution results.

## Running Tests from the Terminal

To execute the E2E tests without opening the interactive Cypress interface:

```bash
cd cypress_tests
npx cypress run
```

## Installing Dependencies on Another Machine

After cloning the repository, navigate to `cypress_tests/` and run:

```bash
npm ci
```

This installs the dependencies recorded in `package-lock.json`.

**Note:** `node_modules/` should not be committed to Git. Keep `package.json` and `package-lock.json` under version control so that dependencies can be installed consistently.

## Useful Commands

| Command                          | Description                              |
| -------------------------------- | ---------------------------------------- |
| `npm ci`                         | Install dependencies from the lockfile   |
| `npm install --save-dev cypress` | Install Cypress                          |
| `npx cypress open`               | Open the interactive Cypress test runner |
| `npx cypress run`                | Run tests from the terminal              |
| `npx cypress verify`             | Verify the Cypress installation          |

## Official Documentation

* [Cypress Installation](https://docs.cypress.io/app/get-started/install-cypress)
* [Cypress E2E Testing](https://docs.cypress.io/app/end-to-end-testing)
* [Cypress Configuration](https://docs.cypress.io/app/references/configuration)