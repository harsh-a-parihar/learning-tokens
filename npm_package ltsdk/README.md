## Learning Tokens SDK (ltsdk)

A ready-to-run connector that helps instructors and implementation teams connect their LMS environments to the Learning Tokens platform. The SDK acts as a bridge between the various Learning Management Systems and a Granular Achievement Recognition System (GARS - Learning Tokens) that unifies authentication, fetches course information, and presents a modern dashboard so teams can review the data before issuing Learning Tokens or building further automations.

---

## Requirements
- Node.js 16+ and npm 7+.
- LTSDK access key. You can use any of the following dummy Access keys when prompted to input in the browser:
  - `LTSDK-2024-STANFORD-A1B2C3D4` (Stanford)
  - `LTSDK-2024-MIT-E5F6G7H8` (MIT)
  - `LTSDK-2024-HARVARD-I9J0K1L2` (Harvard)
  - `LTSDK-2024-BERKELEY-M3N4O5P6` (Berkeley)
  - `LTSDK-2024-OXFORD-Q7R8S9T0` (Oxford)
- LMS credentials for at least one of the supported platforms.
- local LMS instances ([Tutor](https://docs.tutor.overhang.io/) for Open edX, [Moodle](https://docs.moodle.org/400/en/Installation) docker) if you do not have institutional credentials yet. Most production users will plug in their actual campus LMS. 

---


## Install & Run
To install the package, use the following command:

```
npm install ltsdk
```

Once installed, to run the SDK, use the following command:
```
npx ltsdk start
```

- The SDK will verify your access automatically.
- Once initialized, your browser will open automatically.
- To stop the SDK, press `Ctrl+C` in the terminal. This will gracefully shut down all services (SDK server, auth server, and frontend).

---

## LMS-specific notes
- **Open edX**: Uses OAuth authorization code flow. Register `http://localhost:5002/auth/edx/callback` in your edX admin panel.
- **Canvas**: Requires an API token generated from your Canvas profile.
- **Moodle**: Uses a web services token generated from the Moodle admin area.
- **Google Classroom**: OAuth consent flow handled within the SDK. Register `http://localhost:5002/api/google/callback` in your google cloud console.

All LMS credentials stay on your machine (privacy-oriented architecture). The SDK stores them in `local-server/config.auth.json`, which is ignored by git and excluded from the npm package.

---

## Development workflow (for contributors)
- `npm run build`: Compiles TypeScript to `dist/`.
- `npm test`: Runs adapter + smoke tests.
- `npm run dev:all:auth`: Starts backend, auth server, and frontend simultaneously (mirrors the CLI behavior).
- Environment examples live in `env.example` and `frontend/.env.example`.

---

## Support & resources
- GitHub: https://github.com/hyperledger-labs/learning-tokens
- Tutor (Open edX) docs: https://docs.tutor.overhang.io/
- Moodle install docs: https://docs.moodle.org/400/en/Installation


---

## License
Linux Foundation
