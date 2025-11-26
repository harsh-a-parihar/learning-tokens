## Learning Tokens SDK (ltsdk)

A ready-to-run connector that helps instructors and implementation teams connect their LMS environments to the Learning Tokens platform. The SDK acts as a bridge between the various Learning Management Systems and a Granular Achievement Recognition System (GARS - Learning Tokens) that unifies authentication, fetches course information, and presents a modern dashboard so teams can review the data before issuing Learning Tokens or building further automations.

---

## Requirements
- Node.js 16+ and npm 7+.
- LTSDK access key (provided by your Learning Tokens contact, refer to the `local-server/auth/keys.json` file where some dummy keys are listed that you can use).
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

- Enter the LTSDK access (dummy) key when prompted.
- Once verified, your browser will open automatically.
- To stop the SDK, press `Ctrl+C` in the terminal. This will gracefully shut down all services (SDK server, auth server, and frontend).

---

## LMS-specific notes
- **Open edX**: Uses OAuth authorization code flow. Register `http://localhost:5002/auth/edx/callback` in your edX admin panel.
- **Canvas**: Requires an API token generated from your Canvas profile.
- **Moodle**: Uses a web services token generated from the Moodle admin area.
- **Google Classroom**: OAuth consent flow handled within the SDK. The redirect URI is preset and displayed in the UI.

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
