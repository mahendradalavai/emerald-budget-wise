# Plan: Emoji categories + connection check

## Connection status (already verified)

- The hosted backend is up and healthy — login, expenses and budgets are really saved in the cloud database.
- The app works on any device (phone, tablet, computer) with internet: sign in with your email and your data is there.
- It needs an internet connection to load and save; it does not work offline.

## What I'll build

### 1. Emoji for every category

Each category gets an emoji shown next to its icon everywhere it appears:

- Room Rent 🏠
- Groceries 🛒
- Curries 🍛
- Travel 🚌
- Drinks 🥤
- Other 💸

Emoji will appear in:

&nbsp;

- The "Add expense" category picker
- &nbsp;
- The "Spending by category" list on the Monthly tab
- Each expense row on the Daily tab
- New category adding edit option for new item add

### 2. Verify the data connection end to end

- Add a test expense in the preview, confirm it appears in the list and in the database, then delete it.
- Confirm sign-in / sign-up still works after the change.

3 Callender add and neet expences data visuals

&nbsp;

## Technical details

- Only `src/routes/index.tsx` changes: add an `emoji` field to the `CATEGORIES` list and render it in the three places above.
- No database or login changes needed — the existing tables and security rules already work.