# Instruction to start

Go to each of the directory and make a .env with all necessary values example are also given at each directory

## Anyone can deploy on testnet or hardhat node or hyperledger besu local enviroment

# Instructions to Start

1. Go to each of the directories and create a `.env` file with all necessary values. Examples are provided in each directory.

## Deployment Options

### Testnet, Hardhat Node, or Hyperledger Besu Local Environment

#### Starting with Hardhat Local Node

1. Go to the `learning-token` directory (Make sure `.env` is present with all required values, examples are provided).

```bash
npm i
npx hardhat node
npx hardhat run
npx hardhat run scripts/DeployLocalHardhat.ts --network localhost
```

2. Go to the learning-token-backend directory (Make sure .env is present with all required values, examples are provided).

```
npm i
yarn start:dev
```

3. Go to the learning-token-dashboard directory (Make sure .env is present with all required values, examples are provided).

```
yarn
yarn dev
```

## Learning Tokens SDK Integration

The system now supports direct integration with Learning Management Systems (LMS) via the `ltsdk` package. This allows for:

1.  **Seamless Data Import**: Instructors can import course data, student rosters, and grades directly from Canvas, Moodle, Open edX, and Google Classroom.
2.  **Automated On-chain Registration**:
    *   **Institutions & Instructors**: Automatically linked and verified on the blockchain during the import process.
    *   **Learners**: Automatically registered on the blockchain if they don't already exist, ensuring they have a wallet address to receive tokens.
3.  **Auto-Course Creation**: Courses imported from an LMS are automatically created on the blockchain, removing the need for manual setup.
4.  **Token Distribution**: Once imported, instructors can easily define scoring guides and distribute granular achievement tokens (Attendance, Score, Help, Instructor Score) to learners based on their LMS performance.

### How to Use the SDK with the Local Environment

1.  Ensure the `learning-token-backend` is running.
2.  Install and run the SDK:
    ```bash
    npm install -g ltsdk
    ltsdk start
    ```
3.  Follow the on-screen instructions to connect your LMS and import a course.
4.  The SDK will redirect you to the Learning Tokens Dashboard to finalize token distribution.

# If anyone wants to start with quorum-test-network with hyperledger besu

1. Go to the `quorum-test-network` directory. start with running

**To start services and the network:**

`./run.sh` starts all the docker containers

**To stop services :**

`./stop.sh` stops the entire network, and you can resume where it left off with `./resume.sh`

`./remove.sh ` will first stop and then remove all containers and images

2. Go to the `learning-token` directory (Make sure `.env` is present with all required values, examples are provided).

Uncomment following line from hardhat.config.ts

```
     besu: {
       accounts: [SUPER_ADMIN_PRI_KEY],
       url: "http://localhost:8545",
       chainId: 1337,
       gasPrice: 0,
       blockGasLimit: 8000000000,
       timeout: 1800000,
     },
```

```bash
npm i
npx hardhat node
npx hardhat run
npx hardhat run scripts/DeployLocalHyperledgerBesu.ts --network besu
```

3. Go to the learning-token-backend directory (Make sure .env is present with all required values, examples are provided).

```
npm i
yarn start:dev
```

4. Go to the learning-token-dashboard directory (Make sure .env is present with all required values, examples are provided).

```
yarn
yarn dev
```
