# Scripts

`set-firebase-authenticated-claim.mjs` assigns the Firebase custom claim
`role: "authenticated"` to all Firebase users. Supabase requires this claim when
Firebase Auth is used as third-party auth for Data API, Storage, and Realtime.
